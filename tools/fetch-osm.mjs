// Query Overpass for exact coordinates / opening_hours / website for a curated name list
import fs from "node:fs";

const BBOX = "55.6590,12.5320,55.7020,12.6130"; // south,west,north,east

const NAMES = [
  // Attraktionen
  "Tivoli", "Tivoli Gardens", "Nyhavn", "Den lille Havfrue", "Amalienborg", "Amalienborg Slot",
  "Rosenborg Slot", "Rundetaarn", "Christiansborg Slot", "Nationalmuseet", "Glyptoteket",
  "Statens Museum for Kunst", "Designmuseum Danmark", "Kongens Have", "Botanisk Have",
  "Frederiks Kirke", "Marmorkirken", "Vor Frue Kirke", "Vor Frelsers Kirke", "Strøget",
  "Kastellet", "Torvehallerne", "Den Sorte Diamant", "Reffen", "Christiansborg",
  "Ny Carlsberg Glyptotek", "Københavns Museum", "Rundetårn",
  // Frühstück / Cafés
  "Grød", "Atelier September", "Democratic Coffee", "Wulff & Konstali", "Hart Bageri",
  "Juno the Bakery", "La Cabra", "Coffee Collective", "Lagkagehuset", "Emmerys",
  "Mad & Kaffe", "Neighbourhood", "Café Dyrehaven", "Sonny", "Baryl", "Kaf' Bar",
  "Studio x Kitchen", "Frenchy", "Cozy", "Amator", "Mirabelle", "Winterspring",
  "Andersen Bakery", "Skt. Peders Bageri", "Café Norden", "Klaus K",
  // Restaurants
  "Noma", "Geranium", "Kadeau", "Barr", "Abri", "Kødbyens Fiskebar", "Fiskebaren",
  "Les Trois Cochons", "Mangia", "Café Victor", "Figaro", "Pluto", "Kanalen",
  "Restaurant Palægade", "Møntergade", "Aamanns", "Schønnemann", "Slotskælderen",
  "Cap Horn", "Skipperkroen", "Kokkeriet", "Formel B", "Høst", "Marchal",
  "Kødbyen", "Bæst", "Kokkenes",
  // Fast food
  "Max Burger", "Burger King", "McDonald's", "Sunset Boulevard", "Gasoline Grill",
  "Dandelion Burger", "Tommi's Burger Joint", "Jagger", "Five Guys", "KFC",
  "Domino's", "Papa John's", "Frankly",
  // Supermärkte / Malls
  "Netto", "Rema 1000", "Føtex", "Irma", "Lidl", "Aldi", "7-Eleven", "SuperBrugsen",
  "Meny", "Coop 365", "Magaard", "Kvikly", "Salling", "Illum", "Magasin du Nord",
  "Fisketorvet", "Fields", "Frederiksberg Center",
];

const q = `[out:json][timeout:180];
(
${NAMES.map((n) => `  nwr["name"="${n}"](${BBOX});`).join("\n")}
);
out center tags;`;

const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "kopenhagen-poi-builder/1.0", Accept: "application/json" },
  body: "data=" + encodeURIComponent(q),
});
if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}
const json = await res.json();
const els = json.elements || [];
console.log("elements:", els.length);

const simplified = els.map((e) => ({
  name: e.tags?.name,
  lat: e.lat ?? e.center?.lat,
  lon: e.lon ?? e.center?.lon,
  type:
    e.tags?.amenity ||
    e.tags?.tourism ||
    e.tags?.shop ||
    e.tags?.leisure ||
    e.tags?.historic ||
    e.tags?.building ||
    "?",
  cuisine: e.tags?.cuisine,
  hours: e.tags?.opening_hours,
  website: e.tags?.website || e.tags?.contact?.website,
  street: [e.tags?.["addr:street"], e.tags?.["addr:housenumber"]].filter(Boolean).join(" "),
  brand: e.tags?.brand,
  wheelchair: e.tags?.wheelchair,
}));
fs.writeFileSync("data/osm-raw.json", JSON.stringify(simplified, null, 1));

const seen = new Set();
for (const s of simplified) {
  const key = s.name + "|" + (s.street || "");
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(
    [s.name, s.type, s.street || "", s.lat?.toFixed(5), s.lon?.toFixed(5), s.hours || "-", s.website || "-"].join(" | "),
  );
}
console.log("unique:", seen.size);
