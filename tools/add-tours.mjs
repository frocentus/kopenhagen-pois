// Fügt die Kategorie "Touren & Rundfahrten" hinzu: Hop-On-Hop-Off-Busse,
// Kanaltouren und weitere geführte Touren.
//
// Datenlage (Okt 2026) – bewusst getrennt gehalten:
//   * Preise und Beschreibungen: Betreiberseiten + Aggregatoren (siehe `src`)
//   * Öffnungszeiten: nur wo dokumentiert als `hours` gesetzt, sonst null mit
//     Begründung in `hoursNote`. Erfundene Zeiten wären hier besonders schädlich,
//     weil Touren feste Abfahrtszeiten haben.
//   * Bewertungen: nur echte, zuordenbare Google-Werte. Sonst null + ratingNote.
//
// Wichtig: "City Sightseeing Copenhagen" ist kein zweiter Anbieter, sondern der
// Franchise-Name derselben Stromma-Busse. Deshalb ein Eintrag, nicht zwei.
import fs from "node:fs";

let data;
try {
  data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
} catch (err) {
  console.error("data/places.json konnte nicht gelesen werden:", err.message);
  process.exit(1);
}

// ---------------------------------------------------------------- Kategorie
const CAT_TOUR = {
  id: "tour",
  label: "Touren & Rundfahrten",
  short: "Touren",
  color: "#0e7490",
  icon: "🎫",
};

if (!data.categories.some((c) => c.id === "tour")) {
  // Direkt hinter die Sehenswürdigkeiten: thematisch zusammenhängend,
  // und die Liste gruppiert in dieser Reihenfolge.
  const i = data.categories.findIndex((c) => c.id === "attraction");
  data.categories.splice(i < 0 ? data.categories.length : i + 1, 0, CAT_TOUR);
}

// ------------------------------------------------------------------- Touren
const TOURS = [
  {
    id: "hop-on-hop-off-stromma",
    name: "Hop On-Hop Off Bus (Stromma)",
    cat: "tour",
    sub: "Sightseeing-Bus · 3 Linien",
    lat: 55.6761,
    lon: 12.5689,
    area: "Indre By / Rådhuspladsen",
    rating: 4.0,
    reviews: "78",
    ratingSource: "Google",
    priceLevel: 2,
    priceText: "24 Std. ab 279 DKK · 48/72 Std. gegen Aufpreis · Kinder reduziert",
    hours: null,
    hoursNote:
      "Abfahrten ca. alle 30 Min., Betriebszeiten sind saisonabhängig (im Winter deutlich kürzer). Die Laufzeit beginnt mit der ersten Fahrt und gilt 24, 48 oder 72 Std.",
    desc:
      "Drei Linien mit einem Ticket: „Classic Copenhagen“ (rot) zu den Klassikern, „Colorful Copenhagen“ (lila) nach Nørrebro und Christianshavn sowie „Home of Carlsberg“ (grün) zur Brauerei. Audioguide in 11 Sprachen, Auf- und Abstieg an jedem Stopp beliebig oft. Wird unter dem Namen „City Sightseeing Copenhagen“ identisch verkauft – es sind dieselben Busse.",
    tips: [
      "Ticket erst am ersten Tag aktivieren – die Laufzeit startet mit der ersten Fahrt.",
      "Für den Überblick einmal komplett sitzen bleiben und danach gezielt aussteigen.",
      "Online klar günstiger als beim Einsteigen am Straßenrand.",
    ],
    website: "https://www.stromma.com/en-dk/copenhagen/sightseeing/sightseeing-by-bus/hop-on-hop-off/",
    tags: ["Bus", "Highlight", "Familie", "Reservieren"],
    src: "stromma.com · hop-on-hop-off.net (Okt 2026)",
  },
  {
    id: "red-sightseeing",
    name: "Red Sightseeing Bus",
    cat: "tour",
    sub: "Hop-On-Hop-Off · 22 Stopps",
    lat: 55.67321,
    lon: 12.56553,
    area: "Vesterbro / Rådhuspladsen",
    rating: null,
    ratingNote:
      "Für die Kopenhagener Linie gibt es keine eindeutig zuordenbare Einzelbewertung; Aggregatoren nennen 4,0 – bezogen auf den Anbieter insgesamt, nicht auf diesen Einstieg.",
    priceLevel: 2,
    priceText: "24 Std. ab ca. 220 DKK (30 EUR) · 48 Std. gegen Aufpreis",
    hours: null,
    hoursNote:
      "Eine Runde dauert ca. 90 Min., Frequenz und Saisonzeiten variieren (im Winter eingeschränkt).",
    desc:
      "Roter Doppeldecker mit 22 Stopps, Audio-Guide in mehreren Sprachen und kostenlosem WLAN – die günstigere Alternative zu Stromma, mit etwas älteren Bussen. Das Kombi-Ticket Bus + Boot enthält zusätzlich eine 60-minütige Kanaltour.",
    tips: [
      "Das Kombi-Ticket Bus + Boot deckt beide Klassiker ab und ist günstiger als zwei Einzeltickets.",
      "Stopp 12 an der Kleinen Meerjungfrau ist nicht beschildert – Ausstiegspunkt vorher in der App prüfen.",
      "Die obere Etage ist offen: bei Regen die Sitzplätze unten wählen.",
    ],
    website: "https://www.redsightseeing.com/copenhagen/",
    tags: ["Bus", "Familie", "Reservieren"],
    src: "redsightseeing.com · hop-on-hop-off.net (Okt 2026)",
  },
  {
    id: "kanaltour-stromma",
    name: "Kanalrundfahrt (Stromma)",
    cat: "tour",
    sub: "Kanaltour · 60 oder 105 Min.",
    lat: 55.67759,
    lon: 12.58048,
    area: "Indre By / Ved Stranden",
    rating: 4.5,
    reviews: "3.820",
    ratingSource: "Google",
    priceLevel: 2,
    priceText:
      "Classic 60 Min. 199 DKK (online ab 135 DKK) · Grand Tour 105 Min. gegen Aufpreis · Kinder 6–15 J. ca. 100 DKK",
    hours: "Mo-Su 09:30-17:00",
    hoursNote:
      "Ticketverkauf ab 09:30 bis 15 Min. nach der letzten Abfahrt; letzte Abfahrt je nach Saison früher. Zweiter Ableger: Nyhavn 3.",
    desc:
      "Die klassische Kopenhagener Kanaltour – live erzählt oder per Audioguide. Vorbei an Schloss Christiansborg, der Oper und durch die engen Kanäle von Christianshavn; die Grand Tour fährt zusätzlich hinaus in den Hafen. Die Boote sind überdacht und fahren auch bei Regen.",
    tips: [
      "Bei schlechtem Wetter eine der besten Optionen der Stadt – die Boote sind überdacht.",
      "Für die Fahrt durch den Christianshavn-Kanal außen oder vorne sitzen.",
      "Auf einigen Abfahrten ist die Copenhagen Card inklusive – vorher prüfen, statt doppelt zu zahlen.",
    ],
    website: "https://www.stromma.com/en-dk/copenhagen/sightseeing/sightseeing-by-boat/grand-tour/",
    tags: ["Boot", "Kanal", "Highlight", "Familie", "Regenwetter"],
    src: "stromma.com · VisitCopenhagen (Okt 2026)",
  },
  {
    id: "nettobaadene",
    name: "Nettobådene Kanaltour",
    cat: "tour",
    sub: "Kanaltour · 60 Min.",
    lat: 55.67987,
    lon: 12.59104,
    area: "Nyhavn",
    rating: null,
    ratingNote:
      "Kleinbetrieb ohne belastbare öffentliche Bewertung – zu wenige Rezensionen für einen sinnvollen Vergleich mit den großen Anbietern.",
    priceLevel: 1,
    priceText: "60 Min. 80 DKK · Kinder 3–14 Jahre 40 DKK",
    hours: "Mo-Su 10:00-17:00",
    hoursNote:
      "Abfahrt alle 40 Min.; im Winter (Nov–März) nur ca. 10:20–15:00, dann mit Glasdach und Heizung. Zweiter Ableger Holmens Kirke, im Winter oft nur Nyhavn.",
    desc:
      "Die günstigste Kanaltour der Stadt: blaue Boote, 60 Minuten, live auf Dänisch, Englisch und Deutsch erzählt. Kein Schnickschnack, dafür rund ein Viertel des Preises der großen Anbieter – und dieselbe Strecke durch die Kanäle.",
    tips: [
      "Kein Online-Vorverkauf nötig: einfach am Anleger einsteigen, im Hochsommer 20 Min. vorher da sein.",
      "Der Ableger Holmens Kirke ist meist deutlich leerer als Nyhavn.",
      "Barzahlung und dänische Karten funktionieren; internationale Karten gelegentlich nicht.",
    ],
    website: "https://havnerundfart.dk/canaltours/",
    tags: ["Boot", "Kanal", "Günstig", "Familie"],
    src: "havnerundfart.dk (Okt 2026)",
  },
  {
    id: "heycaptain",
    name: "Hey Captain",
    cat: "tour",
    sub: "Kleine Bootstour · max. 12 Gäste",
    lat: 55.68099,
    lon: 12.5948,
    area: "Indre By / Ofelia Plads",
    rating: null,
    ratingNote:
      "Der Anbieter wirbt mit Spitzenbewertungen, eine belastbare Zahl für die konkrete Tour ließ sich aber keiner Quelle eindeutig zuordnen.",
    priceLevel: 3,
    priceText: "ca. 250–650 DKK pro Person je nach Tourlänge",
    hours: null,
    hoursNote:
      "Nur mit Buchung; mehrere Abfahrten täglich, im Winter reduzierte Zeiten (überdachte Boote, Decken, Warmgetränke).",
    desc:
      "Kleine offene Boote statt großer Ausflugsdampfer: maximal 12 Gäste, der Kapitän erzählt statt eines Tonbandes, und die Route richtet sich nach Wetter und Gruppe. Die persönlichste Variante der Kanaltour – und die einzige, bei der man ins Gespräch kommt.",
    tips: [
      "Die längere „Captains Favourite“ (3 Std.) lohnt sich, wenn man mehr als die Standardrunde sehen will.",
      "Als Gruppe lässt sich das Boot komplett mieten.",
      "Decken sind an Bord – im Herbst trotzdem warm anziehen.",
    ],
    website: "https://www.heycaptain.dk/",
    tags: ["Boot", "Kanal", "Besonders", "Reservieren"],
    src: "heycaptain.dk · VisitCopenhagen (Okt 2026)",
  },
  {
    id: "goboat",
    name: "GoBoat",
    cat: "tour",
    sub: "Selbstfahren & geführte Harbor Tour",
    lat: 55.66911,
    lon: 12.57854,
    area: "Islands Brygge",
    rating: null,
    ratingNote:
      "Bewertungen beziehen sich überwiegend auf den Verleih insgesamt, nicht auf diesen einzelnen Ableger.",
    priceLevel: 2,
    priceText:
      "Selbstfahrer-Boot bis 8 Pers. ab ca. 250 DKK/Std. · geführte „Harbor Tour“ 209 DKK pro Person",
    hours: null,
    hoursNote:
      "Saison ca. April–Oktober. Selbstfahrer-Boote ohne Führerschein nach kurzer Einweisung; die geführte Harbor Tour hat feste Abfahrtszeiten.",
    desc:
      "Solarbetriebene Elektroboote ohne Führerschein: Man steuert selbst durch Hafen und Kanäle und picknickt an Bord. Wer lieber geführt fährt, bucht die „Harbor Tour“ mit Kapitän in kleiner Gruppe (max. 9).",
    tips: [
      "Proviant mitnehmen – an Bord ist Essen erlaubt, an den Anlegern gibt es nichts zu kaufen.",
      "Rückkehrzeit großzügig planen: Die Boote werden nach Zeit abgerechnet, Überziehung wird teuer.",
      "Die Route Richtung Christianshavn ist hübscher als die Hafenrunde nach Norden.",
    ],
    website: "https://goboat.dk/en/copenhagen",
    tags: ["Boot", "Kanal", "Selbstfahren", "Familie", "Draußen"],
    src: "goboat.dk · VisitCopenhagen (Okt 2026)",
  },
  {
    id: "free-walking-tour",
    name: "Free Walking Tour",
    cat: "tour",
    sub: "Stadtführung · Trinkgeld-Basis",
    lat: 55.676,
    lon: 12.569,
    area: "Indre By / Rådhuspladsen",
    rating: null,
    ratingNote:
      "Beim „free tour“-Prinzip bewerten Gäste sehr unterschiedlich, und es gibt mehrere Anbieter am selben Treffpunkt – eine belastbare Einzelbewertung existiert nicht.",
    priceLevel: 0,
    priceText: "Kostenlos · Trinkgeld erwartet (üblich 50–150 DKK pro Person)",
    hours: null,
    hoursNote:
      "Mehrere Touren täglich zu festen Zeiten (u. a. 12:00, 14:30, 15:00). Reservierung online empfohlen, spontanes Mitgehen ist meist möglich.",
    desc:
      "Zwei- bis dreistündige Führung durch die Altstadt auf Trinkgeld-Basis: Rathausplatz, Strøget, Kongens Nytorv, Nyhavn. Es gibt mehrere Anbieter – Treffpunkt ist in der Regel die Treppe des Rathauses, die Guides sind an Regenschirm oder Schild erkennbar.",
    tips: [
      "10 Minuten vorher da sein und den Guide suchen – die Gruppe läuft pünktlich los.",
      "Trinkgeld am Ende in bar; 50–150 DKK je nach Zufriedenheit sind üblich.",
      "Zusätzlich gibt es Touren durch Christianshavn und zum Kastell.",
    ],
    website: "https://copenhagenfreewalkingtours.dk/",
    tags: ["Gratis", "Draußen", "Reservieren"],
    src: "copenhagenfreewalkingtours.dk · copenhagentourism.org (Okt 2026)",
  },
  {
    id: "bike-tour",
    name: "City-Bike-Tour (3 Std.)",
    cat: "tour",
    sub: "Geführte Radtour",
    lat: 55.6767,
    lon: 12.5687,
    area: "Indre By / Rådhuspladsen",
    rating: null,
    ratingNote:
      "Die Tour wird über Buchungsplattformen mit 4,8 aus über 2.300 Bewertungen geführt – das ist eine Plattformbewertung, keine Google-Bewertung, daher hier bewusst leer.",
    priceLevel: 2,
    priceText: "ca. 430 DKK für 3 Std. inkl. Rad und Helm",
    hours: null,
    hoursNote:
      "Tägliche Termine, meist vor- und frühnachmittags; Buchung mindestens 2 Std. vorher. Der genaue Treffpunkt hängt vom Anbieter ab und liegt im Zentrum um Rådhuspladsen / Vester Voldgade.",
    desc:
      "Dreistündige geführte Radtour zu Nyhavn, Amalienborg, der Kleinen Meerjungfrau und Schloss Christiansborg. Kopenhagen ist flach und komplett fahrradfreundlich – auf dem Rad sieht man in drei Stunden mehr als zu Fuß an einem Tag.",
    tips: [
      "Helm ist in Dänemark nicht Pflicht, wird aber ausgegeben und ist bei Regen angenehm.",
      "Regenponcho mitnehmen – die Tour findet auch bei schlechtem Wetter statt.",
      "Wer unsicher im Stadtverkehr ist: Die Route führt viel über separate Radwege, Tempo ist entspannt.",
    ],
    website: "https://www.bookaguide.dk/daily-bike-tour-copenhagen",
    tags: ["Fahrrad", "Draußen", "Reservieren"],
    src: "bookaguide.dk · copenhagen-trip.com · GetYourGuide (Okt 2026)",
  },
];

const existing = new Set(data.places.map((p) => p.id));
let added = 0;
for (const t of TOURS) {
  if (!existing.has(t.id)) {
    data.places.push(t);
    added++;
  }
}

fs.writeFileSync("data/places.json", JSON.stringify(data, null, 2) + "\n");

const counts = {};
data.places.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
console.log("neu hinzugefügt:", added, "| Orte gesamt:", data.places.length);
console.log(counts);
