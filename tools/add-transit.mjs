// Fügt die Kategorie "Metro & S-Bahn" hinzu: alle Metro- und S-tog-Stationen
// im Innenstadtbereich.
//
// Datenherkunft (Okt 2026), bewusst getrennt geprüft:
//   * Metro-Linien je Station: OSM-Routenrelationen M1/M2/M3/M4 (Mitglieder mit
//     Rolle stop/platform) – nicht geraten.
//   * S-tog-Linien je Station: en.wikipedia „List of Copenhagen S-train
//     stations" (Tabelle Station × Linie, gespeist aus DSB-Daten).
//   * Koordinaten: OSM-Knoten (railway=station bzw. Metro-Halte).
//   * Kein Live-Fahrplan: Rejseplanen verlangt einen accessId (HTTP 400 ohne
//     Token), der in einem öffentlichen Repo offenläge. Stattdessen allgemeine
//     Betriebszeiten und Verweis auf m.dk / dsb.dk / rejseplanen.dk.
//   * Keine Ticketpreise: Die Preisliste von DOT war nicht abrufbar. Lieber
//     keine Zahl als eine geratene – der Preis steht im Ticketautomat.
//
// Die Kategorie startet standardmäßig ausgeschaltet (`defaultOff`), sonst
// überdecken 26 Stationsmarker die Sehenswürdigkeiten.
import fs from "node:fs";

let data;
try {
  data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
} catch (err) {
  console.error("data/places.json konnte nicht gelesen werden:", err.message);
  process.exit(1);
}

// ---------------------------------------------------------------- Kategorie
const CAT = {
  id: "transit",
  label: "Metro & S-Bahn",
  short: "Metro & S",
  color: "#1e3a8a",
  icon: "🚇",
  defaultOff: true,
};

if (!data.categories.some((c) => c.id === "transit")) {
  const i = data.categories.findIndex((c) => c.id === "services");
  data.categories.splice(i < 0 ? data.categories.length : i, 0, CAT);
}

// --------------------------------------------------------------- Betriebszeiten
const H_METRO = {
  hours: "Mo-Su 05:00-24:00",
  hoursNote:
    "Metro M1–M4: ca. 05:00–24:00, in der Nacht auf Samstag und Sonntag durchgehend. Live-Zeiten: m.dk oder rejseplanen.dk.",
};
const H_BOTH = {
  hours: "Mo-Su 05:00-24:00",
  hoursNote:
    "Metro ca. 05:00–24:00 (Fr/Sa durchgehend), S-tog ca. 05:00–00:30 ohne Nachtfahrten unter der Woche. Live-Zeiten: rejseplanen.dk.",
};
const H_STOG = {
  hours: "Mo-Su 05:00-24:00",
  hoursNote:
    "S-tog: ca. 05:00–00:30, keine Nachtfahrten unter der Woche. Live-Zeiten: dsb.dk oder rejseplanen.dk.",
};

const SITE_METRO = "https://m.dk/";
const SITE_DSB = "https://www.dsb.dk/";

/** m: Metro-Linien, s: S-tog-Linien */
const STATIONS = [
  // --- Innenstadt, Metro + S-tog -------------------------------------------
  {
    id: "tx-norreport",
    name: "Nørreport",
    m: ["M1", "M2"],
    s: ["A", "B", "Bx", "C", "E", "H"],
    lat: 55.6838,
    lon: 12.5716,
    area: "Indre By / Nørreport",
    desc:
      "Der wichtigste Umsteigepunkt der Stadt: Metro M1/M2 treffen hier auf alle S-tog-Linien und Regionalzüge, und das mitten in der Innenstadt. Von hier sind es zwei Minuten zum Strøget, vier zum Botanischen Garten.",
    tips: [
      "Der meistfrequentierte Bahnhof Dänemarks – zu Stoßzeiten früh losgehen.",
      "Ausgang „Nørre Voldgade“ für den Botanischen Garten, „Frederiksborggade“ für Torvehallerne.",
      "Umstieg Metro ↔ S-tog ist beschildert und dauert nur wenige Minuten.",
    ],
    ...H_BOTH,
  },
  {
    id: "tx-kongens-nytorv",
    name: "Kongens Nytorv",
    m: ["M1", "M2", "M3", "M4"],
    s: [],
    lat: 55.6792,
    lon: 12.5851,
    area: "Indre By / Kongens Nytorv",
    desc:
      "Die einzige Station mit allen vier Metrolinien: M1, M2, M3 und M4 halten hier unter dem Platz. Ideal für Nyhavn (5 Min. zu Fuß), die Königliche Bibliothek und das Shopping rund um Strøget.",
    tips: [
      "Für den Flughafen: M2 Richtung Lufthavnen, ohne Umstieg ca. 15 Min.",
      "Mehrere Ausgänge – für Nyhavn den Ausgang Richtung Store Kongensgade nehmen.",
      "Direkt an der Kongens Nytorv Station steht das Kaufhaus Magasin du Nord.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-raadhuspladsen",
    name: "Rådhuspladsen",
    m: ["M3", "M4"],
    s: [],
    lat: 55.6765,
    lon: 12.5681,
    area: "Indre By / Rådhuspladsen",
    desc:
      "Metro M3 (Cityringen) und M4 halten direkt unter dem Rathausplatz – der kürzeste Weg zu Tivoli, zum Rathaus und in die Fußgängerzone. Auch die Hop-On-Hop-Off-Busse fahren hier ab.",
    tips: [
      "Für Tivoli den Ausgang Richtung Vesterbrogade nehmen – dann steht man direkt am Haupteingang.",
      "Hier treffen sich alle geführten Stadtführungen (Rathautreppe).",
      "Abends ist der Platz ein guter Startpunkt für die Vesterbrogade.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-gammel-strand",
    name: "Gammel Strand",
    m: ["M3", "M4"],
    s: [],
    lat: 55.6776,
    lon: 12.5789,
    area: "Indre By / Gammel Strand",
    desc:
      "Kleine Station am Kanal, zwischen Strøget und Schloss Christiansborg. Von hier sind es drei Minuten zur Kanaltour an Ved Stranden und fünf zum Schloss.",
    tips: [
      "Für die Kanaltouren ist dies die nächste Station – die Boote legen am Ved Stranden ab.",
      "Der Kanalabschnitt davor ist im Sommer einer der schönsten Plätze der Stadt.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-marmorkirken",
    name: "Marmorkirken",
    m: ["M3", "M4"],
    s: [],
    lat: 55.6851,
    lon: 12.5891,
    area: "Frederiksstaden",
    desc:
      "Station direkt an der Marmorkirche und am Schloss Amalienborg. Der Ausstieg für die Wachablösung, die Designmuseum-Ecke und den Weg zur Kleinen Meerjungfrau.",
    tips: [
      "Die Kuppel der Marmorkirche ist gegen Eintritt besteigbar – die Station liegt direkt davor.",
      "Bis zur Kleinen Meerjungfrau sind es zu Fuß etwa 15 Minuten über Langelinie.",
      "Die Wachablösung zieht gegen 12:00 über den Amalienborg-Platz.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-osterport",
    name: "Østerport",
    m: ["M3", "M4"],
    s: ["A", "B", "Bx", "C", "E", "H"],
    lat: 55.6931,
    lon: 12.5888,
    area: "Østerbro / Østerport",
    desc:
      "Umstieg zwischen Metro M3/M4 und dem gesamten S-tog-Netz am östlichen Rand der Innenstadt. Von hier ist es der kürzeste Weg zur Kleinen Meerjungfrau und zum Kastell.",
    tips: [
      "Für die Kleine Meerjungfrau die nächste Station statt Amalienborg nehmen – kürzerer Weg.",
      "Züge nach Helsingør/Schweden halten ebenfalls hier.",
      "Der Kiosk im Bahnhofsgebäude ist einer der wenigen, der früh öffnet.",
    ],
    ...H_BOTH,
  },
  {
    id: "tx-kobenhavn-h",
    name: "København H (Hauptbahnhof)",
    m: ["M3", "M4"],
    s: ["A", "B", "Bx", "C", "E", "H"],
    lat: 55.6725,
    lon: 12.5654,
    area: "Vesterbro / København H",
    desc:
      "Der Hauptbahnhof: Ankunft vom Flughafen, aus Schweden und aus ganz Dänemark, dazu Metro M3/M4 und alle S-tog-Linien. Gepäckschließfächer, Wechselstuben und Geschäfte liegen in der Haupthalle.",
    tips: [
      "Schließfächer Richtung Istedgade/Reventlowsgade – Münzen oder Karte bereithalten.",
      "Vorsicht mit Taxis vor dem Haupteingang: die offiziellen Stände sind beschildert.",
      "Zur Metro M3/M4 dem Symbol folgen – der Weg führt unter die Gleishalle.",
    ],
    website: SITE_DSB,
    ...H_BOTH,
  },
  // --- Cityringen (M3) -----------------------------------------------------
  {
    id: "tx-norrebro",
    name: "Nørrebro",
    m: ["M3"],
    s: ["F"],
    lat: 55.7000,
    lon: 12.5380,
    area: "Nørrebro",
    desc:
      "Halt von Metro M3 und der S-tog-Ringlinie F am Rand von Nørrebro – der praktischste Einstieg für Jægersborggade, Assistens Kirkegård und die multikulturelle Einkaufsstraße Nørrebrogade.",
    tips: [
      "Die S-tog-Ringlinie F fährt alle 5 Minuten – die dichteste Taktung der Stadt.",
      "Zur Jægersborggade (Coffee Collective, kleine Designläden) sind es ca. 10 Minuten zu Fuß.",
      "Nørrebrogade ist die beste Straße der Stadt für günstiges Essen.",
    ],
    ...H_BOTH,
  },
  {
    id: "tx-trianglen",
    name: "Trianglen",
    m: ["M3"],
    s: [],
    lat: 55.6993,
    lon: 12.5755,
    area: "Østerbro / Trianglen",
    desc:
      "Station am Triangle-Platz mit den meisten Bäckereien und Cafés von Østerbro – der lebendige Mittelpunkt des Viertels, mit dem Fælledparken direkt daneben.",
    tips: [
      "Rund um den Trianglen liegen einige der besten Bäckereien der Stadt.",
      "Der Østre Anlæg-Park und das Statens Museum for Kunst sind 10 Minuten entfernt.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-norrebro-runddel",
    name: "Nørrebros Runddel",
    m: ["M3"],
    s: [],
    lat: 55.6935,
    lon: 12.5490,
    area: "Nørrebro / Assistens",
    desc:
      "Direkt am Assistens Kirkegård, dem Parkfriedhof, auf dem Hans Christian Andersen und Søren Kierkegaard liegen. Im Sommer ist er der grüne Aufenthaltsraum des Viertels.",
    tips: [
      "Der Friedhof ist frei zugänglich und verhält sich wie ein Park – Picknick erlaubt.",
      "Hans Christian Andersens Grab liegt im östlichen Teil, ausgeschildert.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-nuuks-plads",
    name: "Nuuks Plads",
    m: ["M3"],
    s: [],
    lat: 55.6885,
    lon: 12.5426,
    area: "Nørrebro / Stefansgade",
    desc:
      "Ruhige Station im Norden von Nørrebro, nahe der Stefansgade mit ihren Cafés und dem Jægersborggade-Kiez auf der anderen Seite.",
    tips: ["Für die Stefansgade und die Jægersborggade die beste Station."],
    ...H_METRO,
  },
  {
    id: "tx-aksel-mollers-have",
    name: "Aksel Møllers Have",
    m: ["M3"],
    s: [],
    lat: 55.6860,
    lon: 12.5330,
    area: "Frederiksberg",
    desc:
      "Station am Rand von Frederiksberg, nahe dem Sankt Thomas Plads und dem schattigen Frederiksberg Allé, der schönsten Allee der Stadt.",
    tips: ["Der Frederiksberg Allé ist im Sommer die angenehmste Verbindung nach Vesterbro."],
    ...H_METRO,
  },
  {
    id: "tx-frederiksberg",
    name: "Frederiksberg",
    m: ["M1", "M2", "M3"],
    s: [],
    lat: 55.6812,
    lon: 12.5318,
    area: "Frederiksberg",
    desc:
      "Umstieg zwischen M1, M2 und M3 mitten in Frederiksberg, nahe der Einkaufsstraße Frederiksberg Allé und dem Stadtteilzentrum Falkoner Allé.",
    tips: ["Drei Linien an einem Bahnsteig – hier ist der Umstieg zwischen M1/M2 und M3 am schnellsten."],
    ...H_METRO,
  },
  {
    id: "tx-frederiksberg-alle",
    name: "Frederiksberg Allé",
    m: ["M3"],
    s: [],
    lat: 55.6735,
    lon: 12.5407,
    area: "Frederiksberg / Vesterbro",
    desc:
      "Station an der Grenze zwischen Frederiksberg und Vesterbro, praktisch für die Frederiksberg Allé und die ruhigeren Wohnstraßen westlich der Innenstadt.",
    tips: ["Von hier lässt sich der Weg nach Vesterbro über die Allee zu Fuß gehen."],
    ...H_METRO,
  },
  {
    id: "tx-engehave-plads",
    name: "Enghave Plads",
    m: ["M3"],
    s: [],
    lat: 55.6673,
    lon: 12.5468,
    area: "Vesterbro",
    desc:
      "Station am Enghave Plads, mitten im Wohnviertel Vesterbro – nahe der Istedgade, den Bars der Sønder Boulevard und dem Kødbyen-Ausgehviertel.",
    tips: [
      "Abends eine der besten Stationen für Vesterbro: Kødbyen und Sønder Boulevard sind zu Fuß erreichbar.",
      "Sonntags findet am Enghave Plads ein kleiner Markt statt.",
    ],
    ...H_METRO,
  },
  // --- M1/M2 / M4 ----------------------------------------------------------
  {
    id: "tx-forum",
    name: "Forum",
    m: ["M1", "M2"],
    s: [],
    lat: 55.6818,
    lon: 12.5525,
    area: "Frederiksberg / Indre By",
    desc:
      "Station am Forum-Gebäude zwischen Innenstadt und Frederiksberg, an der Nordspitze der Seen. Praktisch für Veranstaltungen im Forum und für den Weg zum Sankt Jørgens Sø.",
    tips: [
      "Für Rundetårn und Strøget ist Nørreport eine Station weiter praktischer.",
      "Die Seen (Sankt Jørgens Sø) beginnen direkt hinter der Station – gut für einen Spaziergang.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-christianshavn",
    name: "Christianshavn",
    m: ["M1", "M2"],
    s: [],
    lat: 55.6721,
    lon: 12.5913,
    area: "Christianshavn",
    desc:
      "Metro M1/M2 am Christianshavns Torv – der Einstieg für Christiania, die Kanäle von Christianshavn und den Turm der Erlöserkirche. Die Red-Sightseeing-Busse halten ebenfalls hier.",
    tips: [
      "Der Turm der Vor Frelsers Kirke ist ca. 10 Minuten zu Fuß entfernt.",
      "In Christiania auf der Pusher Street nicht fotografieren.",
      "Für Reffen weiter mit dem Bus oder dem Fahrrad über die Inderhavnsbroen.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-islands-brygge",
    name: "Islands Brygge",
    m: ["M1"],
    s: [],
    lat: 55.6634,
    lon: 12.5851,
    area: "Islands Brygge",
    desc:
      "Station der Linie M1 auf Islands Brygge, nahe dem kostenlosen Hafenbad und der Bryggebroen, über die man zu Fuß nach Vesterbro läuft.",
    tips: [
      "Im Sommer ist das Hafenbad Islands Brygge das beste kostenlose Bad der Stadt.",
      "Über die Bryggebroen geht man in 10 Minuten nach Vesterbro.",
    ],
    ...H_METRO,
  },
  {
    id: "tx-havneholmen",
    name: "Havneholmen",
    m: ["M4"],
    s: [],
    lat: 55.6610,
    lon: 12.5593,
    area: "Vesterbro / Havneholmen",
    desc:
      "Neue M4-Station im Hafenquartier Havneholmen, zwischen Fisketorvet und dem Wasser. Der schnellste Weg vom Zentrum zum Einkaufszentrum Fisketorvet.",
    tips: ["Für Fisketorvet hier aussteigen statt am Hauptbahnhof."],
    ...H_METRO,
  },
  {
    id: "tx-engehave-brygge",
    name: "Enghave Brygge",
    m: ["M4"],
    s: [],
    lat: 55.6541,
    lon: 12.5564,
    area: "Vesterbro / Sydhavn",
    desc:
      "M4-Station im neuen Hafenviertel Enghave Brygge, an der Südspitze von Vesterbro. Von hier führt der Weg am Wasser entlang nach Sydhavn.",
    tips: ["Noch ein Neubauviertel – wenig Infrastruktur, aber gute Spazierwege am Wasser."],
    ...H_METRO,
  },
  {
    id: "tx-dr-byen",
    name: "DR Byen",
    m: ["M1"],
    s: [],
    lat: 55.6558,
    lon: 12.5889,
    area: "Ørestad / DR Byen",
    desc:
      "M1-Station am Rundfunkhaus DR Byen. Interessant für alle, die dem Konzerthaus und der Architektur von Jean Nouvel einen Besuch abstatten wollen.",
    tips: ["Das DR-Konzerthaus bietet Führungen und abends Konzerte."],
    ...H_METRO,
  },
  {
    id: "tx-amagerbro",
    name: "Amagerbro",
    m: ["M2"],
    s: [],
    lat: 55.6633,
    lon: 12.6029,
    area: "Amager / Amagerbro",
    desc:
      "M2-Station auf Amager, an der Amagerbrogade – dem lebendigen Einkaufs- und Wohnviertel mit vielen günstigen Restaurants.",
    tips: ["Auf der Amagerbrogade gibt es die günstigste gute Küche der Stadt."],
    ...H_METRO,
  },
  // --- S-tog im Zentrum ----------------------------------------------------
  {
    id: "tx-vesterport",
    name: "Vesterport",
    m: [],
    s: ["A", "B", "Bx", "C", "E", "H"],
    lat: 55.6758,
    lon: 12.5624,
    area: "Indre By / Vesterport",
    desc:
      "S-tog-Station direkt hinter dem Tivoli und dem Hauptbahnhof, alle Linien der westlichen Achse halten hier. Praktisch, wenn man vom Bahnhof kommt und in die Innenstadt will, ohne die Gleise zu queren.",
    tips: [
      "Für Tivoli ist dies der kürzeste S-tog-Halt.",
      "Von hier sind es fünf Minuten zu Fuß zum Rathausplatz.",
    ],
    website: SITE_DSB,
    ...H_STOG,
  },
  {
    id: "tx-dybbolsbro",
    name: "Dybbølsbro",
    m: [],
    s: ["A", "B", "Bx", "C", "E", "H"],
    lat: 55.6651,
    lon: 12.5596,
    area: "Vesterbro / Kødbyen",
    desc:
      "S-tog-Halt an der Grenze zu Kødbyen – alle westlichen Linien halten hier. Der Ausstieg für das Ausgehviertel mit Fiskebar, Bæst und Warpigs.",
    tips: [
      "Für Kødbyen und die Bars am Sønder Boulevard ist dies der nächste Bahnhalt.",
      "Auch der Weg zur Bryggebroen und nach Islands Brygge beginnt hier.",
    ],
    website: SITE_DSB,
    ...H_STOG,
  },
  {
    id: "tx-carlsberg",
    name: "Carlsberg",
    m: [],
    s: ["B", "Bx", "C", "H"],
    lat: 55.6635,
    lon: 12.5362,
    area: "Valby / Carlsberg",
    desc:
      "S-tog-Station auf dem ehemaligen Brauereigelände Carlsberg, zwischen Valby und Vesterbro. Von hier sind es wenige Minuten zum Besucherzentrum der Brauerei.",
    tips: [
      "Für die Brauereiführung hier aussteigen, nicht am Hauptbahnhof.",
      "Die Station liegt mitten im neuen Viertel auf dem Brauereigelände.",
    ],
    website: SITE_DSB,
    ...H_STOG,
  },
  {
    id: "tx-sydhavn",
    name: "Sydhavn",
    m: [],
    s: ["A", "E"],
    lat: 55.6549,
    lon: 12.5376,
    area: "Sydhavn",
    desc:
      "S-tog-Halt im neuen Hafenviertel Sydhavn, an dem die Stadt gerade massiv wächst. Für Besucher vor allem als Verbindung zu den Kanälen und den Wohnprojekten am Wasser interessant.",
    tips: ["Noch im Aufbau – Cafés und Läden sind hier noch dünn gesät."],
    website: SITE_DSB,
    ...H_STOG,
  },
];

// ------------------------------------------------------------------ Aufbauen
function subLabel(st) {
  const parts = [];
  if (st.m.length) parts.push("Metro " + st.m.join("+"));
  if (st.s.length) parts.push("S-tog " + st.s.join(", "));
  return parts.join(" · ");
}

function tagsFor(st) {
  const t = ["Verkehr"];
  if (st.m.length) t.push("Metro");
  if (st.s.length) t.push("S-tog");
  if (st.m.length && st.s.length) t.push("Umstieg");
  return t;
}

const built = STATIONS.map((st) => {
  const rec = {
    id: st.id,
    name: st.name,
    cat: "transit",
    sub: subLabel(st),
    lat: st.lat,
    lon: st.lon,
    area: st.area,
    desc: st.desc,
    tips: st.tips,
    website: st.website || (st.m.length ? SITE_METRO : SITE_DSB),
    tags: tagsFor(st),
    src: "OpenStreetMap (Metro-Relationen) · Wikipedia/DSB (S-tog-Linien) (Okt 2026)",
    hours: st.hours,
    hoursNote: st.hoursNote,
  };
  return rec;
});

// Alte Doppel-Einträge aus "services" entfernen – sie sind jetzt in transit
// enthalten (mit Linien, Umstieg und Betriebszeiten).
const OLD_STATION_IDS = ["norreport-station", "kongens-nytorv-station", "hovedbanegaarden"];
const removed = [];
data.places = data.places.filter((p) => {
  const drop = OLD_STATION_IDS.includes(p.id);
  if (drop) removed.push(p.name);
  return !drop;
});

// Upsert
const idxById = new Map(data.places.map((p, i) => [p.id, i]));
let added = 0, updated = 0;
for (const s of built) {
  if (idxById.has(s.id)) { data.places[idxById.get(s.id)] = s; updated++; }
  else { data.places.push(s); idxById.set(s.id, data.places.length - 1); added++; }
}

fs.writeFileSync("data/places.json", JSON.stringify(data, null, 2) + "\n");

const counts = {};
data.places.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
console.log("hinzugefügt:", added, "| aktualisiert:", updated, "| entfernt:", removed.join(", ") || "-");
console.log("Orte gesamt:", data.places.length);
console.log(counts);
