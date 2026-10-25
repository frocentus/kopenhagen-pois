// Wendet die Recherche-Ergebnisse vom 2026-10-25 auf data/places.json an.
// Jede Änderung ist an eine ID gebunden und wird geprüft – kein stiller Fehlschlag.
import fs from "node:fs";

const FILE = "data/places.json";
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const byId = Object.fromEntries(data.places.map((p) => [p.id, p]));
const errors = [];
let changed = 0;

function set(id, fields) {
  const p = byId[id];
  if (!p) {
    errors.push("unbekannte ID: " + id);
    return;
  }
  for (const [k, v] of Object.entries(fields)) {
    if (p[k] === v) errors.push("keine Änderung: " + id + "." + k);
    p[k] = v;
    changed++;
  }
}

// ─────────────────────────────────────────────── Öffnungszeiten
set("nyhavn", {
  hours: "24/7",
  hoursNote: "Hafen und Kais sind rund um die Uhr frei zugänglich; die Restaurants öffnen ab ca. 10–11 Uhr.",
});
set("havfrue", {
  hours: "24/7",
  hoursNote: "Jederzeit frei zugänglich an der Langelinie-Promenade.",
});
set("stroeget", {
  hours: "24/7",
  hoursNote: "Fußgängerzone jederzeit begehbar; die Geschäfte öffnen meist Mo–Sa 10–19/20, So 10–18 Uhr.",
});
set("kastellet", {
  hours: "24/7",
  hoursNote: "Park und Wälle täglich frei zugänglich; einzelne Bereiche sind militärisches Sperrgebiet.",
});
set("marmorkirken", {
  hours: "Mo-Th 10:00-17:00; Fr 12:00-17:00; Sa 10:00-17:00; Su 13:00-17:00",
  hoursNote: "Von marmorkirken.dk (Okt 2026). Kuppelaufstieg nur Sa/So 13:30, max. 15 Personen, Tickets ausschließlich vor Ort.",
});
set("lille-fugl", {
  hours: "Mo-We 07:30-18:00; Th 07:30-20:00; Fr 07:30-19:00; Sa-Su 09:00-18:00",
  hoursNote: "Von flerefugle.dk (Okt 2026); richtet sich nach den Ausstellungen im Kunstverein Gammel Strand.",
});
set("palaegade", {
  hours: "Mo-Su 11:30-17:00; Mo-Sa 18:00-24:00",
  hoursNote: "Mittag täglich, Abend Mo–Sa. Letzter Einlass 14:45 bzw. 20:30 (formelbgroup.dk, Okt 2026).",
});
set("krebsegaarden", {
  hours: "Tu-Sa 18:00-23:30",
  hoursNote: "Montag und Sonntag geschlossen (krebsegaarden.dk, Okt 2026).",
});
set("skipperkroen", {
  hours: "Mo-Th 11:30-22:30; Fr-Sa 11:30-23:15; Su 11:30-22:30",
  hoursNote: "Aus dem aktuellen Menükort (09/2026).",
});
set("mangia", {
  hours: "Tu-Th 17:30-24:00; Fr-Sa 17:30-02:00",
  hoursNote: "Montag und Sonntag geschlossen (Website/Google, Okt 2026).",
});
set("figaro", {
  hoursNote: "Keine verifizierten Öffnungszeiten gefunden – bitte telefonisch prüfen.",
});
set("les-trois-cochons", {
  hoursNote:
    "Drittquellen nennen 08:00–15:00 und 17:30–24:00; offiziell nicht bestätigt. Bitte vor dem Besuch prüfen.",
});
set("broens-gadekoekken", {
  hoursNote:
    "Streetfood-Saison endet im Oktober: ab 30.10.2026 Winterbetrieb als Eisbahn (Broens Skøjtebane). Zeiten auf broensstreetfood.dk.",
});

// ─────────────────────────────────────────────── Bewertungen
const CHAIN = "Kette – Bewertung unterscheidet sich je Filiale.";
set("atelier-september", {
  ratingNote: "Quellen weichen ab (3,8–4,1) – keine eindeutige Zuordnung zur Filiale Kronprinsessegade.",
});
set("democratic-coffee", { rating: 4.4, reviews: "973", ratingSource: "Google" });
set("dyrehaven", { rating: 4.1, reviews: "844", ratingSource: "Google" });
set("mad-og-kaffe", { rating: 4.5, reviews: "2.973", ratingSource: "Google" });
set("sankt-peders", { rating: 4.7, reviews: "—", ratingSource: "Google" });
set("lille-fugl", { rating: 4.3, reviews: "—", ratingSource: "Google" });
set("emmerys", { ratingNote: "Kette – Bewertung je Filiale zwischen 3,8 und 4,1." });
set("lagkagehuset", { ratingNote: "Kette – Bewertung je Filiale unterschiedlich." });
set("norrlyst", { rating: 4.5, reviews: "—", ratingSource: "Google" });
set("marchal", { rating: 4.5, reviews: "—", ratingSource: "Google" });
set("aoc", {
  ratingNote: "2 Michelin-Sterne (2026); keine belastbare Publikumsbewertung für diese Adresse gefunden.",
});
set("konghans", { rating: 4.6, reviews: "344", ratingSource: "Tripadvisor" });
set("fiskebar", { rating: 4.3, reviews: "4.394", ratingSource: "Google" });
set("baest", { rating: 4.2, reviews: "—", ratingSource: "Google" });
set("mangia", { rating: 4.2, reviews: "486", ratingSource: "Google" });
set("cap-horn", { rating: 4.1, reviews: "—", ratingSource: "Google" });
set("nyhavn17", { rating: 3.7, reviews: "—", ratingSource: "Google" });
set("kanalen", { rating: 4.3, reviews: "504", ratingSource: "Tripadvisor" });
set("skipperkroen", { rating: 3.6, reviews: "1.056", ratingSource: "Google" });
set("figaro", { ratingNote: "Kein Online-Profil mit belastbarer Bewertung gefunden." });
set("les-trois-cochons", { rating: 3.8, reviews: "553", ratingSource: "Tripadvisor" });
set("tommijs", { rating: 4.3, reviews: "2.876", ratingSource: "Google" });
set("jagger", { ratingNote: "Kette – Filialbewertungen liegen je Standort bei ca. 4,0–4,3." });
set("sunset-boulevard", { ratingNote: "Kette – Filialbewertungen schwanken stark je Standort." });
set("mcdonalds-nyhavn", { ratingNote: CHAIN });
set("burger-king-stroget", { ratingNote: CHAIN });
set("dominos-christianshavn", { ratingNote: CHAIN });
set("broens-gadekoekken", { ratingNote: "Saisonbetrieb mit wechselnden Ständen – keine stabile Bewertung." });
set("foetex-st-kongensgade", { rating: 4.1, reviews: "150", ratingSource: "Google" });
for (const id of [
  "netto-noerre-voldgade",
  "netto-kongens-nytorv",
  "netto-vesterbro",
  "foetex-city",
  "rema-gothersgade",
  "rema-vesterport",
  "discount-365-noerre",
  "superbrugsen-nyhavn",
  "superbrugsen-farimags",
  "meny-illum",
  "lidl-vesterbro",
  "seven-eleven-raadhuspladsen",
  "seven-eleven-noerreport",
  "seven-eleven-store-kongensgade",
  "seven-eleven-christianshavn",
]) set(id, { ratingNote: CHAIN });
set("illum", { rating: 4.2, reviews: "6.584", ratingSource: "Google" });
set("magasin", { rating: 4.2, reviews: "16.952", ratingSource: "Google" });
set("fisketorvet", { rating: 4.2, reviews: "18.153", ratingSource: "Google" });
set("frederiksberg-centret", { rating: 4.2, reviews: "9.065", ratingSource: "Google" });

// ─────────────────────────────────────────────── Speisekarten
set("atelier-september", { menu: "https://cafeatelierseptember.com/pages/menu" });
set("sonny", { menu: "https://www.sonnycph.dk/menu-3" });
set("mangia", { menu: "https://mangia.dk/menu/" });
set("krebsegaarden", { menu: "https://krebsegaarden.dk/menu", website: "https://krebsegaarden.dk/" });
set("skipperkroen", {
  menu: "https://streckers.dk/wp-content/uploads/2026/09/sk-menukort-frokost_0926_dk.pdf",
  website: "https://streckers.dk/skipperkroen/",
});
set("lille-fugl", {
  menu: "https://cdn.sanity.io/files/uov2y1es/production/0a91527adf8cbf1526caf8241c497098e7098c07.pdf",
});
set("hoest", { menu: "https://cofoco.dk/en/restaurant/hoest/menu" });
set("vaekst", { menu: "https://cofoco.dk/en/restaurant/vaekst/menu" });
set("palaegade", { menu: "https://formelbgroup.dk/palaegade/frokost/" });
set("dominos-christianshavn", { menu: "https://www.dominos.dk/menu/pizza" });
set("burger-king-stroget", { menu: "https://burgerking.dk/menu" });
set("lagkagehuset", { menu: "https://lagkagehuset.dk/shop" });

const NO_MENU = {
  "democratic-coffee": "Keine eigene Speisekarte online – Karte hängt im Café.",
  kafbar: "Keine Speisekarte online – Karte vor Ort.",
  dyrehaven: "Nur die Weinkarte ist als PDF verfügbar; die Speisenkarte gibt es vor Ort.",
  emmerys: "Bäckerei: Produkte im Laden, keine Speisekarte online.",
  frenchy: "Website blockiert automatisierte Abrufe – Speisekarte über die Website.",
  marchal: "Speisekarte über die Hotel-Website (Menüführung dort).",
  norrlyst: "Menüs liegen unter den einzelnen Konzepten auf norrlyst.dk.",
  fiskebar: "Speisekarte auf der Website im Abschnitt „Menu“.",
  "cap-horn": "Speisekarte direkt auf der Website im Abschnitt „Menu“.",
  "sankt-peders": "Keine Website – Auslage im Laden.",
  figaro: "Keine Website und keine Speisekarte online gefunden.",
  "les-trois-cochons": "Keine Website und keine Speisekarte online gefunden.",
  "mcdonalds-nyhavn": "Speisekarte nur in der McDonald's-App bzw. auf mcdonalds.dk.",
  "broens-gadekoekken": "Saisonbetrieb mit wechselnden Ständen – keine feste Karte.",
  "dandelion-burger": "Karte auf der Startseite der Website (keine eigene Menü-URL).",
};
for (const [id, note] of Object.entries(NO_MENU)) set(id, { menuNote: note });

// ─────────────────────────────────────────────── Faktenkorrekturen (Michelin 2026)
set("konghans", {
  sub: "2 Michelin-Sterne, mittelalterliches Gewölbe",
  desc:
    "Das älteste Gourmetrestaurant Dänemarks (1976) in einem mittelalterlichen Kellergewölbe – französische Klassik mit dänischen Zutaten, seit 2021 mit zwei Michelin-Sternen (2026 bestätigt).",
});
set("marchal", {
  sub: "Fine Dining, 1 Michelin-Stern",
  desc:
    "Das Restaurant im Hotel d'Angleterre am Kongens Nytorv: klassische französisch-nordische Küche, sehr formeller Service, ein Michelin-Stern (2026) – der Ort für einen besonderen Abend.",
});

// ─────────────────────────────────────────────── Meta
data.meta.reviewed = "2026-10-25";
data.meta.note =
  "Öffnungszeiten aus OpenStreetMap (ODbL) und – wo dort leer – von den Betreiber-Websites (Okt 2026). Preise und Bewertungen aus öffentlichen Quellen (VisitCopenhagen, kopenhagen.info, Betreiber-Websites, Google/Tripadvisor via Exa Places). Bewertungen ohne belastbare Quelle sind explizit als solche gekennzeichnet.";

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log("Änderungen:", changed);
if (errors.length) {
  console.log("PROBLEME:");
  errors.forEach((e) => console.log("  -", e));
  process.exit(1);
}
const P = data.places;
console.log("ohne Zeiten:", P.filter((p) => !p.hours).length, "| ohne Bewertung:", P.filter((p) => !p.rating).length);
console.log("ohne Bewertung UND ohne Begründung:", P.filter((p) => !p.rating && !p.ratingNote).map((p) => p.id).join(", ") || "keine");
const gastro = P.filter((p) => ["restaurant", "fastfood", "breakfast"].includes(p.cat));
console.log("Gastro ohne Menü:", gastro.filter((p) => !p.menu).length, "| davon ohne Begründung:", gastro.filter((p) => !p.menu && !p.menuNote).map((p) => p.id).join(", ") || "keine");
