// Holt für Orte mit verifiziertem Wikipedia-Artikel die Einleitung
// (2–3 Sätze) und legt sie als `wikiExcerpt` in data/places.json ab.
//
// Warum nicht einfach nach Namen suchen: „Geranium“, „Pluto“, „Alchemist“ und
// „Jagger“ sind mehrdeutige Artikeltitel (Blume, Zwergplanet, Alchemie, Katze).
// Deshalb derselbe Test wie in fetch-photos.mjs – der Artikel muss eine
// Koordinate besitzen, die innerhalb von MAX_DIST zum Ort liegt.
//
// Lizenz: Wikipedia-Texte stehen unter CC BY-SA 4.0. Deshalb werden Titel und
// Artikel-URL mitgespeichert; die Oberfläche verlinkt beides und nennt die
// Lizenz. Die redaktionellen `desc`-Texte bleiben unverändert – die Exzerpte
// sind eine Zusatzebene, kein Ersatz.
import fs from "node:fs";

const UA = "kopenhagen-poi-guide/1.0 (https://github.com/frocentus/kopenhagen-pois)";
const LANG = "de";
const MIN_INTERVAL = 400;
const BATCH = 30;
const MAX_DIST = 500;
const MIN_LEN = 80;
const MAX_LEN = 700;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastReq = 0;
async function gate() {
  const wait = MIN_INTERVAL - (Date.now() - lastReq);
  if (wait > 0) await sleep(wait);
  lastReq = Date.now();
}

async function getJson(url) {
  for (let a = 0; a < 6; a++) {
    await gate();
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    } catch {
      await sleep(2000 * (a + 1));
      continue;
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* Drosselung liefert Text */ }
    if (!json) { await sleep(2500 * (a + 1)); continue; }
    if (!res.ok) {
      if (res.status === 404) return null;
      if (a === 5) throw new Error("HTTP " + res.status + " " + url);
      await sleep(2000 * (a + 1));
      continue;
    }
    return json;
  }
  throw new Error("dauerhaft gedrosselt: " + url);
}

function q(base, params) {
  let url;
  try { url = new URL(base); } catch (e) { throw new Error("ungültige URL: " + e.message); }
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.href;
}

function chunk(a, n) { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

function haversine(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const norm = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").replace(/ß/g, "ss");

/**
 * Taugt der gefundene Artikel überhaupt zum Ort?
 *
 * Die Koordinatenprüfung allein reicht nicht: "Rundetårn" liegt direkt an
 * "Trinitatis Kirke", "Torvehallerne" auf dem "Israel-Platz", "Illum" an der
 * "Strøget" – alle innerhalb von 500 m, alle das falsche Thema. Deshalb muss
 * bei Suchtreffern zusätzlich ein Namensbestandteil im Artikeltitel stecken.
 * Bei direkten Titeltreffern entfällt der Test: dort ist der Name schon der
 * Artikeltitel (ggf. über eine Weiterleitung aufgelöst).
 */
function titleFits(name, title) {
  const t = norm(title);
  const full = norm(name).trim();
  if (full.length >= 5 && t.includes(full)) return true;
  const toks = norm(name).split(/[^a-z0-9]+/).filter((x) => x.length >= 4);
  return toks.some((tok) => t.includes(tok));
}

/** Artikel-Titel + Koordinaten in Bündeln, Continuation wird nachgefasst. */
async function articleCoords(titles) {
  const out = new Map();
  for (const group of chunk(titles, BATCH)) {
    const pages = new Map();
    // angefragter Titel -> tatsächlicher Artikeltitel (Weiterleitungen!)
    const alias = new Map();
    let cont = null;
    for (let round = 0; round < 15; round++) {
      const params = {
        action: "query",
        prop: "coordinates",
        titles: group.join("|"),
        redirects: "1",
      };
      if (cont) Object.assign(params, cont);
      const json = await getJson(q(`https://${LANG}.wikipedia.org/w/api.php`, params));
      const query = json.query || {};
      for (const r of query.redirects || []) alias.set(norm(r.from), r.to);
      for (const n of query.normalized || []) alias.set(norm(n.from), n.to);
      for (const p of query.pages || []) {
        const prev = pages.get(p.pageid);
        pages.set(p.pageid, prev ? { ...prev, ...p, coordinates: p.coordinates || prev.coordinates } : p);
      }
      cont = json.continue || null;
      if (!cont) break;
    }
    const byTitle = new Map();
    for (const p of pages.values()) if (p.title) byTitle.set(norm(p.title), p);

    for (const t of group) {
      // erst direkter Treffer, dann über die Weiterleitung auflösen
      const direct = byTitle.get(norm(t));
      if (direct && !direct.missing) { out.set(t, direct); continue; }
      const target = alias.get(norm(t));
      if (!target) continue;
      const hit = byTitle.get(norm(target));
      if (hit && !hit.missing) out.set(t, hit);
    }
  }
  return out;
}

/** REST-Summary: liefert die Einleitung als Reintext. */
async function summary(title) {
  const url = `https://${LANG}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const json = await getJson(url);
  if (!json) return null;
  if (json.type !== "standard") return null;            // Begriffsklärung o. Ä.
  const text = String(json.extract || "").replace(/\s+/g, " ").trim();
  if (text.length < MIN_LEN) return null;
  const page = json.content_urls?.desktop?.page;
  if (!page) return null;
  return {
    text: text.length > MAX_LEN ? text.slice(0, MAX_LEN).replace(/\s+\S*$/, "") + " …" : text,
    title: json.title || title,
    url: page,
    license: "CC BY-SA 4.0",
    lang: LANG,
  };
}

/** Volltextsuche als Fallback für Artikel mit Klammer-Titel („Tivoli (Kopenhagen)“). */
async function searchTitles(term, limit = 5) {
  const json = await getJson(q(`https://${LANG}.wikipedia.org/w/api.php`, {
    action: "query",
    list: "search",
    srsearch: term,
    srlimit: String(limit),
    srnamespace: "0",
  }));
  return ((json.query || {}).search || []).map((s) => s.title);
}

async function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
  } catch (err) {
    console.error("data/places.json konnte nicht gelesen werden:", err.message);
    process.exit(1);
  }

  for (const p of data.places) delete p.wikiExcerpt;

  // Haltestellen bekommen kein Exzerpt: sie zeigen sonst denselben Wikipedia-Text
  // wie die zugehörige Sehenswürdigkeit. Ihre desc erklärt das Einsteigen.
  // `noWiki` schließt einzelne Orte aus, bei denen der nächstgelegene Artikel ein
  // anderes Thema hat (Restaurant „Nyhavn 17“ -> Artikel über den Kanal).
  const eligible = data.places.filter((p) => p.cat !== "hoho" && !p.noWiki);

  const candFor = (p) => {
    const list = [];
    if (p.wiki) list.push(p.wiki);
    list.push(p.name);
    const short = p.name.split(/\s+[–-]\s+/)[0].trim();
    if (short && short !== p.name) list.push(short);
    return [...new Set(list)];
  };

  const allTitles = [...new Set(eligible.flatMap(candFor))];
  const coords = await articleCoords(allTitles);
  console.log("Artikel mit Koordinate:", coords.size, "von", allTitles.length, "Titeln");

  const verified = [];   // {place, title}
  const rejected = [];
  const needSearch = [];

  for (const p of eligible) {
    let hit = null;
    let why = null;
    for (const title of candFor(p)) {
      const art = coords.get(title);
      if (!art) continue;
      // Ein gepflegtes `wiki` ist geprüft und gilt ohne Koordinatenzwang –
      // „Rundetårn“ etwa hat im Artikel keine Koordinate, ist aber der richtige.
      if (p.wiki && title === p.wiki) { hit = art; break; }
      const c = (art.coordinates || [])[0];
      if (!c) { why = why || `„${art.title}“ ohne Ortskoordinate`; continue; }
      const d = haversine({ lat: p.lat, lon: p.lon }, { lat: c.lat, lon: c.lon });
      if (d > MAX_DIST) { why = why || `„${art.title}“ liegt ${Math.round(d)} m entfernt`; continue; }
      hit = art;
      break;
    }
    if (hit) verified.push({ p, title: hit.title });
    else needSearch.push({ p, why });
  }

  // Fallback: Suche nach "<Name> Kopenhagen", Kandidaten danach wieder über die
  // Koordinate prüfen. Ohne diesen Test würde die Suche z. B. für "Børsen" den
  // Artikel über die dänische Börse allgemein liefern.
  console.log("ohne direkten Treffer, Suche nötig:", needSearch.length);
  const searchHits = new Map();
  for (const { p } of needSearch) {
    try {
      const list = await searchTitles(`${p.name} Kopenhagen`, 5);
      searchHits.set(p.id, list);
    } catch (err) {
      console.log("  Suche fehlgeschlagen:", p.id, err.message);
    }
  }

  const searchTitlesAll = [...new Set([...searchHits.values()].flat())];
  const searchCoords = searchTitlesAll.length ? await articleCoords(searchTitlesAll) : new Map();

  for (const { p, why } of needSearch) {
    const list = searchHits.get(p.id) || [];
    let hit = null;
    for (const title of list) {
      const art = searchCoords.get(title);
      if (!art) continue;
      const c = (art.coordinates || [])[0];
      if (!c) continue;
      if (haversine({ lat: p.lat, lon: p.lon }, { lat: c.lat, lon: c.lon }) > MAX_DIST) continue;
      // Umgebung darf nicht als Thema durchgehen (siehe titleFits)
      if (!titleFits(p.name, art.title)) continue;
      hit = art;
      break;
    }
    if (hit) verified.push({ p, title: hit.title, viaSearch: true });
    else rejected.push({ id: p.id, name: p.name, reason: why || "kein Artikel mit Ortskoordinate" });
  }

  console.log("verifiziert:", verified.length, "| ohne Artikel:", rejected.length);

  let n = 0;
  for (const { p, title } of verified) {
    try {
      const ex = await summary(title);
      if (ex) { p.wikiExcerpt = ex; n++; }
    } catch (err) {
      console.log("  Fehler bei", p.id, err.message);
    }
  }

  fs.writeFileSync("data/places.json", JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync("data/extract-review.json", JSON.stringify(rejected, null, 2) + "\n");

  console.log("Exzerpte gesetzt:", n, "/", eligible.length, "(ohne Haltestellen)");
  console.log("davon über die Suche gefunden:", verified.filter((v) => v.viaSearch).length);
  const byCat = {};
  data.places.filter((p) => p.wikiExcerpt).forEach((p) => (byCat[p.cat] = (byCat[p.cat] || 0) + 1));
  console.log("nach Kategorie:", byCat);
}

main().catch((err) => {
  console.error("Fehler:", err.message);
  process.exit(1);
});
