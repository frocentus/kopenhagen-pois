// Fügt die Kategorie "Hafenbäder & Baden" hinzu.
//
// Quellen (Okt 2026): OSM (`amenity=public_bath`, `leisure=swimming_area` mit
// Namen) für Koordinaten und vorhandene Öffnungszeiten; die Badesaison und die
// Flaggenregel stehen in den Hinweisen. Alle Stellen sind öffentlich und
// kostenlos – das ist in Kopenhagen kommunal geregelt.
//
// Bewusst KEINE Wassertemperatur: Es gibt dafür keine offene API, die ohne Key
// und ohne Backend abrufbar wäre. Statt einer scheinbar Live-Zahl steht ein
// Verweis auf badevand.dk (Landesprognose) und kk.dk (Wasserqualität der
// Kommune) im Eintrag.
import fs from "node:fs";

let data;
try {
  data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
} catch (err) {
  console.error("data/places.json konnte nicht gelesen werden:", err.message);
  process.exit(1);
}

const CAT = {
  id: "swim",
  label: "Hafenbäder & Baden",
  short: "Baden",
  color: "#0891b2",
  icon: "🏊",
};

if (!data.categories.some((c) => c.id === "swim")) {
  const i = data.categories.findIndex((c) => c.id === "attraction");
  data.categories.splice(i < 0 ? data.categories.length : i + 1, 0, CAT);
}

const QUALITY = "https://www.kk.dk/brug-byen/vandet-i-byen/badevandskvalitet";
const FORECAST = "https://badevand.dk/";

const SEASON_NOTE =
  "Badesaison der Hafenbäder ist etwa Juni bis Ende August; außerhalb wird nicht gebadet. Schwimmen nur, wenn die grüne Flagge steht – bei Regen und kurz danach ist die Wasserqualität unsicher.";

const SPOTS = [
  {
    id: "swim-islands-brygge",
    name: "Havnebadet Islands Brygge",
    sub: "Hafenbad · 5 Becken",
    lat: 55.66859,
    lon: 12.57766,
    area: "Islands Brygge",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE + " Wassertemperatur und Qualität: badevand.dk.",
    desc:
      "Das bekannteste Hafenbad der Stadt: fünf Becken unterschiedlicher Tiefe direkt im Hafenbecken, dazu Liegewiesen, Springtürme und eine lange Holzterrasse. Im Sommer der Treffpunkt schlechthin – und kostenlos.",
    tips: [
      "Morgens zwischen 7 und 9 Uhr ist es fast leer.",
      "Es gibt einen abgetrennten Bereich für Kleinkinder – der Sprungturm ist ein eigener Bereich.",
      "Bei Regen wird das Baden oft für 24 Stunden ausgesetzt: Flagge beachten.",
    ],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen", "Familie"],
    src: "OpenStreetMap · Københavns Kommune (Okt 2026)",
  },
  {
    id: "swim-kalvebod-bolge",
    name: "Kalvebod Bølge",
    sub: "Badezone am Hafenrand",
    lat: 55.66895,
    lon: 12.57575,
    area: "Kalvebod Brygge",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE,
    desc:
      "Künstlich angelegte Wellenlandschaft am Kalvebod Brygge, die gleichzeitig als Badestelle und Sitzstufe dient. Direkt hinter dem Einkaufszentrum Fisketorvet, mit Blick über den Hafen.",
    tips: [
      "Der Einstieg ist flach und unauffällig – Badeschuhe sind hier keine schlechte Idee.",
      "Perfekt für eine Pause nach dem Einkauf im Fisketorvet.",
      "Abends liegt die Fläche in der Abendsonne.",
    ],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen"],
    src: "OpenStreetMap · Københavns Kommune (Okt 2026)",
  },
  {
    id: "swim-halfdansgade",
    name: "Halfdansgade Badezone",
    sub: "Badezone im Christianshavn-Kanal",
    lat: 55.66592,
    lon: 12.57421,
    area: "Islands Brygge / Christianshavn",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE,
    desc:
      "Kleine, wenig bekannte Badezone am Kanal zwischen Islands Brygge und Christianshavn. Wer das Gedränge im großen Hafenbad vermeiden will, ist hier oft allein im Wasser.",
    tips: [
      "Deutlich ruhiger als das Havnebadet Islands Brygge.",
      "Der Einstieg ist steil – für unsichere Schwimmer nicht ideal.",
    ],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen"],
    src: "OpenStreetMap (Okt 2026)",
  },
  {
    id: "swim-fisketorvet",
    name: "Havnebadet Fisketorvet",
    sub: "Hafenbad",
    lat: 55.66294,
    lon: 12.56422,
    area: "Vesterbro / Fisketorvet",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE,
    desc:
      "Hafenbad auf der Vesterbro-Seite, direkt am Fisketorvet. Kleiner als Islands Brygge, dadurch überschaubarer – praktisch für alle, die in Vesterbro wohnen oder dort einkaufen.",
    tips: ["Deutlich weniger voll als Islands Brygge.", "Über die Bryggebroen ist Islands Brygge zu Fuß in 15 Minuten erreichbar."],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen", "Familie"],
    src: "OpenStreetMap (Okt 2026)",
  },
  {
    id: "swim-sluseholmen",
    name: "Sluseholmen Havnebad",
    sub: "Hafenbad im Sydhavn",
    lat: 55.6466,
    lon: 12.55394,
    area: "Sydhavn / Sluseholmen",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: "Geöffnet nur 15. Mai bis 15. September; außerhalb ist das Bad geschlossen. Schwimmen nur bei grüner Flagge.",
    desc:
      "Hafenbad im neuen Canal-Viertel Sluseholmen, zwischen den Kanälen und den bunten Reihenhäusern. Wegen der Architektur rundherum eines der fotogensten Bäder der Stadt.",
    tips: [
      "Die Kanäle von Sluseholmen sind selbst einen Spaziergang wert.",
      "Nur in der Saison geöffnet – im Frühjahr steht man vor verschlossener Tür.",
    ],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen"],
    src: "OpenStreetMap · Københavns Kommune (Okt 2026)",
  },
  {
    id: "swim-teglholm",
    name: "Badezone Teglholm Brygge",
    sub: "Badezone",
    lat: 55.65124,
    lon: 12.54553,
    area: "Sydhavn / Teglholm",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE,
    desc:
      "Kleine Badezone an der Teglholm Brygge im Sydhavn, an der Kante zwischen Kanal und Hafen. Unaufgeregt, mit Banken und Blick auf die Brücken.",
    tips: ["Für einen ruhigen Bade-Stopp abseits der großen Becken."],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen"],
    src: "OpenStreetMap (Okt 2026)",
  },
  {
    id: "swim-vandtrappen",
    name: "Vandtrappen Badezone",
    sub: "Badezone · Wassertreppe",
    lat: 55.64802,
    lon: 12.54681,
    area: "Sydhavn",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE,
    desc:
      "Wörtlich „die Wassertreppe“: eine breite Steintreppe, die ins Hafenbecken führt und im Sommer als Badestelle und Tribüne gleichzeitig funktioniert.",
    tips: ["Zum Sonnen und Sitzen oft besser geeignet als zum Schwimmen.", "Abends ein guter Platz für den Sonnenuntergang."],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen"],
    src: "OpenStreetMap (Okt 2026)",
  },
  {
    id: "swim-refshalebassin",
    name: "Søndre Refshalebassin Badezone",
    sub: "Badezone auf Refshaleøen",
    lat: 55.69008,
    lon: 12.60962,
    area: "Refshaleøen",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE,
    desc:
      "Badezone im südlichen Hafenbecken von Refshaleøen, gleich neben den Streetfood-Ständen von Reffen. Kombination aus Schwimmen und Mittagessen ist hier wörtlich möglich.",
    tips: [
      "Lässt sich ideal mit Reffen verbinden – erst baden, dann essen.",
      "Kein Rettungsschwimmer, keine Absperrung: nur bei grüner Flagge ins Wasser.",
    ],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen"],
    src: "OpenStreetMap · Københavns Kommune (Okt 2026)",
  },
  {
    id: "swim-la-banchina",
    name: "La Banchina Badezone",
    sub: "Badezone am Restaurant",
    lat: 55.68942,
    lon: 12.61054,
    area: "Refshaleøen",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE,
    desc:
      "Badestelle direkt an La Banchina, dem kleinen Restaurant mit Holzsteg auf Refshaleøen. Sauna und Sprung ins Hafenbecken gehören hier zum Konzept – der Steg ist aber auch ohne Restaurantbesuch zugänglich.",
    tips: [
      "Die Sauna von La Banchina muss man separat buchen und ist schnell ausgebucht.",
      "Der Holzsteg ist der beste Platz zum Sonnenbaden auf Refshaleøen.",
    ],
    website: "https://www.labanchina.dk/",
    tags: ["Baden", "Gratis", "Draußen"],
    src: "OpenStreetMap (Okt 2026)",
  },
  {
    id: "swim-sandkaj",
    name: "Badezone Sandkaj",
    sub: "Badezone in Nordhavn",
    lat: 55.70625,
    lon: 12.59716,
    area: "Nordhavn",
    priceLevel: 0,
    priceText: "Kostenlos",
    hours: null,
    hoursNote: SEASON_NOTE,
    desc:
      "Badezone im neuen Hafenviertel Nordhavn (Århusgadekvarteret), zwischen den neuen Wohnblocks und dem Kai. Mit dem Hafenbus oder der Metro M4 gut erreichbar.",
    tips: ["Der künstliche Sandstrand ist bei Familien beliebt.", "Mit der Metro M4 bis Nordhavn, dann wenige Minuten zu Fuß."],
    website: QUALITY,
    tags: ["Baden", "Gratis", "Draußen", "Familie"],
    src: "OpenStreetMap (Okt 2026)",
  },
];

const built = SPOTS.map((s) => ({
  id: s.id,
  name: s.name,
  cat: "swim",
  sub: s.sub,
  lat: s.lat,
  lon: s.lon,
  area: s.area,
  priceLevel: s.priceLevel,
  priceText: s.priceText,
  hours: s.hours,
  hoursNote: s.hoursNote,
  desc: s.desc,
  tips: s.tips,
  website: s.website,
  tags: s.tags,
  src: s.src,
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
console.log("Badestellen hinzugefügt:", added, "| aktualisiert:", updated);
console.log("Orte gesamt:", data.places.length, "|", JSON.stringify(counts));
