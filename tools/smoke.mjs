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

console.log("== Initiales Rendern ==");
check("6 Kategorie-Chips", doc.querySelectorAll(".chip").length === 6, String(doc.querySelectorAll(".chip").length));
check("84 Karten in der Liste", doc.querySelectorAll(".card").length === 84, String(doc.querySelectorAll(".card").length));
check("Gruppen-Header vorhanden", doc.querySelectorAll(".list .group").length >= 6);
check("Zähler gesetzt", /84 von 84/.test($("count").textContent), $("count").textContent);
check("Datenstand gesetzt", /25\.10\.2026/.test($("dataStamp").textContent), $("dataStamp").textContent);
check("Öffnungszeiten-Status gerendert", doc.querySelectorAll(".status-dot").length > 50);
check("keine JS-Fehler", errors.length === 0, errors.join(" / "));

console.log("\n== Filter ==");
const restChip = doc.querySelector(".chip[data-cat='restaurant']");
restChip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Restaurants abschaltbar", doc.querySelectorAll(".card").length < 84, String(doc.querySelectorAll(".card").length));
restChip.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("wieder 84 Karten", doc.querySelectorAll(".card").length === 84);

const search = $("search");
search.value = "smørrebrød";
search.dispatchEvent(new window.Event("input", { bubbles: true }));
const n = doc.querySelectorAll(".card").length;
check("Suche 'smørrebrød' filtert", n > 0 && n < 20, String(n));
search.value = "";
search.dispatchEvent(new window.Event("input", { bubbles: true }));

const openOnly = $("openOnly");
openOnly.checked = true;
openOnly.dispatchEvent(new window.Event("change", { bubbles: true }));
const openCount = doc.querySelectorAll(".card").length;
check("'Nur jetzt geöffnet' filtert", openCount > 0 && openCount < 81, String(openCount));
openOnly.checked = false;
openOnly.dispatchEvent(new window.Event("change", { bubbles: true }));

console.log("\n== Detailansicht ==");
const card = doc.querySelector(".card[data-id='gasoline-grill']") || doc.querySelector(".card");
card.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 60));
check("Drawer sichtbar", !$("drawer").hidden);
check("Drawer hat Inhalt", $("drawer").innerHTML.includes("Tipps"));
check("Öffnungszeiten-Tabelle", $("drawer").querySelectorAll(".hours-table tr").length > 0);
check("Menü-Link vorhanden", !!$("drawer").querySelector("a[href*='menu']"));
check("Google-Maps-Route", !!$("drawer").querySelector("a[href*='google.com/maps']"));
const closeBtn = $("drawerClose");
closeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check("Drawer schließt", $("drawer").hidden);

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
check("Sortierung nach Preis läuft", doc.querySelectorAll(".card").length === 84);
check("keine Gruppen-Header bei Preissortierung", doc.querySelectorAll(".list .group").length === 0);

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
