import fs from "node:fs";
const BBOX = "55.6590,12.5320,55.7020,12.6130";
const H = { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "kopenhagen-poi-builder/1.0", Accept: "application/json" };

async function overpass(q) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: H, body: "data=" + encodeURIComponent(q) });
      if (r.ok) return await r.json();
      console.error("HTTP", r.status);
    } catch (e) {
      console.error("ERR", e.message);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { elements: [] };
}

// 1) Alle Supermärkte / Convenience / Malls / Kaufhäuser im Zentrum
const q1 = `[out:json][timeout:180];
(
  nwr["shop"~"^(supermarket|convenience|department_store|mall|bakery)$"](${BBOX});
);
out center tags;`;
const j1 = await overpass(q1);
const shops = (j1.elements || []).map((e) => ({
  name: e.tags?.name, brand: e.tags?.brand, shop: e.tags?.shop,
  lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon,
  hours: e.tags?.opening_hours,
  street: [e.tags?.["addr:street"], e.tags?.["addr:housenumber"]].filter(Boolean).join(" "),
  website: e.tags?.website || e.tags?.["contact:website"],
}));
fs.writeFileSync("data/osm-shops.json", JSON.stringify(shops, null, 1));
console.log("shops total:", shops.length);
const byShop = {};
for (const s of shops) (byShop[s.shop] ||= []).push(s);
for (const [k, v] of Object.entries(byShop)) {
  console.log("\n##", k, v.length);
  const chains = {};
  for (const s of v) chains[s.name] = (chains[s.name] || 0) + 1;
  console.log("chains:", Object.entries(chains).sort((a, b) => b[1] - a[1]).map(([a, b]) => a + "(" + b + ")").join(", "));
}
const keep = shops.filter((s) => ["supermarket", "department_store", "mall"].includes(s.shop));
console.log("\n== supermarkets/malls with hours ==");
for (const s of keep) console.log([s.name, s.shop, s.street, s.lat?.toFixed(5), s.lon?.toFixed(5), s.hours || "-", s.website || "-"].join(" | "));
