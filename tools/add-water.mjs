// Fügt Trinkwasserbrunnen als eigene Kategorie hinzu.
//
// Die Brunnen in OSM haben fast nie einen Namen – und brauchen auch keinen:
// Auf der Karte genügt der Marker. Damit die Liste trotzdem lesbar ist, wird
// die Bezeichnung aus der **nächsten benannten Straße, dem Platz oder dem Park**
// abgeleitet (Punkt-zu-Linien-Abstand, nicht Mittelpunkt – eine Straße ist lang,
// ihr Mittelpunkt liegt oft weit weg).
//
// Bei mehreren Brunnen an derselben Stelle wird um das nächstgelegene *andere*
// benannte Objekt ergänzt ("Fælledparken · Nørre Allé"), damit in der Liste
// keine identischen Einträge stehen. Reine Ableitung, keine Erfindung.
//
// Kategorie startet ausgeschaltet (`defaultOff`): über 60 Punkte würden sonst
// die Sehenswürdigkeiten überdecken.
import fs from "node:fs";

const UA = "kopenhagen-poi-guide/1.0 (https://github.com/frocentus/kopenhagen-pois)";
const BBOX = "55.640,12.510,55.720,12.630";
const CENTER = { lat: 55.6761, lon: 12.5683 };
const MAX_RADIUS = 3200;   // Meter vom Zentrum – gleiche Grenze wie bei den Stationen
const LABEL_RADIUS = 150;  // Meter, in denen ein benanntes Objekt gesucht wird
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(q, label) {
  for (let a = 0; a < 6; a++) {
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: "data=" + encodeURIComponent(q),
      });
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (a + 1)); continue; }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return (await res.json()).elements || [];
    } catch (err) {
      if (a === 5) throw new Error(label + ": " + err.message);
      await sleep(3000 * (a + 1));
    }
  }
  return [];
}

const R = 6371000;
const RAD = Math.PI / 180;

function haversine(a, b) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Abstand Punkt → Strecke in Metern (lokale Plattkarte, für 150 m völlig ausreichend). */
function segDist(p, a, b) {
  const cos = Math.cos(p.lat * RAD);
  const px = (p.lon - a.lon) * cos, py = p.lat - a.lat;
  const dx = (b.lon - a.lon) * cos, dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? (px * dx + py * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = px - t * dx, qy = py - t * dy;
  return Math.sqrt(qx * qx + qy * qy) * RAD * R;
}

function featureDist(p, e) {
  if (e.lat != null && e.lon != null) return haversine(p, { lat: e.lat, lon: e.lon });
  const g = e.geometry || [];
  if (!g.length) return Infinity;
  if (g.length === 1) return haversine(p, g[0]);
  let best = Infinity;
  for (let i = 1; i < g.length; i++) best = Math.min(best, segDist(p, g[i - 1], g[i]));
  return best;
}

/** Plätze und Parks sind als Bezeichnung aussagekräftiger als eine cycleway. */
function kindRank(e) {
  const t = e.tags || {};
  if (t.place === "square") return 0;
  if (t.leisure === "park" || t.leisure === "garden") return 1;
  if (t.highway === "pedestrian" || t.highway === "footway") return 2;
  if (t.landuse) return 3;
  return 4;
}

const slug = (s) =>
  String(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
  } catch (err) {
    console.error("data/places.json konnte nicht gelesen werden:", err.message);
    process.exit(1);
  }

  const fountains = (await overpass(`[out:json][timeout:180];
node["amenity"="drinking_water"](${BBOX});
out;`, "Brunnen")).filter((e) => e.lat != null);
  console.log("Brunnen in OSM:", fountains.length);

  const named = await overpass(`[out:json][timeout:300];
node["amenity"="drinking_water"](${BBOX})->.dw;
(
  way(around.dw:${LABEL_RADIUS})["highway"]["name"];
  way(around.dw:${LABEL_RADIUS})["place"="square"]["name"];
  way(around.dw:${LABEL_RADIUS})["leisure"~"^(park|garden)$"]["name"];
  way(around.dw:${LABEL_RADIUS})["landuse"~"^(grass|recreation_ground)$"]["name"];
  node(around.dw:${LABEL_RADIUS})["place"~"^(square|locality)$"]["name"];
);
out geom tags;`, "benannte Objekte");
  console.log("benannte Objekte in Reichweite:", named.length);

  // Für jeden Brunnen: alle benannten Objekte nach Abstand sortiert
  const PREFERRED_WINDOW = 120; // m – in diesem Umkreis hat ein Platz/Park Vorrang

  const prepared = fountains
    .map((f) => ({ f, d: haversine(CENTER, f) }))
    .filter((x) => x.d <= MAX_RADIUS)
    .map(({ f, d }) => {
      const sorted = named
        .map((e) => ({ e, dist: featureDist(f, e), rank: kindRank(e) }))
        .filter((x) => x.dist <= LABEL_RADIUS && x.dist < Infinity)
        .sort((a, b) => a.dist - b.dist || a.rank - b.rank);

      // Aussagekräftigere Bezeichnung bevorzugen: Liegt ein Platz oder Park in
      // der Nähe, gewinnt er gegen eine cycleway oder einen Wirtschaftsweg,
      // auch wenn diese näher liegen. „Motionsplads“ oder eine Service-Straße
      // als Name eines Trinkwasserbrunnens hilft niemandem.
      const nice = sorted.find((x) => x.rank <= 1 && x.dist <= PREFERRED_WINDOW);
      const order = nice ? [nice, ...sorted.filter((x) => x !== nice)] : sorted;

      return { f, distCenter: Math.round(d), sorted: order };
    });

  console.log("im 3,2-km-Radius:", prepared.length);

  // Bezeichnung: nächstes benanntes Objekt
  prepared.forEach((p) => {
    p.label = p.sorted[0] ? p.sorted[0].e.tags.name : "Trinkwasserbrunnen";
  });

  // Kollisionen: gleicher Name mehrfach -> um das nächste *andere* benannte
  // Objekt ergänzen. Auch hier bevorzugt ein Platz/Park, damit als Zusatz nicht
  // "Motionsplads" oder eine Service-Straße landet.
  const counts = {};
  prepared.forEach((p) => (counts[p.label] = (counts[p.label] || 0) + 1));
  for (const p of prepared) {
    if (counts[p.label] < 2) continue;
    const others = p.sorted.filter((x) => x.e.tags.name !== p.label);
    const alt = others.find((x) => x.rank <= 2 && x.dist <= 120) || others[0];
    if (alt) p.name = p.label + " · " + alt.e.tags.name;
  }
  prepared.forEach((p) => (p.name = p.name || p.label));

  // Letzte Absicherung gegen identische Namen (z. B. zwei Brunnen an derselben
  // Ecke ohne zweites benanntes Objekt): laufende Nummer.
  const seen = {};
  for (const p of prepared) {
    const key = p.name;
    seen[key] = (seen[key] || 0) + 1;
    if (seen[key] > 1) p.name = key + " (" + seen[key] + ")";
  }

  // Kategorie
  const CAT = { id: "water", label: "Trinkwasser", short: "Trinkwasser", color: "#0284c7", icon: "🚰", defaultOff: true };
  if (!data.categories.some((c) => c.id === "water")) {
    const i = data.categories.findIndex((c) => c.id === "services");
    data.categories.splice(i < 0 ? data.categories.length : i, 0, CAT);
  }

  // Alte Einträge der Kategorie entfernen (idempotent)
  data.places = data.places.filter((p) => p.cat !== "water");

  const HOURS_NOTE =
    "Öffentlicher Trinkwasserbrunnen der Kommune. Viele Brunnen werden im Winter abgestellt und erst im Frühjahr wieder angeschlossen.";

  for (const p of prepared) {
    const t = p.f.tags || {};
    data.places.push({
      id: "water-" + slug(p.name) + "-" + p.f.id,
      name: p.name,
      cat: "water",
      sub: "Trinkwasserbrunnen",
      lat: p.f.lat,
      lon: p.f.lon,
      area: p.label,
      priceLevel: 0,
      priceText: "Kostenlos",
      hours: null,
      hoursNote: HOURS_NOTE,
      desc:
        "Öffentlicher Trinkwasserbrunnen" +
        (p.label !== "Trinkwasserbrunnen" ? " an " + p.label : "") +
        ". Leitungswasser in Kopenhagen ist bedenkenlos trinkbar – Flasche auffüllen statt kaufen." +
        (t.bottle === "yes" ? " Flaschenabfüllung ist ausgewiesen." : ""),
      tips: [
        "Leitungswasser ist in Dänemark streng kontrolliert und überall trinkbar.",
        "Im Winter sind viele Brunnen abgestellt – dann in Cafés nach Leitungswasser fragen (üblich und kostenlos).",
      ],
      tags: ["Trinkwasser", "Gratis", "Draußen"],
      src: "OpenStreetMap (amenity=drinking_water), Bezeichnung aus der nächsten Straße/Platz (Okt 2026)",
    });
  }

  fs.writeFileSync("data/places.json", JSON.stringify(data, null, 2) + "\n");

  const counts2 = {};
  data.places.forEach((x) => (counts2[x.cat] = (counts2[x.cat] || 0) + 1));
  console.log("Brunnen übernommen:", prepared.length);
  console.log("Orte gesamt:", data.places.length, "|", JSON.stringify(counts2));
  console.log("\nBeispiele:");
  prepared.slice(0, 15).forEach((p) => console.log("  " + p.name));
}

main().catch((err) => {
  console.error("Fehler:", err.message);
  process.exit(1);
});
