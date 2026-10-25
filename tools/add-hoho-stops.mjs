// Fügt die Haltestellen der Hop-On-Hop-Off-Busse als eigene Kategorie hinzu.
//
// Quellen (Okt 2026):
//   * Red Sightseeing – vollständige Stoppliste 1–18 von redsightseeing.com,
//     inkl. Betriebszeiten: Mo–So ab 09:00, letzte Abfahrt ab Central Station/
//     Tivoli 16:00, Takt 30–60 Min.
//   * Stromma / City Sightseeing – Stopps 1 (Ved Stranden/City Center),
//     2 (Nyhavn), 5 (Little Mermaid), 9 (Rosenborg/SMK), 12 (Tivoli) aus
//     stromma.com/gps-map; erste Abfahrt Tivoli 09:30, Ved Stranden 10:00,
//     letzte volle Runde 15:35 (Tivoli) bzw. 16:00 (Ved Stranden).
//
// Nicht aufgenommen: reine Hotel-/Terminal-Halte (Wake Up/Tivoli Hotel,
// Marriott/Kalvebod, Ocean Pier), Halte am Stadtrand (Indiakaj, Copenhagen Zoo)
// und Halte, die nur wenige Meter von einem bereits erfassten entfernt liegen
// (Langelinie, Schwedische Kirche). Der Datensatz deckt das Zentrum ab.
//
// Koordinaten: jeweils die zugehörige Sehenswürdigkeit (verifiziert über OSM
// bzw. aus data/places.json). Die Haltestelle selbst liegt an der Straße
// daneben – das steht in jedem Eintrag, damit der Marker nicht mehr Präzision
// vortäuscht, als vorhanden ist.
import fs from "node:fs";

let data;
try {
  data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
} catch (err) {
  console.error("data/places.json konnte nicht gelesen werden:", err.message);
  process.exit(1);
}

// ---------------------------------------------------------------- Kategorie
const CAT_STOPS = {
  id: "hoho",
  label: "Hop-On-Hop-Off Haltestellen",
  short: "Haltestellen",
  color: "#4d7c0f",
  icon: "🚏",
};

if (!data.categories.some((c) => c.id === "hoho")) {
  const i = data.categories.findIndex((c) => c.id === "tour");
  data.categories.splice(i < 0 ? data.categories.length : i + 1, 0, CAT_STOPS);
}

// ------------------------------------------------------------ Betriebszeiten
const HOURS_RED = {
  hours: "Mo-Su 09:00-16:00",
  hoursNote:
    "Red Sightseeing: erste Abfahrt 09:00, letzte Abfahrt ab Central Station/Tivoli 16:00, Takt 30–60 Min. Genaue Zeiten tagesaktuell beim Anbieter.",
};
const HOURS_STROM = {
  hours: "Mo-Su 09:00-16:00",
  hoursNote:
    "Stromma: erste Abfahrt ab Tivoli 09:30, ab Ved Stranden 10:00; letzte volle Runde 15:35 bzw. 16:00. Red Sightseeing fährt ab 09:00, letzte Abfahrt 16:00. Zeiten tagesaktuell prüfen.",
};
const HOURS_STROM_ONLY = {
  hours: "Mo-Su 10:00-16:00",
  hoursNote:
    "Stromma: erste Abfahrt 10:00, letzte volle Runde 16:00. Takt und Saisonzeiten tagesaktuell beim Anbieter prüfen.",
};

const SITE_STROM = "https://www.stromma.com/en-dk/copenhagen/sightseeing/sightseeing-by-bus/hop-on-hop-off/";
const SITE_RED = "https://www.redsightseeing.com/copenhagen/our-tours/hop-on-hop-off-bus/";

const MARKER_NOTE = "Der Marker steht am zugehörigen Ziel; die Haltestelle liegt an der Straße direkt daneben.";

const STOPS = [
  {
    id: "hoho-raadhuspladsen",
    name: "Rådhuspladsen / Tivoli",
    cat: "hoho",
    sub: "Haltestelle · Stromma + Red",
    lat: 55.6758,
    lon: 12.5691,
    area: "Indre By / Rådhuspladsen",
    desc:
      "Wichtigster Einstiegspunkt für beide Anbieter, zwischen Rathaus, Tivoli und Hauptbahnhof. Stromma hält hier als Stopp 12 („Tivoli“), Red Sightseeing als Stopp 1 (Central Station/Tivoli Gardens) und Stopp 17 (Latin Quarter/City Hall Square). Wer nur eine Runde fahren will, steigt hier ein und wieder aus. " +
      MARKER_NOTE,
    tips: [
      "Beide Anbieter halten hier – zum Vergleichen der Busse ideal.",
      "Von der Bahnhofsseite kommend liegt der Einstieg direkt am Tivoli-Haupteingang.",
      "Erste Abfahrt morgens bzw. letzte Rückkehr hier nachfragen: ab diesem Stopp fährt der Bus zuletzt.",
    ],
    website: SITE_STROM,
    tags: ["Bus", "Haltestelle", "Zentral"],
    src: "stromma.com · redsightseeing.com (Okt 2026)",
    ...HOURS_STROM,
  },
  {
    id: "hoho-ved-stranden",
    name: "Ved Stranden / Strøget",
    cat: "hoho",
    sub: "Haltestelle · Stromma (Stopp 1)",
    lat: 55.67759,
    lon: 12.58048,
    area: "Indre By / Ved Stranden",
    desc:
      "Startpunkt der Stromma-Runde am Kanal, zwischen Strøget und Schloss Christiansborg – derselbe Platz, an dem auch die Kanaltouren ablegen. Wer vom Zentrum aus startet, spart sich den Weg zum Rathausplatz. " +
      MARKER_NOTE,
    tips: [
      "Kombi aus Bus und Kanaltour lässt sich hier ohne Wechsel des Platzes machen.",
      "Erste Abfahrt erst 10:00 – morgens ist am Rathausplatz mehr los.",
    ],
    website: SITE_STROM,
    tags: ["Bus", "Haltestelle", "Zentral"],
    src: "stromma.com (Okt 2026)",
    ...HOURS_STROM_ONLY,
  },
  {
    id: "hoho-nyhavn",
    name: "Nyhavn",
    cat: "hoho",
    sub: "Haltestelle · Stromma + Red",
    lat: 55.67962,
    lon: 12.59042,
    area: "Nyhavn",
    desc:
      "Halt an der Nordseite des Nyhavn: Stromma Stopp 2, Red Sightseeing Stopp 8. Von hier sind es wenige Minuten zu Fuß zu Kongens Nytorv, zum Schloss Amalienborg und zu den Kanaltouren. " +
      MARKER_NOTE,
    tips: [
      "Vor 10 Uhr ist der Nyhavn noch leer – früher Halt lohnt für Fotos ohne Menschen.",
      "Der Übergang zu den Kanaltouren ist hier am kürzesten.",
    ],
    website: SITE_STROM,
    tags: ["Bus", "Haltestelle", "Zentral", "Nyhavn"],
    src: "stromma.com · redsightseeing.com (Okt 2026)",
    ...HOURS_STROM,
  },
  {
    id: "hoho-amalienborg",
    name: "Amalienborg",
    cat: "hoho",
    sub: "Haltestelle · Red (Stopp 9)",
    lat: 55.6832,
    lon: 12.58939,
    area: "Frederiksstaden",
    desc:
      "Red Sightseeing Stopp 9 direkt am Schlossplatz von Amalienborg. Wer die Wachablösung (täglich Mittag) sehen will, steigt hier aus – der Platz ist nur wenige Meter entfernt. " +
      MARKER_NOTE,
    tips: [
      "Die Wachablösung startet gegen 11:30 am Schloss Rosenborg und erreicht Amalienborg um 12:00.",
      "Von hier ist es ein kurzer Spaziergang weiter zur Marmorkirche.",
    ],
    website: SITE_RED,
    tags: ["Bus", "Haltestelle", "Königlich"],
    src: "redsightseeing.com (Okt 2026)",
    ...HOURS_RED,
  },
  {
    id: "hoho-havfrue",
    name: "Den lille Havfrue",
    cat: "hoho",
    sub: "Haltestelle · Stromma + Red",
    lat: 55.69287,
    lon: 12.59929,
    area: "Langelinie / Østerbro",
    desc:
      "Halt an der Kleinen Meerjungfrau: Stromma Stopp 5, Red Sightseeing Stopp 12. Achtung – bei Red Sightseeing ist dieser Halt nicht beschildert; den Ausstiegspunkt vorher in der App prüfen. " +
      MARKER_NOTE,
    tips: [
      "Der Weg über Kastellet und Langelinie ist schöner als der direkte Weg zur Statue.",
      "Morgens stehen hier noch keine Reisebusse.",
    ],
    website: SITE_STROM,
    tags: ["Bus", "Haltestelle", "Gratis"],
    src: "stromma.com · redsightseeing.com (Okt 2026)",
    ...HOURS_STROM,
  },
  {
    id: "hoho-rosenborg",
    name: "Rosenborg / Botanisk Have",
    cat: "hoho",
    sub: "Haltestelle · Stromma + Red",
    lat: 55.68569,
    lon: 12.57743,
    area: "Indre By / Kongens Have",
    desc:
      "Halt am Schloss Rosenborg: Stromma Stopp 9 („Rosenborg Castle/SMK“), Red Sightseeing Stopp 16 (Rosenborg Castle/Botanical Gardens/National Art Gallery). Von hier sind Kongens Have, Botanisk Have und das SMK in wenigen Minuten erreichbar. " +
      MARKER_NOTE,
    tips: [
      "Der Ausgang durch Kongens Have Richtung Nørreport ist der angenehmste Weg zurück.",
      "Für SMK und die Nationalgalerie ist dieser Halt der nächstgelegene.",
    ],
    website: SITE_STROM,
    tags: ["Bus", "Haltestelle", "Museum"],
    src: "stromma.com · redsightseeing.com (Okt 2026)",
    ...HOURS_STROM,
  },
  {
    id: "hoho-christiansborg",
    name: "Christiansborg / Holmens Kirke",
    cat: "hoho",
    sub: "Haltestelle · Red (Stopp 7)",
    lat: 55.67565,
    lon: 12.57906,
    area: "Slotsholmen / Indre By",
    desc:
      "Red Sightseeing Stopp 7 am Schloss Christiansborg, direkt neben der Holmens Kirke. Der Ausstieg für Schloss, Folketing, Børsen und den Turm von Christiansborg. " +
      MARKER_NOTE,
    tips: [
      "Der Schlossturm ist kostenlos und hat die beste Aussicht der Innenstadt.",
      "Von hier sind es zwei Minuten zur Børsen mit ihrem Drachenturm.",
    ],
    website: SITE_RED,
    tags: ["Bus", "Haltestelle", "Zentral"],
    src: "redsightseeing.com (Okt 2026)",
    ...HOURS_RED,
  },
  {
    id: "hoho-glyptoteket",
    name: "Glyptoteket / Nationalmuseum",
    cat: "hoho",
    sub: "Haltestelle · Red (Stopp 2)",
    lat: 55.67253,
    lon: 12.57193,
    area: "Indre By / Rådhuspladsen",
    desc:
      "Red Sightseeing Stopp 2 an der Ny Carlsberg Glyptotek, zwischen Nationalmuseum und Københavns Museum. Der Halt für alle drei Museen – und für den Wintergarten im Glyptotek mit Kuppel und Palmen. " +
      MARKER_NOTE,
    tips: [
      "Dienstags ist der Eintritt ins Glyptotek frei.",
      "Der Innenhof des Glyptotek ist auch ohne Ticket einen Blick wert.",
    ],
    website: SITE_RED,
    tags: ["Bus", "Haltestelle", "Museum"],
    src: "redsightseeing.com (Okt 2026)",
    ...HOURS_RED,
  },
  {
    id: "hoho-islands-brygge",
    name: "Islands Brygge",
    cat: "hoho",
    sub: "Haltestelle · Red (Stopp 5)",
    lat: 55.66712,
    lon: 12.58624,
    area: "Islands Brygge",
    desc:
      "Red Sightseeing Stopp 5 am Radisson Blu Scandinavia Hotel. Von hier ist es ein kurzer Weg zum Hafenbad Islands Brygge und zur Bryggebroen, über die man zu Fuß nach Vesterbro zurückläuft. " +
      MARKER_NOTE,
    tips: [
      "Das Hafenbad ist im Sommer kostenlos – Badezeug mitnehmen.",
      "Über die Bryggebroen lässt sich der Rückweg nach Vesterbro zu Fuß machen.",
    ],
    website: SITE_RED,
    tags: ["Bus", "Haltestelle", "Draußen"],
    src: "redsightseeing.com (Okt 2026)",
    ...HOURS_RED,
  },
  {
    id: "hoho-christianshavn",
    name: "Christianshavn / Christiania",
    cat: "hoho",
    sub: "Haltestelle · Red (Stopp 6)",
    lat: 55.67206,
    lon: 12.5914,
    area: "Christianshavn",
    desc:
      "Red Sightseeing Stopp 6 am Christianshavns Torv – der Ausstieg für Christiania, den Christianshavn-Kanal und den Turm der Erlöserkirche. " +
      MARKER_NOTE,
    tips: [
      "Zum Turm der Vor Frelsers Kirke sind es etwa zehn Minuten zu Fuß.",
      "Fotografieren ist in Christiania auf der Pusher Street nicht erlaubt.",
    ],
    website: SITE_RED,
    tags: ["Bus", "Haltestelle", "Christianshavn"],
    src: "redsightseeing.com (Okt 2026)",
    ...HOURS_RED,
  },
  {
    id: "hoho-kastellet",
    name: "Gefion-Brunnen / Kastellet",
    cat: "hoho",
    sub: "Haltestelle · Red (Stopp 10)",
    lat: 55.68926,
    lon: 12.59757,
    area: "Kastellet / Østerbro",
    desc:
      "Red Sightseeing Stopp 10 („Gefion Waterfountain/Design Museum/The Citadel“) am Gefion-Brunnen, dem größten Springbrunnen der Stadt. Von hier geht man durch die Kastellet-Wallanlagen weiter zur Kleinen Meerjungfrau. " +
      MARKER_NOTE,
    tips: [
      "Der Spaziergang durch Kastellet bis zur Meerjungfrau dauert etwa 15 Minuten.",
      "Das Designmuseum liegt auf der anderen Seite der Straße.",
    ],
    website: SITE_RED,
    tags: ["Bus", "Haltestelle", "Draußen", "Gratis"],
    src: "redsightseeing.com (Okt 2026)",
    ...HOURS_RED,
  },
];

// Upsert statt reines Anhängen: die Einträge sind vollständig abgeleitet,
// deshalb werden vorhandene mit denselben IDs ersetzt. So repariert ein erneuter
// Lauf auch einen fehlerhaften Zwischenstand.
const idxById = new Map(data.places.map((p, i) => [p.id, i]));
let added = 0;
let updated = 0;
for (const s of STOPS) {
  if (idxById.has(s.id)) {
    data.places[idxById.get(s.id)] = s;
    updated++;
  } else {
    data.places.push(s);
    idxById.set(s.id, data.places.length - 1);
    added++;
  }
}

// Die beiden Bus-Touren bekommen die allgemeinen Betriebszeiten nachgetragen –
// sie waren bisher bewusst ohne, weil nur saisonale Texte vorlagen. Die
// Zeitspanne (erste/letzte Abfahrt) ist jetzt belegt.
for (const p of data.places) {
  if (p.id === "hop-on-hop-off-stromma") {
    p.hours = "Mo-Su 09:30-16:00";
    p.hoursNote =
      "Erste Abfahrt ab Tivoli 09:30, ab Ved Stranden 10:00; letzte volle Runde 15:35 bzw. 16:00. Takt ca. alle 30 Min., im Winter kürzer. Sofort ab der ersten Fahrt gültig für 24/48/72 Std. – genaue Zeiten tagesaktuell beim Anbieter.";
  }
  if (p.id === "red-sightseeing") {
    p.hours = "Mo-Su 09:00-16:00";
    p.hoursNote =
      "Erste Abfahrt 09:00, letzte Abfahrt ab Central Station/Tivoli 16:00, Takt 30–60 Min. Eine Runde dauert ca. 90 Min. Genaue Zeiten tagesaktuell beim Anbieter.";
  }
}

fs.writeFileSync("data/places.json", JSON.stringify(data, null, 2) + "\n");

const counts = {};
data.places.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
console.log("Haltestellen hinzugefügt:", added, "| aktualisiert:", updated, "| Orte gesamt:", data.places.length);
console.log(counts);
