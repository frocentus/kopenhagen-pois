// Sucht für jeden Ort ein passendes Bild und schreibt `photo`
// (Thumb-URL, Dateiseite, Autor, Lizenz) in data/places.json.
//
// Quellen:
//   Wikipedia (da, dann en) – das Lead-Bild des Artikels. Ein Artikelbild zeigt
//   per Definition den Artikelgegenstand. Es wird nur übernommen, wenn der
//   Artikel eine Koordinate besitzt, die innerhalb von MAX_ARTICLE_DIST zum Ort
//   liegt. Genau dieser Test wirft die mehrdeutigen Artikelnamen aus („Geranium“
//   = Storchschnabel, „Pluto“ = Zwergplanet, „Alchemist“ = Alchemie, „Jagger“ =
//   Katzenrasse) und alle Ketten-Artikel (Føtex, Lidl, 7-Eleven, SuperBrugsen),
//   die keinen konkreten Standort beschreiben.
//
//   Kein Commons-Kategorie-Fallback: eine Kategorie namens „Buka“ oder
//   „Geranium“ enthält alles Mögliche (Dörfer, Blumen, Personen). Lieber kein
//   Bild als ein falsches – die Oberfläche kommt ohne aus und sagt das auch.
//
// Die Wikimedia-APIs erlauben max. 50 Titel pro Anfrage – es wird gebündelt und
// zwischen den Anfragen gewartet (sonst HTTP 429).
import fs from "node:fs";

const UA =
  "kopenhagen-poi-guide/1.0 (https://github.com/frocentus/kopenhagen-pois; static city guide) node-fetch";
const THUMB = 900;
const BATCH = 30;
const MIN_INTERVAL = 1500; // ms zwischen zwei Anfragen, global

/**
 * Wikimedia drosselt hart und antwortet bei zu vielen Anfragen mit HTTP 200 und
 * reinem Text. Deshalb: ein globales Gate (Mindestabstand) plus exponentielle
 * Wartezeit und `maxlag` – sobald die API überlastet meldet, wird erneut versucht.
 */
let lastRequest = 0;
async function gate() {
  const wait = MIN_INTERVAL - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

/** Beschreibungen, die sicher NICHT den gesuchten Ort meinen. */
const BAD_DESC = /\b(gade|vej|stræde|gatan|street|road|station|banegård|metro|tram|bus|kanal|canal|skulptur|skulptur|bust|statue of)\b/i;
/** Orte, bei denen eine Straßen-/Kanal-Beschreibung in Ordnung ist (sie selbst sind eine). */
const STREET_OK = new Set(["nyhavn", "stroget", "kongens-nytorv"]);
/**
 * Maximaler Abstand zwischen Artikel-Koordinate und Ort. Das ist der
 * entscheidende Filter: „Geranium“, „Pluto“, „Alchemist“ oder „Jagger“ sind
 * mehrdeutige Artikelnamen (Blume, Zwergplanet, Alchemie, Katze) – deren
 * Koordinaten liegen nicht in Kopenhagen und werden damit verworfen.
 */
const MAX_ARTICLE_DIST = 500; // Meter

function haversine(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 0; attempt < 8; attempt++) {
    await gate();
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    } catch (err) {
      await sleep(4000 * (attempt + 1));
      continue;
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (err) {
      json = null;
    }
    if (res.status === 429 || json === null || (json && json.error && json.error.code === "maxlag")) {
      await sleep(6000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      if (attempt === 7) throw new Error("HTTP " + res.status + " für " + url);
      await sleep(4000 * (attempt + 1));
      continue;
    }
    return json;
  }
  throw new Error("Keine gültige JSON-Antwort (dauerhaft gedrosselt) für " + url);
}

function q(base, params) {
  let url;
  try {
    url = new URL(base);
  } catch (err) {
    throw new Error("Ungültige Basis-URL: " + err.message);
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("maxlag", "5");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.href;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/**
 * Lead-Bilder + Artikelkoordinaten für eine Liste von Titeln, gebündelt.
 *
 * Wichtig: `prop=coordinates` liefert seine Ergebnisse paginiert (der Server
 * schickt ein `continue`-Objekt, auch wenn alle Titel in einer Anfrage passen).
 * Ohne das Nachfassen fehlen die Koordinaten für den Großteil der Artikel –
 * und damit würde der Ortsabgleich fast alles verwerfen.
 */
async function wikipediaImages(lang, titles) {
  const found = new Map();

  for (const group of chunk(titles, BATCH)) {
    // Seiten über alle Continuation-Runden sammeln (pageid -> page)
    const pages = new Map();
    const alias = {};
    let cont = null;

    for (let round = 0; round < 20; round++) {
      const params = {
        action: "query",
        prop: "pageimages|description|coordinates",
        piprop: "thumbnail",
        pithumbsize: String(THUMB),
        titles: group.join("|"),
        redirects: "1",
      };
      if (cont) Object.assign(params, cont);

      const json = await getJson(q(`https://${lang}.wikipedia.org/w/api.php`, params));
      const query = json.query || {};

      for (const r of query.redirects || []) alias[r.from] = r.to;
      for (const n of query.normalized || []) alias[n.from] = n.to;
      for (const page of query.pages || []) {
        const prev = pages.get(page.pageid);
        if (prev) {
          // Folgerunde liefert z. B. nur coordinates nach – zusammenführen
          pages.set(page.pageid, Object.assign({}, prev, page, {
            thumbnail: page.thumbnail || prev.thumbnail,
            description: page.description || prev.description,
            coordinates: page.coordinates || prev.coordinates,
          }));
        } else {
          pages.set(page.pageid, page);
        }
      }

      cont = json.continue || null;
      if (!cont) break;
    }

    for (const title of group) {
      const real = alias[title] || title;
      const page = [...pages.values()].find((p) => p.title === real);
      if (!page || page.missing || !page.thumbnail) continue;
      const coord = (page.coordinates || [])[0];
      found.set(title, {
        page: page.title,
        desc: page.description || null,
        url: page.thumbnail.source,
        lat: coord ? coord.lat : null,
        lon: coord ? coord.lon : null,
      });
    }
  }
  return found;
}

/** Dateiname aus einer Wikimedia-Thumb-URL zurückgewinnen. */
function fileNameFromUrl(url) {
  const clean = url.split("?")[0];
  const tail = clean.split("/").pop() || "";
  // Thumb-URLs tragen ein "960px-"Präfix und Unterstriche statt Leerzeichen.
  // Die Commons-API erwartet den Dateinamen mit Leerzeichen – ohne diese
  // Umsetzung schlägt der Lizenz-Lookup fehl und es bleibt nur der Fallback.
  return decodeURIComponent(tail).replace(/^\d+px-/, "").replace(/_/g, " ");
}

/** Lizenz + Autor für Dateinamen, gebündelt. */
async function fileCredits(fileNames) {
  const out = new Map();
  const titles = [...new Set(fileNames)].map((f) => "File:" + f);
  for (const group of chunk(titles, BATCH)) {
    const json = await getJson(
      q("https://commons.wikimedia.org/w/api.php", {
        action: "query",
        prop: "imageinfo",
        iiprop: "extmetadata|url",
        titles: group.join("|"),
        continue: "",
      }),
    );
    for (const page of (json.query || {}).pages || []) {
      const info = (page.imageinfo || [])[0];
      if (!info) continue;
      const ext = info.extmetadata || {};
      out.set(page.title.replace(/^File:/, ""), {
        author: stripHtml(ext.Artist && ext.Artist.value) || "Wikimedia Commons",
        license: stripHtml(ext.LicenseShortName && ext.LicenseShortName.value) || "siehe Dateiseite",
        page: info.descriptionurl || "https://commons.wikimedia.org/wiki/" + encodeURIComponent(page.title.replace(/ /g, "_")),
      });
    }
  }
  return out;
}

/** Mitglieder einer Commons-Kategorie (nur Dateien). */

async function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
  } catch (err) {
    console.error("data/places.json konnte nicht gelesen werden:", err.message);
    process.exit(1);
  }

  // Immer frisch aufbauen: alte photo-Felder entfernen
  for (const p of data.places) delete p.photo;

  const places = data.places;
  // Kandidaten-Titel pro Ort: expliziter Artikel (falls gepflegt), dann Name,
  // dann Namensvariante ohne Zusatz.
  const candFor = (p) => {
    const list = [];
    if (p.wiki) list.push(p.wiki);
    list.push(p.name);
    const short = p.name.split(/\s+[–-]\s+/)[0].trim();
    if (short && short !== p.name) list.push(short);
    return [...new Set(list)];
  };

  const allTitles = [...new Set(places.flatMap(candFor))];
  const da = await wikipediaImages("da", allTitles);
  const missing = allTitles.filter((t) => !da.has(t));
  const en = missing.length ? await wikipediaImages("en", missing) : new Map();

  const pending = [];
  const rejects = [];

  for (const p of places) {
    let hit = null;
    let rejectReason = null;
    for (const title of candFor(p)) {
      const cand = da.get(title) || en.get(title);
      if (!cand) continue;

      // Kein Koordinatenbezug im Artikel -> Ketten-, Personen- oder Sachartikel
      // (Føtex, Lidl, 7-Eleven, „Alchemist“) -> kein Bild.
      if (cand.lat == null || cand.lon == null) {
        rejectReason = rejectReason || "Artikel „" + cand.page + "“ ohne Ortskoordinate";
        continue;
      }
      const dist = haversine({ lat: p.lat, lon: p.lon }, { lat: cand.lat, lon: cand.lon });
      if (dist > MAX_ARTICLE_DIST) {
        rejectReason = rejectReason || "Artikel „" + cand.page + "“ liegt " + Math.round(dist) + " m entfernt";
        continue;
      }
      // Artikel muss den Ort meinen, nicht eine Straße oder einen Bahnhof
      if (cand.desc && BAD_DESC.test(cand.desc) && !STREET_OK.has(p.id)) {
        rejectReason = rejectReason || "Beschreibung passt nicht: " + cand.desc;
        continue;
      }
      hit = cand;
      break;
    }
    if (hit) {
      p._photoUrl = hit.url;
      p._photoArticle = hit.page;
      pending.push(p);
    } else if (rejectReason) {
      rejects.push({ id: p.id, name: p.name, reason: rejectReason });
    }
  }

  // Lizenzen für alle gefundenen Dateien in einem Rutsch
  const credits = await fileCredits(pending.map((p) => fileNameFromUrl(p._photoUrl)));

  for (const p of pending) {
    const file = fileNameFromUrl(p._photoUrl);
    const c = credits.get(file);
    p.photo = {
      url: p._photoUrl.split("?")[0],
      page: c ? c.page : "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(file.replace(/ /g, "_")),
      author: c ? c.author : null,
      license: c ? c.license : null,
      credit: "Wikipedia · " + p._photoArticle,
    };
    delete p._photoUrl;
    delete p._photoArticle;
  }

  // Orte ohne Artikelbild bleiben bewusst ohne Foto – kein Raten.
  const review = places
    .filter((p) => !p.photo)
    .map((p) => {
      const r = rejects.find((x) => x.id === p.id);
      return { id: p.id, name: p.name, reason: r ? r.reason : "kein Wikipedia-Artikel mit Ortskoordinate" };
    });

  fs.writeFileSync("data/places.json", JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync("data/photo-review.json", JSON.stringify(review, null, 2) + "\n");

  const withPhoto = places.filter((p) => p.photo).length;
  console.log("Bilder gesetzt:", withPhoto, "/", places.length);
  console.log("Ohne Bild:", review.length, "-> data/photo-review.json");
}

main().catch((err) => {
  console.error("Fehler:", err.message);
  process.exit(1);
});
