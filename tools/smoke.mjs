// Smoke-Test ohne Browser: jsdom + Leaflet-Stub, echte Daten, echte App-Logik.
import fs from "node:fs";
import { JSDOM } from "jsdom";

const html = fs.readFileSync("index.html", "utf8");
const stripped = html
  .replace(/<script src="https:\/\/[^"]+"><\/script>/g, "")
  .replace(/<script src="assets\/(hours|app|weather)\.js"><\/script>/g, "");

const dom = new JSDOM(stripped, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.github.io/kopenhagen/" });
const { window } = dom;

// ---- Leaflet-Stub -----------------------------------------------------------
const layers = [];
function fakeLayerGroup() {
  const set = new Set();
  return {
    addTo(m) { m && m._layers.add(this); return this; },
    addLayer(l) { set.add(l); return this; },
    addLayers(ls) { ls.forEach((l) => set.add(l)); return this; },
    removeLayer(l) { set.delete(l); return this; },
    removeLayers(ls) { ls.forEach((l) => set.delete(l)); return this; },
    hasLayer(l) { return set.has(l); },
    _count() { return set.size; },
  };
}
window.__tileLayers = [];
window.L = {
  latLngBounds: () => ({ pad: () => ({}) }),
  map: () => {
    const m = {
      _layers: new Set(),
      addLayer(l) { layers.push(l); return m; },
      removeLayer() { return m; },
      addTo() { return m; },
      flyTo() { return m; },
      getZoom: () => 15,
      on() { return m; },
      closePopup() { return m; },
      // Controls landen wie bei Leaflet im DOM, damit $("styleBtn") sie findet.
      addControl(ctl) {
        const el = ctl && ctl.onAdd ? ctl.onAdd(m) : null;
        if (el) window.document.body.appendChild(el);
        return m;
      },
    };
    return m;
  },
  tileLayer: () => {
    const handlers = {};
    const layer = {
      addTo() { return layer; },
      on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return layer; },
      emit(ev) { (handlers[ev] || []).forEach((fn) => fn({})); },
    };
    window.__tileLayers.push(layer);
    return layer;
  },
  control: { layers: () => ({ addTo() {} }), zoom: () => ({ addTo() {} }), scale: () => ({ addTo() {} }) },
  divIcon: (o) => o,
  layerGroup: fakeLayerGroup,
  marker: () => ({ bindPopup() { return this; }, on() { return this; }, openPopup() { return this; } }),
  markerClusterGroup: (opts) => {
    const g = fakeLayerGroup();
    g.getChildCount = () => 1;
    g._opts = opts;
    return g;
  },
  circleMarker: () => ({ addTo() { return this; }, bindPopup() { return this; } }),
  // Leaflet-Control-API: von addStyleToggle() genutzt.
  Control: {
    extend(proto) {
      function C() {}
      C.prototype = Object.assign({}, proto);
      return C;
    },
  },
  DomUtil: {
    create(tag, cls, parent) {
      const el = window.document.createElement(tag);
      if (cls) el.className = cls;
      if (parent) parent.appendChild(el);
      return el;
    },
  },
  DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
};

const data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
window.fetch = (url) => {
  // Wetterabfrage (Open-Meteo) getrennt beantworten, alles andere liefert die Orte.
  if (String(url).includes("open-meteo")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ current: { ...window.__weatherCurrent } }),
    });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
};

// Voreinstellung: es regnet (2,4 mm). Einzelne Tests ändern das vor dem Laden.
window.__weatherCurrent = { time: "2026-10-25T21:00", precipitation: 2.4, rain: 2.4, weather_code: 61, temperature_2m: 9.4 };

window.alert = (m) => console.log("  [alert]", m);

// ---- Skripte laden ----------------------------------------------------------
window.eval(fs.readFileSync("assets/hours.js", "utf8"));
window.eval(fs.readFileSync("assets/weather.js", "utf8"));
window.eval(fs.readFileSync("assets/app.js", "utf8"));

const errors = [];
window.addEventListener("error", (e) => errors.push(e.message));
window.onerror = (m) => errors.push(String(m));

await new Promise((r) => setTimeout(r, 120));

const $ = (id) => window.document.getElementById(id);
const doc = window.document;
let fails = 0;
function check(name, cond, extra = "") {
  console.log((cond ? "  OK   " : "  FAIL ") + name + (extra ? "  → " + extra : ""));
  if (!cond) fails++;
}

// Erwartungswerte aus den Daten ableiten statt hart zu kodieren – sonst bricht
// der Test bei jeder Datenpflege, ohne etwas über einen echten Fehler zu sagen.
const TOTAL = data.places.length;
const CATS = data.categories.length;
// Kategorien mit defaultOff (z. B. die 26 Metro-/S-Bahn-Stationen) sind beim
// Start ausgeschaltet. Die Erwartungswerte für die erste Bildschirmansicht
// müssen das spiegeln, sonst prüft der Test gegen einen Zustand, den die
// Oberfläche absichtlich nicht herstellt.
const DEFAULT_CATS = data.categories.filter((c) => !c.defaultOff).length;
const DEFAULT_VISIBLE = data.places.filter((p) => {
  const c = data.categories.find((x) => x.id === p.cat);
  return c && !c.defaultOff;
}).length;
// Spiegelt showsRating() in assets/app.js: Supermärkte und Haltestellen werden
// ohne Bewertung geführt und zeigen deshalb auch keinen Platzhalter.
const RATING_CATS = (p) => !["supermarket", "hoho", "transit", "swim"].includes(p.cat);
const RATED = data.places.filter((p) => RATING_CATS(p) && p.rating).length;
const UNRATED = data.places.filter((p) => RATING_CATS(p) && !p.rating).length;
const cards = () => doc.querySelectorAll(".card").length;
const openCard = (id) => {
  const el = doc.querySelector(".card[data-id='" + id + "'] .card-btn");
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  return el;
};

// Kategorie-Chips werden bei jedem Klick neu gerendert (renderChips ersetzt das
// innerHTML). Eine vorab eingesammelte NodeList zeigt danach auf abgehängte
// Knoten – deshalb wird vor jedem Klick frisch gesucht.
function setCat(id, on) {
  const chip = doc.querySelector(".chip[data-cat='" + id + "']");
  if (!chip) return;
  if ((chip.getAttribute("aria-pressed") === "true") !== on) chip.click();
}
const onlyCat = (id) => data.categories.forEach((c) => setCat(c.id, c.id === id));
const allCats = () => data.categories.forEach((c) => setCat(c.id, true));

function dist(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

console.log("== Initiales Rendern ==");
check(CATS + " Kategorie-Chips", doc.querySelectorAll(".chip").length === CATS, String(doc.querySelectorAll(".chip").length));
check("Default-Kategorien sichtbar", cards() === DEFAULT_VISIBLE, cards() + " von " + DEFAULT_VISIBLE);
check("Gruppen-Header vorhanden", doc.querySelectorAll(".list .group").length >= DEFAULT_CATS, String(doc.querySelectorAll(".list .group").length));
check("Zähler gesetzt", new RegExp(DEFAULT_VISIBLE + " von " + TOTAL).test($("count").textContent), $("count").textContent);
check("Datenstand gesetzt", /25\.10\.2026/.test($("dataStamp").textContent), $("dataStamp").textContent);
check("Öffnungszeiten-Status gerendert", doc.querySelectorAll(".status-dot").length > 50);
check("keine JS-Fehler", errors.length === 0, errors.join(" / "));

// Ab hier mit allen Kategorien arbeiten (die restlichen Prüfungen beziehen sich
// auf TOTAL).
allCats();
await new Promise((r) => setTimeout(r, 60));
check("alle Kategorien einschalten zeigt alles", cards() === TOTAL, String(cards()));

console.log("\n== Themenfilter (Tags) ==");
const tagBtns = doc.querySelectorAll("#tagbar .tag");
check("Themenfilter sichtbar", !$("tagbar").hidden && tagBtns.length > 0, tagBtns.length + " Tags");
const firstTag = tagBtns[0];
const tagName = firstTag.dataset.tag;
firstTag.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const taggedCount = cards();
check("Tag filtert die Liste", taggedCount > 0 && taggedCount < TOTAL, tagName + " → " + taggedCount);
check("Tag ist als aktiv markiert", doc.querySelector("#tagbar .tag[data-tag='" + tagName + "']").getAttribute("aria-pressed") === "true");
const expectTag = data.places.filter((p) => (p.tags || []).includes(tagName)).length;
check("Tag-Trefferzahl stimmt mit den Daten überein", taggedCount === expectTag, taggedCount + " vs " + expectTag);
doc.querySelector("#tagbar .tag-clear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Themen zurücksetzen stellt alles wieder her", cards() === TOTAL, String(cards()));

console.log("\n== Favoriten ==");
const favCard = doc.querySelector(".card-fav");
check("Favoriten-Stern an jeder Karte", doc.querySelectorAll(".card-fav").length === TOTAL, String(doc.querySelectorAll(".card-fav").length));
favCard.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Stern setzt den Favoriten", doc.querySelectorAll(".card-fav.is-on").length === 1);
check("Zähler im Filter-Button", $("favCount").textContent === "1", $("favCount").textContent);
$("favBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("'Nur gemerkte' filtert auf einen Ort", cards() === 1, String(cards()));
$("favBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Filter wieder aus", cards() === TOTAL, String(cards()));
doc.querySelector(".card-fav.is-on").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Stern entfernt den Favoriten", doc.querySelectorAll(".card-fav.is-on").length === 0);
check("Zähler zurück auf 0", $("favCount").textContent === "0", $("favCount").textContent);

console.log("\n== Filter ==");
const restChip = doc.querySelector(".chip[data-cat='restaurant']");
const restCount = data.places.filter((p) => p.cat === "restaurant").length;
restChip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Restaurants abschaltbar", cards() === TOTAL - restCount, String(cards()));
restChip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("wieder alle Karten", cards() === TOTAL, String(cards()));

const search = $("search");
search.value = "smørrebrød";
search.dispatchEvent(new window.Event("input", { bubbles: true }));
const n = cards();
check("Suche 'smørrebrød' filtert", n > 0 && n < 20, String(n));
search.value = "";
search.dispatchEvent(new window.Event("input", { bubbles: true }));

const openOnly = $("openOnly");
openOnly.checked = true;
openOnly.dispatchEvent(new window.Event("change", { bubbles: true }));
const openCount = cards();
check("'Nur jetzt geöffnet' filtert", openCount > 0 && openCount < TOTAL, String(openCount));
openOnly.checked = false;
openOnly.dispatchEvent(new window.Event("change", { bubbles: true }));

console.log("\n== Detailansicht ==");
openCard("gasoline-grill");
await new Promise((r) => setTimeout(r, 60));
check("Drawer sichtbar", !$("drawer").hidden);
check("Drawer hat Inhalt", $("drawer").innerHTML.includes("Tipps"));
check("Öffnungszeiten-Tabelle", $("drawer").querySelectorAll(".hours-table tr").length > 0);
check("Menü-Link vorhanden", !!$("drawer").querySelector("a[href*='menu']"));
check("Google-Maps-Route", !!$("drawer").querySelector("a[href*='google.com/maps']"));
check("Favoriten-Knopf im Drawer", !!$("drawer").querySelector(".fav-toggle"));
check("Teilen-Knopf im Drawer", !!$("drawer").querySelector(".share-btn"));
const closeBtn = $("drawerClose");
closeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Drawer schließt", $("drawer").hidden);

console.log("\n== Foto ==");
// Nur Orte mit verifiziertem Wikipedia-Bild haben eine Galerie – und dann
// immer mit Namensnennung, sonst ist die Lizenz nicht erfüllt.
const withPhoto = data.places.filter((p) => p.photo && p.photo.url);
check("mindestens ein Ort mit Foto", withPhoto.length > 0, withPhoto.length + " Orte");
openCard(withPhoto[0].id);
await new Promise((r) => setTimeout(r, 60));
const figure = $("drawer").querySelector(".drawer-photo");
check("Foto wird angezeigt", !!figure && !!figure.querySelector("img"));
check("Foto hat Alt-Text", !!figure && !!figure.querySelector("img").getAttribute("alt"));
check("Foto nennt Autor und Lizenz", !!figure && /Bild:/.test(figure.textContent) && /CC|Public domain|siehe Dateiseite/.test(figure.textContent), figure ? figure.querySelector("figcaption").textContent.trim().slice(0, 60) : "-");
$("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

// Ort ohne Bild: kein Platzhalter, kein leerer Rahmen
const noPhoto = data.places.find((p) => !p.photo);
if (noPhoto) {
  openCard(noPhoto.id);
  await new Promise((r) => setTimeout(r, 40));
  check("Ort ohne Bild zeigt keinen leeren Bildrahmen", !$("drawer").querySelector(".drawer-photo"), noPhoto.id);
  $("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

console.log("\n== Touren ==");
const tours = data.places.filter((p) => p.cat === "tour");
const tourChip = doc.querySelector(".chip[data-cat='tour']");
check("Kategorie Touren existiert", !!tourChip && tours.length > 0, tours.length + " Einträge");

// Nur Touren anzeigen
for (const c of doc.querySelectorAll(".chip")) if (c.dataset.cat !== "tour") c.click();
await new Promise((r) => setTimeout(r, 40));
check("Kategorie-Filter zeigt nur Touren", cards() === tours.length, String(cards()));

// Touren ohne Öffnungszeiten müssen anders beschriftet sein als Orte ohne Zeiten.
// Eine geratene Abfahrtszeit wäre schlimmer als keine, deshalb sagt die Karte das.
const noHoursTour = tours.find((t) => !t.hours);
const withHoursTour = tours.find((t) => t.hours);
if (noHoursTour) {
  const label = doc.querySelector(".card[data-id='" + noHoursTour.id + "'] .card-hours span:last-child").textContent;
  check("Tour ohne Zeiten: 'Abfahrtszeiten laut Anbieter'", label === "Abfahrtszeiten laut Anbieter", label);
  openCard(noHoursTour.id);
  await new Promise((r) => setTimeout(r, 40));
  check("Tour ohne Zeiten nennt den Grund im Hinweis", !!$("drawer").querySelector(".note"), noHoursTour.id);
  $("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}
if (withHoursTour) {
  openCard(withHoursTour.id);
  await new Promise((r) => setTimeout(r, 40));
  check("Tour mit dokumentierten Zeiten zeigt Wochentabelle", $("drawer").querySelectorAll(".hours-table tr").length > 0, withHoursTour.id);
  $("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

// City Sightseeing ist der Franchise-Name derselben Stromma-Busse -> ein Eintrag
check("kein doppelter Eintrag für City Sightseeing", !data.places.some((p) => /city sightseeing/i.test(p.name)), "Stromma-Eintrag nennt den Namen in der Beschreibung");
check("City Sightseeing wird in der Stromma-Beschreibung erklärt", /City Sightseeing/.test((data.places.find((p) => p.id === "hop-on-hop-off-stromma") || {}).desc || ""));

// Alle Kategorien wieder einschalten
for (const c of doc.querySelectorAll(".chip")) if (c.dataset.cat !== "tour") c.click();
await new Promise((r) => setTimeout(r, 40));
check("alle Kategorien wieder aktiv", cards() === TOTAL, String(cards()));

console.log("\n== Hop-On-Hop-Off-Haltestellen ==");
const stops = data.places.filter((p) => p.cat === "hoho");
const stopChip = doc.querySelector(".chip[data-cat='hoho']");
check("Kategorie Haltestellen existiert", !!stopChip && stops.length > 0, stops.length + " Einträge");

for (const c of data.categories) if (c.id !== "hoho") setCat(c.id, false);
await new Promise((r) => setTimeout(r, 40));
check("Filter zeigt nur Haltestellen", cards() === stops.length, String(cards()));

// Eine Haltestelle ist Infrastruktur – kein Bewertungs-Platzhalter, kein Preis.
check("Haltestellen ohne Bewertungs-Platzhalter", doc.querySelectorAll(".card .no-rating").length === 0 && doc.querySelectorAll(".card .rating").length === 0);
check("Haltestellen nennen den Anbieter", stops.every((s) => /Stromma|Red/.test(s.sub)), stops.map((s) => s.sub).slice(0, 2).join(" / "));
check("Haltestellen haben Betriebszeiten", stops.every((s) => !!s.hours), stops.filter((s) => !s.hours).length + " ohne");

const both = stops.filter((s) => /Stromma \+ Red/.test(s.sub));
check("Haltestellen mit beiden Anbietern", both.length >= 3, both.map((s) => s.name).join(", "));

// Kein Duplikat und keine Haltestelle außerhalb des Kartenbereichs.
// (Ein Abstandstest zu anderen Orten wäre hier falsch: Islands Brygge und der
// Gefion-Brunnen liegen legitim weit weg vom nächsten erfassten Eintrag.)
const BOUNDS = { minLat: 55.64, maxLat: 55.72, minLon: 12.51, maxLon: 12.63 };
const outside = stops.filter(
  (s) => s.lat < BOUNDS.minLat || s.lat > BOUNDS.maxLat || s.lon < BOUNDS.minLon || s.lon > BOUNDS.maxLon,
);
check("Haltestellen liegen im Kartenbereich", outside.length === 0, outside.map((s) => s.name).join(", ") || "alle innerhalb");

let tooClose = null;
for (let i = 0; i < stops.length && !tooClose; i++) {
  for (let j = i + 1; j < stops.length; j++) {
    if (dist(stops[i], stops[j]) < 150) {
      tooClose = stops[i].name + " / " + stops[j].name + " (" + Math.round(dist(stops[i], stops[j])) + " m)";
      break;
    }
  }
}
check("keine zwei Haltestellen unter 150 m (keine Doppel-Einträge)", !tooClose, tooClose || "ok");

allCats();
await new Promise((r) => setTimeout(r, 40));
check("alle Kategorien wieder aktiv (nach Haltestellen)", cards() === TOTAL, String(cards()));

console.log("\n== Metro & S-Bahn ==");
const stations = data.places.filter((p) => p.cat === "transit");
const transitCat = data.categories.find((c) => c.id === "transit");
check("Kategorie Metro & S-Bahn existiert", !!transitCat && stations.length > 0, stations.length + " Stationen");
check("Kategorie startet ausgeschaltet", transitCat.defaultOff === true);
check("Stationen nennen ihre Linien", stations.every((s) => /Metro|S-tog|Hafenbus/.test(s.sub)), stations[0].sub);
const railStations = stations.filter((s) => /Metro|S-tog/.test(s.sub));
check("Metro-/S-tog-Stationen haben Betriebszeiten", railStations.every((s) => !!s.hours), railStations.filter((s) => !s.hours).length + " ohne");
check("Stationen ohne Bewertungs-Platzhalter", stations.every((s) => s.rating == null));

// Beide Netze am selben Ort: Nørreport und København H müssen Metro UND S-tog zeigen
for (const id of ["tx-norreport", "tx-kobenhavn-h", "tx-osterport"]) {
  const s = stations.find((x) => x.id === id);
  check(`${id}: Metro + S-tog`, !!s && /Metro/.test(s.sub) && /S-tog/.test(s.sub), s ? s.sub : "fehlt");
}

// Kongens Nytorv ist die einzige Station mit allen vier Metrolinien
const kng = stations.find((s) => s.id === "tx-kongens-nytorv");
check("Kongens Nytorv hat M1–M4", !!kng && ["M1", "M2", "M3", "M4"].every((l) => kng.sub.includes(l)), kng ? kng.sub : "fehlt");

// Die alten services-Einträge dürfen nicht doppelt existieren
check("keine doppelten Stations-Einträge", !data.places.some((p) => ["norreport-station", "kongens-nytorv-station", "hovedbanegaarden"].includes(p.id)));

// Einschalten über den Chip muss die Stationen auf die Karte bringen
setCat("transit", false);
await new Promise((r) => setTimeout(r, 40));
const withoutTransit = cards();
setCat("transit", true);
await new Promise((r) => setTimeout(r, 40));
check("Zuschalten erhöht die Trefferzahl um die Stationen", cards() === withoutTransit + stations.length, withoutTransit + " → " + cards());

console.log("\n== Hafenbäder ==");
const swim = data.places.filter((p) => p.cat === "swim");
check("Kategorie Baden existiert", !!doc.querySelector(".chip[data-cat='swim']") && swim.length > 0, swim.length + " Stellen");
check("Badestellen sind kostenlos", swim.every((s) => /Kostenlos/i.test(s.priceText || "")), swim.filter((s) => !/Kostenlos/i.test(s.priceText || "")).length + " ohne");
check("Badestellen nennen Saison und Flaggenregel", swim.every((s) => /Saison|geöffnet/i.test(s.hoursNote || "")), swim.filter((s) => !/Saison|geöffnet/i.test(s.hoursNote || "")).length + " ohne");
check("Badestellen ohne Bewertungs-Platzhalter", swim.every((s) => s.rating == null));
check("Badestellen haben Koordinaten im Wasserbereich", swim.every((s) => Math.abs(s.lat - 55.676) < 0.05), "ok");

const swimLabel = doc.querySelector(".card[data-id='" + swim[0].id + "'] .card-hours span:last-child")?.textContent;
check("Badestelle zeigt 'Badesaison beachten'", swimLabel === "Badesaison beachten", swimLabel);

console.log("\n== Hafenbus ==");
const hb = data.places.filter((p) => p.cat === "transit" && /Hafenbus/.test(p.sub));
check("8 Hafenbus-Anleger", hb.length === 8, String(hb.length));
check("Anleger nennen die Linie 991/992", hb.every((s) => /991\/992/.test(s.sub)));
check("Anleger nennen den Ticketvorteil", hb.every((s) => /ÖPNV-Ticket|Ticket/i.test(s.hoursNote || "")), "ok");
check("Nahverkehr-Kategorie heißt passend", /Hafenbus/.test(data.categories.find((c) => c.id === "transit").label), data.categories.find((c) => c.id === "transit").label);

console.log("\n== Außenplätze ==");
const outdoor = data.places.filter((p) => (p.tags || []).includes("Außenplätze"));
check("Tag 'Außenplätze' vergeben", outdoor.length >= 2, outdoor.length + " Orte");
const outdoorBtn = doc.querySelector("#tagbar .tag[data-tag='Außenplätze']");
check("Tag erscheint im Themenfilter", !!outdoorBtn);
if (outdoorBtn) {
  outdoorBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));
  check("Filter zeigt nur Orte mit Außenplätzen", cards() === outdoor.length, cards() + " vs " + outdoor.length);
  doc.querySelector("#tagbar .tag-clear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));
}

console.log("\n== GPX-Export ==");
const gpxBtn = $("gpxBtn");
check("GPX-Knopf existiert", !!gpxBtn);
check("ohne Favoriten deaktiviert", !!gpxBtn && gpxBtn.disabled === true);

doc.querySelector(".card-fav").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 40));
check("mit Favorit aktiviert", !!gpxBtn && gpxBtn.disabled === false);

let captured = null;
window.URL.createObjectURL = (blob) => { captured = blob; return "blob:test"; };
window.URL.revokeObjectURL = () => {};
gpxBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 80));

check("Export erzeugt eine Datei", !!captured);
const gpxText = captured && captured.text ? await captured.text() : "";
check("GPX ist wohlgeformt", /<gpx[^>]*version="1\.1"/.test(gpxText) && /<\/gpx>\s*$/.test(gpxText), gpxText.length + " Zeichen");
check("GPX enthält genau einen Wegpunkt", (gpxText.match(/<wpt /g) || []).length === 1, String((gpxText.match(/<wpt /g) || []).length));
check("Wegpunkt hat Koordinaten und Namen", /<wpt lat="55\.\d+" lon="12\.\d+">/.test(gpxText) && /<name>[^<]+<\/name>/.test(gpxText));

console.log("\n== Preisvergleich ==");
$("compare").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 40));
const rows = doc.querySelectorAll(".price-table tbody tr");
check("Modal offen", !$("modal").hidden);
check("Preis-Tabelle gefüllt", rows.length >= 25, String(rows.length));
// Touren haben Preise, gehören aber nicht in den Gastro-Preisvergleich.
check("Touren nicht im Preisvergleich", rows.length === data.places.filter((p) => p.cat === "restaurant" || p.cat === "fastfood").length, rows.length + " Zeilen");
const firstPrice = rows[0].querySelector("td.num b");
check("günstigster Eintrag zuerst", firstPrice && parseInt(firstPrice.textContent, 10) <= 60, firstPrice && firstPrice.textContent);
$("modalClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Modal schließt", $("modal").hidden);

console.log("\n== Deep-Link / Theme ==");
$("themeBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Theme wechselt auf dark", doc.documentElement.getAttribute("data-theme") === "dark");
$("themeBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Theme zurück auf light", doc.documentElement.getAttribute("data-theme") === "light");

console.log("\n== Sortierung ==");
const sort = $("sort");
sort.value = "price";
sort.dispatchEvent(new window.Event("change", { bubbles: true }));
check("Sortierung nach Preis läuft", cards() === TOTAL, String(cards()));
check("keine Gruppen-Header bei Preissortierung", doc.querySelectorAll(".list .group").length === 0);

console.log("\n== Mobile Liste (Bottom-Sheet) ==");
const toggleBtn = doc.getElementById("sidebarToggle");
const backdrop = doc.getElementById("sheetBackdrop");
const sheet = doc.querySelector(".sidebar");
check("Toggle existiert", !!toggleBtn);
check("Backdrop existiert und ist versteckt", !!backdrop && backdrop.hidden);
check("Sheet anfangs geschlossen", !doc.body.classList.contains("sidebar-open"));

toggleBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
check("Tap öffnet Sheet", doc.body.classList.contains("sidebar-open"));
check("Backdrop wird sichtbar", !backdrop.hidden);
check("aria-expanded = true", toggleBtn.getAttribute("aria-expanded") === "true");

// Doppel-Feuer-Schutz: direkt zweiter Klick (iOS feuert pointerup + click)
toggleBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
check("Doppelklick schließt nicht sofort wieder", doc.body.classList.contains("sidebar-open"));

doc.getElementById("sheetClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Schließen-Kreuz schließt Sheet", !doc.body.classList.contains("sidebar-open"));
check("Backdrop wieder versteckt", backdrop.hidden);
check("aria-expanded = false nach Schließen", toggleBtn.getAttribute("aria-expanded") === "false");

await new Promise((r) => setTimeout(r, 450));
toggleBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
check("nach Guard-Pause wieder öffnbar", doc.body.classList.contains("sidebar-open"));
await new Promise((r) => setTimeout(r, 420));
backdrop.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Tap auf Backdrop schließt", !doc.body.classList.contains("sidebar-open"));

await new Promise((r) => setTimeout(r, 450));
toggleBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
check("Öffnen ein drittes Mal", doc.body.classList.contains("sidebar-open"));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
check("Escape schließt Sheet", !doc.body.classList.contains("sidebar-open"));

console.log("\n== Transparenz: fehlende Bewertung / Speisekarte ==");
const unratedCards = doc.querySelectorAll(".card .no-rating").length;
check("Karten ohne Bewertung sind markiert", unratedCards === UNRATED, unratedCards + " von " + UNRATED + " (ohne Supermärkte/Haltestellen/Stationen)");
const ratedCards = doc.querySelectorAll(".card .rating").length;
check("bewertete Orte zeigen Sterne", ratedCards === RATED, ratedCards + " von " + RATED + " Karten");

// Supermärkte: weder Sterne noch Platzhalter
doc.querySelector(".card[data-id='netto-noerre-voldgade'] .card-btn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 50));
const drawerHtml = () => $("drawer").innerHTML;
check("Supermarkt-Drawer ohne Bewertungszeile", !drawerHtml().includes("Bewertung</span>"));
check("Supermarkt-Karte ohne Bewertungsmarker",
  !doc.querySelector(".card[data-id='netto-noerre-voldgade'] .rating") &&
  !doc.querySelector(".card[data-id='netto-noerre-voldgade'] .no-rating"));
check("Supermarkt behält Öffnungszeiten", drawerHtml().includes("hours-table"));
$("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

// Ort ohne Bewertung (Nicht-Supermarkt): Atelier September hat widersprüchliche Quellen
doc.querySelector(".card[data-id='atelier-september'] .card-btn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 50));
check("Drawer sagt 'Keine Bewertung verfügbar'", drawerHtml().includes("Keine Bewertung verfügbar"));
check("Drawer nennt den Grund", /Quellen weichen ab/.test(drawerHtml()));
$("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

// Gastro ohne Menü: Figaro hat weder Website noch Karte
doc.querySelector(".card[data-id='figaro'] .card-btn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 50));
check("Drawer sagt 'Keine Speisekarte online'", drawerHtml().includes("Keine Speisekarte online"));
check("Drawer begründet fehlende Karte", drawerHtml().includes("Keine Website und keine Speisekarte"));
$("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

// Bewerteter Ort mit Quelle: Kong Hans (Tripadvisor)
doc.querySelector(".card[data-id='konghans'] .card-btn").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 50));
check("Bewertungsquelle wird ausgewiesen", drawerHtml().includes("Tripadvisor"));
check("Speisekarten-Button vorhanden", !!$("drawer").querySelector("a[href*='konghans.dk']"));
$("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

console.log("\n== Wetter (Open-Meteo) ==");
const rainBtn = $("rainBtn");
check("Regen-Hinweis erscheint bei Regen", !!rainBtn && rainBtn.hidden === false);
check("Hinweis nennt die Wetterlage", /regen/i.test(rainBtn.getAttribute("title") || ""), rainBtn.getAttribute("title"));
check("Hinweis nennt die Temperatur", /9 °C/.test(rainBtn.getAttribute("title") || ""), rainBtn.getAttribute("title"));

rainBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 60));
const rainCount = data.places.filter((p) => (p.tags || []).includes("Regenwetter")).length;
check("Klick filtert auf Regenwetter", cards() === rainCount, cards() + " von " + rainCount);
check("Regenwetter-Tag ist aktiv", doc.querySelector("#tagbar .tag[data-tag='Regenwetter']")?.getAttribute("aria-pressed") === "true");
doc.querySelector("#tagbar .tag-clear").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 40));
check("zurücksetzen stellt alles wieder her", cards() === TOTAL, String(cards()));

console.log("\n== Wikipedia-Auszug ==");
const withExtract = data.places.filter((p) => p.wikiExcerpt);
check("Exzerpte vorhanden", withExtract.length > 0, withExtract.length + " Orte");
check("kein Exzerpt für Haltestellen", !data.places.some((p) => p.cat === "hoho" && p.wikiExcerpt));

const exPlace = withExtract.find((p) => p.cat === "attraction") || withExtract[0];
openCard(exPlace.id);
await new Promise((r) => setTimeout(r, 50));
const wiki = $("drawer").querySelector(".wiki-block");
check("Wikipedia-Block im Drawer", !!wiki, exPlace.id);
check("Block ist standardmäßig zugeklappt", !!wiki && wiki.open === false);
check("Exzerpt-Text wird gezeigt", !!wiki && wiki.querySelector(".wiki-text").textContent.trim().length > 60);
check("Lizenz CC BY-SA genannt", !!wiki && /CC BY-SA/.test(wiki.textContent));
check("Artikel verlinkt", !!wiki && /de\.wikipedia\.org/.test(wiki.querySelector("a")?.getAttribute("href") || ""));
$("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

const noEx = data.places.find((p) => !p.wikiExcerpt && p.cat === "cafe");
if (noEx) {
  openCard(noEx.id);
  await new Promise((r) => setTimeout(r, 40));
  check("ohne Exzerpt kein leerer Block", !$("drawer").querySelector(".wiki-block"), noEx.id);
  $("drawerClose").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

console.log("\n== Kartenstil-Umschalter ==");
const styleBtn = $("styleBtn");
check("Umschalter existiert", !!styleBtn);
const wrap = doc.querySelector(".map-wrap");
check("startet im Normalstil", !wrap.classList.contains("is-muted"));
styleBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Klick aktiviert den ruhigen Stil", wrap.classList.contains("is-muted"));
check("aria-pressed gesetzt", styleBtn.getAttribute("aria-pressed") === "true");
styleBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("zweiter Klick schaltet zurück", !wrap.classList.contains("is-muted"));

console.log("\n== Kartenkacheln ==");
check("zwei Kachel-Layer registriert", window.__tileLayers.length === 2, String(window.__tileLayers.length));
const tileLayer = window.__tileLayers[0];
for (let i = 0; i < 6; i++) tileLayer.emit("tileerror");
check("Warnung nach 6 Kachelfehlern", !!doc.querySelector(".tile-warning"));
tileLayer.emit("tileload");
check("Warnung verschwindet bei Erfolg", !doc.querySelector(".tile-warning"));

const appSrc = fs.readFileSync("assets/app.js", "utf8");
check("keine CARTO-Kacheln mehr", !/cartocdn|basemaps\.carto/.test(appSrc));
check("OSM-Kacheln als Standard", /tile\.openstreetmap\.org/.test(appSrc));

console.log("\n" + (fails === 0 ? "ALLE CHECKS BESTANDEN" : fails + " CHECK(S) FEHLGESCHLAGEN"));
process.exit(fails === 0 ? 0 : 1);
