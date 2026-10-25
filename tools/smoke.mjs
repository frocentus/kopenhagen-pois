// Smoke-Test ohne Browser: jsdom + Leaflet-Stub, echte Daten, echte App-Logik.
import fs from "node:fs";
import { JSDOM } from "jsdom";

const html = fs.readFileSync("index.html", "utf8");
const stripped = html
  .replace(/<script src="https:\/\/[^"]+"><\/script>/g, "")
  .replace(/<script src="assets\/(hours|app)\.js"><\/script>/g, "");

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
      removeLayer() { return m; },
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
};

const data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));
window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
window.alert = (m) => console.log("  [alert]", m);

// ---- Skripte laden ----------------------------------------------------------
window.eval(fs.readFileSync("assets/hours.js", "utf8"));
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
const RATED = data.places.filter((p) => p.cat !== "supermarket" && p.rating).length;
const UNRATED = data.places.filter((p) => p.cat !== "supermarket" && !p.rating).length;
const cards = () => doc.querySelectorAll(".card").length;
const openCard = (id) => {
  const el = doc.querySelector(".card[data-id='" + id + "'] .card-btn");
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  return el;
};

console.log("== Initiales Rendern ==");
check(CATS + " Kategorie-Chips", doc.querySelectorAll(".chip").length === CATS, String(doc.querySelectorAll(".chip").length));
check(TOTAL + " Karten in der Liste", cards() === TOTAL, String(cards()));
check("Gruppen-Header vorhanden", doc.querySelectorAll(".list .group").length >= CATS);
check("Zähler gesetzt", new RegExp(TOTAL + " von " + TOTAL).test($("count").textContent), $("count").textContent);
check("Datenstand gesetzt", /25\.10\.2026/.test($("dataStamp").textContent), $("dataStamp").textContent);
check("Öffnungszeiten-Status gerendert", doc.querySelectorAll(".status-dot").length > 50);
check("keine JS-Fehler", errors.length === 0, errors.join(" / "));

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

console.log("\n== Preisvergleich ==");
$("compare").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 40));
const rows = doc.querySelectorAll(".price-table tbody tr");
check("Modal offen", !$("modal").hidden);
check("Preis-Tabelle gefüllt", rows.length >= 25, String(rows.length));
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
check("Karten ohne Bewertung sind markiert", unratedCards === UNRATED, unratedCards + " von " + UNRATED + " (ohne Supermärkte)");
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
