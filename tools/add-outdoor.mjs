// Ergänzt bestehende Gastro-Orte um den Tag "Außenplätze", wenn OSM für den
// Betrieb `outdoor_seating=yes` kennt.
//
// Warum Namens- statt Distanzvergleich: Eine reine Umkreissuche liefert
// plausible, aber falsche Treffer – „Gasoline Grill“ liegt 26 m von „Pluto“
// entfernt, „Democratic Coffee“ 26 m von „Sanku Mini Hot Pot“. Beides sind
// Nachbarn, nicht derselbe Betrieb. Deshalb müssen die Namen zusammenpassen;
// die Distanz dient nur als Plausibilitätsgrenze (max. 120 m).
//
// Orte ohne Treffer bekommen den Tag nicht – lieber kein Merkmal als ein
// erfundenes. Das Skript ist idempotent: es entfernt den Tag zuerst überall.
import fs from "node:fs";

const UA = "kopenhagen-poi-guide/1.0 (https://github.com/frocentus/kopenhagen-pois)";
const BBOX = "55.640,12.510,55.720,12.630";
const TAG = "Außenplätze";
const MAX_DIST = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(q) {
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
      if (a === 5) throw err;
      await sleep(3000 * (a + 1));
    }
  }
  return [];
}

function dist(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Generische Wörter entfernen, damit "Restaurant Kanalen" == "Kanalen" zählt
const GENERIC = /\b(restaurant|restaur|rest|café|cafe|kafé|bar|grill|bageri|bakery|the|den|det|københavn|kbh)\b/g;
function core(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(GENERIC, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function main() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
  } catch (err) {
    console.error("data/places.json konnte nicht gelesen werden:", err.message);
    process.exit(1);
  }

  // idempotent: alten Tag überall entfernen
  for (const p of data.places) {
    if (Array.isArray(p.tags)) p.tags = p.tags.filter((t) => t !== TAG);
  }

  const els = await overpass(`[out:json][timeout:180];
(
  nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|biergarten)$"]["outdoor_seating"="yes"]["name"](${BBOX});
);
out center tags;`);
  console.log("OSM-Betriebe mit Außenplätzen:", els.length);

  const GASTRO = ["restaurant", "fastfood", "breakfast", "cafe"];
  const targets = data.places.filter((p) => GASTRO.includes(p.cat));

  const report = [];
  let tagged = 0;

  for (const p of targets) {
    const pn = core(p.name);
    if (pn.length < 4) continue;

    const cand = els
      .map((e) => ({
        e,
        dist: dist(p, { lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon }),
        on: core(e.tags?.name),
      }))
      .filter((x) => x.dist <= MAX_DIST && x.on.length >= 3)
      .filter((x) => x.on.includes(pn) || pn.includes(x.on))
      .sort((a, b) => b.on.length - a.on.length || a.dist - b.dist);

    if (!cand.length) {
      report.push({ id: p.id, name: p.name, outdoor: false, reason: "kein passender OSM-Betrieb mit outdoor_seating" });
      continue;
    }
    p.tags = [...new Set([...(p.tags || []), TAG])];
    tagged++;
    report.push({ id: p.id, name: p.name, outdoor: true, osm: cand[0].e.tags.name, dist: Math.round(cand[0].dist) });
  }

  fs.writeFileSync("data/places.json", JSON.stringify(data, null, 2) + "\n");
  fs.writeFileSync("data/outdoor-review.json", JSON.stringify(report, null, 2) + "\n");

  console.log(`Tag "${TAG}" gesetzt:`, tagged, "von", targets.length, "Gastro-Orten");
  const withOut = data.places.filter((p) => (p.tags || []).includes(TAG));
  const byCat = {};
  withOut.forEach((p) => (byCat[p.cat] = (byCat[p.cat] || 0) + 1));
  console.log("nach Kategorie:", byCat);
}

main().catch((err) => {
  console.error("Fehler:", err.message);
  process.exit(1);
});
