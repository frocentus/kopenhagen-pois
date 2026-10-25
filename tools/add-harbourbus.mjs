// Ergänzt die Hafenbus-Anleger (Movia 991/992) in der Kategorie "transit" und
// benennt sie passend um – sie enthält jetzt nicht mehr nur Metro und S-Bahn.
//
// Quelle (Okt 2026): OSM-Routenrelationen mit `route=ferry`, `ref=991` bzw.
// `992`, `operator=Movia`. Beide Linien bedienen dieselben acht Anleger in
// entgegengesetzter Richtung:
//   Refshaleøen – Nordre Toldbod – Operaen – Nyhavn – Knippelsbro –
//   Det Kongelige Bibliotek – Bryggebroen – Teglholmen
// Koordinaten aus den OSM-Terminal-Knoten.
//
// Der Hafenbus ist regulärer ÖPNV: Ein normales Einzel-/Zeitticket gilt, es ist
// damit die günstigste Hafenrundfahrt der Stadt. Genau deshalb steht das in den
// Tipps und nicht in einem eigenen Tour-Eintrag.
import fs from "node:fs";

let data;
try {
  data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
} catch (err) {
  console.error("data/places.json konnte nicht gelesen werden:", err.message);
  process.exit(1);
}

// Kategorie umbenennen: sie deckt jetzt drei Verkehrsmittel ab.
const cat = data.categories.find((c) => c.id === "transit");
if (cat) {
  cat.label = "Metro, S-Bahn & Hafenbus";
  cat.short = "Nahverkehr";
}

const SITE_MOVIA = "https://www.moviatrafik.dk/";
const H = {
  hours: null,
  hoursNote:
    "Hafenbus 991/992 (Movia): tagsüber ca. alle 20–30 Min., abends seltener. Ein normales ÖPNV-Ticket gilt – Fahrplan und Abfahrten: rejseplanen.dk.",
};

const STOPS = [
  {
    id: "hb-refshaleoen",
    name: "Refshaleøen (Hafenbus)",
    lat: 55.69092,
    lon: 12.60713,
    area: "Refshaleøen",
    desc:
      "Anleger am Ende der Linie, direkt bei Reffen und den alten Werfthallen. Von hier kommt man ohne Auto auf die Halbinsel – mit dem Bus wäre es ein langer Umweg.",
    tips: ["Für Reffen und die Streetfood-Stände der praktischste Weg vom Zentrum.", "Endstation: der Bus bleibt hier meist einige Minuten stehen."],
  },
  {
    id: "hb-nordre-toldbod",
    name: "Nordre Toldbod (Hafenbus)",
    lat: 55.68817,
    lon: 12.59963,
    area: "Langelinie / Østerbro",
    desc:
      "Anleger am Nordre Toldbod, wenige Minuten von der Kleinen Meerjungfrau und vom Kastell. Der kürzeste Bootsweg zwischen Langelinie und der Innenstadt.",
    tips: ["Für die Kleine Meerjungfrau hier aussteigen – kürzer als über Nyhavn.", "Direkt neben der Anlegestelle liegen die Anleger der Kanaltouren."],
  },
  {
    id: "hb-operaen",
    name: "Operaen (Hafenbus)",
    lat: 55.68151,
    lon: 12.59906,
    area: "Holmen / Operaen",
    desc:
      "Anleger direkt an der Königlichen Oper auf Holmen. Von hier sind es wenige Minuten zur Oper und zum Architekturviertel Forbrændingen.",
    tips: ["Die Oper ist auch von außen sehenswert – Führungen lohnen sich.", "Über die Inderhavnsbroen ist Nyhavn zu Fuß in 10 Minuten erreichbar."],
  },
  {
    id: "hb-nyhavn",
    name: "Nyhavn (Hafenbus)",
    lat: 55.67913,
    lon: 12.59432,
    area: "Nyhavn",
    desc:
      "Der zentralste Anleger: mitten am Nyhavn, an der Nordseite des Kanals. Von hier fährt der Hafenbus nach Refshaleøen und in Richtung Sydhavn.",
    tips: ["Achtung: nicht mit den Kanaltour-Booten verwechseln – der Hafenbus ist gelb.", "Für den Nyhavn selbst ist dieser Anleger der kürzeste Weg vom Wasser."],
  },
  {
    id: "hb-knippelsbro",
    name: "Knippelsbro (Hafenbus)",
    lat: 55.67418,
    lon: 12.58702,
    area: "Slotsholmen / Knippelsbro",
    desc:
      "Anleger an der Knippelsbro, zwischen Innenstadt und Christianshavn. Praktisch für den Weg zur Børsen, zum Schloss Christiansborg und nach Christianshavn.",
    tips: ["Von der Brücke selbst hat man den besten Blick auf den Hafen.", "Zum Schloss Christiansborg sind es fünf Minuten zu Fuß."],
  },
  {
    id: "hb-royal-library",
    name: "Det Kongelige Bibliotek (Hafenbus)",
    lat: 55.67223,
    lon: 12.58071,
    area: "Slotsholmen",
    desc:
      "Anleger am Schwarzen Diamanten, dem gläsernen Anbau der Königlichen Bibliothek. Der fotogenste Halt der Linie – das Gebäude spiegelt sich direkt im Wasser.",
    tips: ["Der Schwarze Diamant ist frei zugänglich, die Wechselausstellungen kosten Eintritt.", "Das Café im Gebäude liegt direkt am Wasser."],
  },
  {
    id: "hb-bryggebroen",
    name: "Bryggebroen (Hafenbus)",
    lat: 55.66193,
    lon: 12.56889,
    area: "Islands Brygge / Vesterbro",
    desc:
      "Anleger an der Bryggebroen, der Fußgänger- und Fahrradbrücke zwischen Vesterbro und Islands Brygge. Von hier ist es ein kurzer Weg zum Hafenbad Islands Brygge.",
    tips: ["Für das Havnebadet Islands Brygge hier aussteigen.", "Die Bryggebroen selbst ist einen Spaziergang wert."],
  },
  {
    id: "hb-teglholmen",
    name: "Teglholmen (Hafenbus)",
    lat: 55.64792,
    lon: 12.55132,
    area: "Sydhavn / Teglholmen",
    desc:
      "Südlicher Endpunkt im neuen Hafenviertel Sydhavn. Von hier sind es wenige Minuten zu den Kanälen von Sluseholmen und zur Badezone Teglholm Brygge.",
    tips: ["Für Sluseholmen und die Badezonen im Sydhavn hier aussteigen.", "Die Strecke dorthin führt an den alten Werften vorbei."],
  },
];

const built = STOPS.map((s) => ({
  id: s.id,
  name: s.name,
  cat: "transit",
  sub: "Hafenbus 991/992 · Anleger",
  lat: s.lat,
  lon: s.lon,
  area: s.area,
  desc: s.desc,
  tips: s.tips,
  website: SITE_MOVIA,
  tags: ["Verkehr", "Hafenbus"],
  src: "OpenStreetMap (Fährrelationen 991/992, Movia) (Okt 2026)",
  hours: H.hours,
  hoursNote: H.hoursNote,
}));

const idxById = new Map(data.places.map((p, i) => [p.id, i]));
let added = 0, updated = 0;
for (const s of built) {
  if (idxById.has(s.id)) { data.places[idxById.get(s.id)] = s; updated++; }
  else { data.places.push(s); idxById.set(s.id, data.places.length - 1); added++; }
}

fs.writeFileSync("data/places.json", JSON.stringify(data, null, 2) + "\n");

const counts = {};
data.places.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
console.log("Hafenbus-Anleger hinzugefügt:", added, "| aktualisiert:", updated);
console.log("Kategorie:", cat?.label, "→", cat?.short);
console.log("Orte gesamt:", data.places.length, "|", JSON.stringify(counts));
