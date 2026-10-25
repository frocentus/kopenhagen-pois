# Kopenhagen Stadtplan 🧭

**Live:** https://frocentus.github.io/kopenhagen-pois/  ·  **Repo:** https://github.com/frocentus/kopenhagen-pois

Statische Karte (GitHub Pages) für Kopenhagens Stadtzentrum mit **84 kuratierten Orten**:

| Kategorie | Anzahl | Inhalte |
|---|---|---|
| 🏛 Sehenswürdigkeiten | 22 | Eintrittspreise, Öffnungszeiten, Tipps |
| 🥐 Frühstück & Brunch | 11 | Cafés, Bäckereien, Brunch-Spots |
| 🍽 Restaurants | 22 | Smørrebrød bis Michelin, Preisvergleich |
| 🍔 Fast Food | 9 | Burger, Fritten, Pizza, Streetfood |
| 🛒 Supermärkte | 16 | inkl. 4× 7-Eleven, echte Öffnungszeiten |
| 🛍 Einkaufszentren | 4 | Kaufhäuser & Malls |

**Features**

- Leaflet-Karte mit OpenStreetMap-Kacheln (ohne API-Key), Marker-Clustering und Layer-Umschalter (Karte / Rad & Wandern)
- Filter nach Kategorie, Volltextsuche, Sortierung (Empfehlung, Name, Bewertung, Preis, Entfernung)
- **„Nur jetzt geöffnet"** – berechnet aus den OSM-Öffnungszeiten in Zeitzone `Europe/Copenhagen`, inkl. Saisonregeln, Nachtöffnung und Feiertagsausnahmen
- Detailansicht mit Beschreibung, Tipps, Wochen-Öffnungszeiten, Preisen, Bewertung, Website/Speisekarte und Google-Maps-Route
- **Preisvergleich** als sortierbare Tabelle (Restaurants + Fast Food, Hauptgericht in DKK)
- **Supermärkte ohne Bewertung**: Filialen von Ketten (Netto, Føtex, Rema 1000, 7-Eleven …) werden bewusst ohne Bewertung geführt – dort erscheint weder eine Zahl noch ein Platzhalter
- **Transparente Datenlücken**: Orte ohne Bewertung sind sichtbar als „— keine Bewertung" markiert (mit Begründung im Detail, z. B. Kette, abweichende Quellen, kein Profil); Gastro-Orte ohne Online-Karte zeigen „Keine Speisekarte online" samt Erklärung
- **Mobil**: Bottom-Sheet mit Backdrop, Schließen-Kreuz, 48-px-Touch-Ziel und `env(safe-area-inset-bottom)` (nicht in der iOS-Home-Indicator-Zone)
- Deep-Links pro Ort (`#gasoline-grill`), Dark Mode

## Struktur

```
index.html                 Seite (Layout + CDN-Einbindung von Leaflet)
assets/style.css           Design, Light/Dark, responsive
assets/app.js              Karte, Filter, Liste, Detailansicht, Preisvergleich
assets/hours.js            Parser für OSM-Öffnungszeiten + "jetzt geöffnet"
data/places.json           Der kuratierte Datensatz (alle Inhalte)
tools/                     Hilfsskripte zum Auffrischen der Daten und Testen (nicht für die Seite nötig)
.github/workflows/pages.yml Deploy-Workflow
```

Es gibt **keinen Build-Schritt**: reines HTML/CSS/JS, keine Bundler, keine Tracker.
Einzige externe Abhängigkeiten sind Leaflet, Leaflet.markercluster und die Kartenkacheln (CDN).

## Lokal starten

`fetch()` auf `data/places.json` funktioniert nicht per `file://`, deshalb kurz einen Server starten:

```bash
npx serve .
# oder
npx http-server .
```

Dann <http://localhost:3000> öffnen.

## Auf GitHub Pages veröffentlichen

1. Repo anlegen und pushen (Branch `main`):

   ```bash
   git init
   git add .
   git commit -m "Kopenhagen Stadtplan"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```

2. Im Repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Der Workflow `.github/workflows/pages.yml` läuft bei jedem Push auf `main` und veröffentlicht die Seite.
   URL: `https://<user>.github.io/<repo>/` (bzw. `https://<user>.github.io/` bei einem `*.github.io`-Repo).

Alle Pfade sind relativ – die Seite funktioniert damit auch in einem Unterpfad.
`.nojekyll` ist vorhanden, damit keine Dateien durch Jekyll gefiltert werden.

## Daten pflegen

Alle Inhalte stehen in `data/places.json`. Ein Eintrag:

```jsonc
{
  "id": "gasoline-grill",          // eindeutig, wird zum Deep-Link
  "name": "Gasoline Grill",
  "cat": "fastfood",               // attraction | breakfast | restaurant | fastfood | supermarket | mall
  "sub": "Burger in alter Tankstelle",
  "lat": 55.68324, "lon": 12.58517,
  "area": "Indre By / Landgreven", // Viertel, wird in Liste und Detail angezeigt
  "rating": 4.5,                   // optional; null = keine belastbare Bewertung
  "ratingSource": "Google",        // "Google" oder "Tripadvisor"
  "ratingNote": null,              // Begründung wenn rating fehlt (wird angezeigt)
  "reviews": "—",
  "priceLevel": 1,                 // 0–4, steuert die Preis-Punkte
  "mainDKK": 85,                   // optional: typischer Hauptgerichts-Preis (Preisvergleich)
  "priceText": "Burger ca. 85 DKK · Menü ca. 125 DKK",
  "hours": "Mo-Su 11:00-22:00",    // OSM-opening_hours-Syntax oder null
  "hoursNote": "Bei Andrang Warteschlange …",
  "desc": "…",
  "tips": ["…", "…"],
  "website": "https://…",           // optional
  "menu": "https://…/menu",         // optional
  "menuNote": null,                 // Begründung wenn Gastro ohne Karte (wird angezeigt)
  "photo": {                        // optional, von tools/fetch-photos.mjs erzeugt
    "url": "https://upload.wikimedia.org/…/960px-….jpg",
    "page": "https://commons.wikimedia.org/wiki/File:…",
    "author": "…",
    "license": "CC BY-SA 4.0",
    "credit": "Wikipedia · Nyhavn"
  },
  "wiki": "Nyhavn",                 // optional: exakter Wikipedia-Artikeltitel
  "tags": ["Burger", "Kult"],
  "src": "Quelle · Okt 2026"
}
```

### Öffnungszeiten-Syntax

`assets/hours.js` versteht die in den Daten genutzten OSM-Muster, u. a.:

- `"24/7"`
- `"Mo-Su 07:00-22:00"`, `"Mo-Fr 07:30-17:00; Sa,Su 09:00-16:00"`, `"Tu,We 10:00-21:00"`
- mehrere Zeitfenster: `"Mo-Th 07:30-10:00,12:00-16:30,18:00-22:00"`
- über Mitternacht: `"Su-Th 11:30-24:00, Fr,Sa 11:30-01:00"`
- Saison: `"May 01-Sep 30; Mo-Su 10:00-20:00; Oct 01-Apr 30; …"` und `"Apr-Sep: 08:30-18:00, Oct-Mar: 08:30-16:00"`
- Kalenderwochen: `"week 1-26 Mo-Fr 06:30-19:00; week 27-32 …"`
- Schließtage: `"Mo closed"`, `"PH off"` (Feiertage werden ignoriert)

Nicht unterstützt: `not public`, Ausnahmen mit konkreten Daten (z. B. `Dec 24 off`) – solche Hinweise
gehören in `hoursNote`.

### Daten auffrischen

Die Skripte in `tools/` sind reine Node-Skripte ohne Abhängigkeiten (Ausnahme: `smoke.mjs` nutzt `jsdom`):

```bash
node tools/fetch-osm.mjs      # Koordinaten/Öffnungszeiten/Websites aus Overpass ziehen
node tools/fetch-shops.mjs    # alle Supermärkte/Malls im Zentrum
node tools/fetch-photos.mjs   # Fotos aus Wikipedia/Commons holen und Credits setzen
node tools/linkcheck.mjs      # Website- und Menü-Links auf HTTP-Status prüfen
node tools/test-hours.mjs     # Parser gegen alle Datensätze prüfen
node tools/smoke.mjs          # UI-Smoke-Test ohne Browser (npm i jsdom)
node tools/mobile-check.mjs 390 844              # echte Touch-/Mal-Prüfung (Edge/Chrome)
node tools/mobile-check.mjs 390 844 https://frocentus.github.io/kopenhagen-pois/
```

`mobile-check.mjs` steuert ein headless Chromium per DevTools-Protokoll (ohne npm-Pakete),
emuliert iPhone-Größen, tippt per echtem Touch-Event auf den „Liste"-Button und prüft **per
Pixelmessung**, ob das Bottom-Sheet tatsächlich gezeichnet wird und der Backdrop die Karte
abdunkelt. Ein reiner DOM-Test hätte den z-index-Bug unten nicht gefunden.

## Bekannte Fallstricke (schon gelöst)

- **Kartenkacheln mit API-Key**: CARTO-Basemaps liefern ohne Key nur eine 2-KB-Platzhaltergrafik.
  Deshalb `tile.openstreetmap.org` (Standard) + CyclOSM, beide ohne Key.
- **z-index-Kollision mit Leaflet**: `.leaflet-map-pane` hat `z-index: 400`. Da `.map-wrap`
  `z-index: 0` + `isolation: isolate` bekommt, bleiben Leaflets Panes in ihrem eigenen
  Stacking-Context – sonst überdeckt die Karte das mobile Bottom-Sheet (Button schaltet um,
  aber nichts wird sichtbar).
- **iOS-Safe-Area**: Bedienelemente am unteren Rand brauchen
  `bottom: calc(... + env(safe-area-inset-bottom))` und ≥ 44 px Höhe, sonst liegen sie in der
  Home-Indicator-/Safari-Toolbar-Zone und Taps gehen verloren.

## Quellen & Genauigkeit

- **Öffnungszeiten**: OpenStreetMap (`opening_hours`), Lizenz ODbL, Abruf Oktober 2026.
- **Eintrittspreise, Bewertungen, Beschreibungen**: VisitCopenhagen, kopenhagen.info, Anbieterseiten
  sowie Google-Rezensionen (über Exa Places). Stand: Oktober 2026.
- **Preisniveau (`mainDKK`)**: Schätzung anhand der Speisekarten – im Preisvergleich als „ca." gekennzeichnet.
- **Bewertungen**: Google-Werte (über Exa Places) bzw. Tripadvisor, wo nur dort eine belastbare Zahl existiert
  (`ratingSource`). Wo keine eindeutige Zuordnung zur konkreten Filiale möglich ist – Ketten wie Netto,
  7-Eleven, Lagkagehuset, McDonald's oder widersprüchliche Quellen – bleibt `rating` leer und `ratingNote`
  nennt den Grund. Die Oberfläche zeigt das explizit an, statt eine Zahl zu erfinden.
- **Öffnungszeiten**: Wo OSM leer war, wurden die Betreiber-Websites ausgewertet (Marmorkirche, Lille Fugl,
  Palægade, Krebsegaarden, Skipperkroen, Mangia). Öffentlich zugängliche Orte (Nyhavn, Kleine Meerjungfrau,
  Strøget, Kastellet) stehen als `24/7`. Die vier verbleibenden Lücken sind im Datensatz begründet.
- **Fotos**: `tools/fetch-photos.mjs` übernimmt das Lead-Bild des Wikipedia-Artikels – aber nur, wenn der
  Artikel eine Koordinate besitzt, die innerhalb von 500 m zum Ort liegt. Genau dieser Test wirft die
  mehrdeutigen Artikelnamen aus („Geranium“ = Storchschnabel, „Pluto“ = Zwergplanet, „Alchemist“ = Alchemie,
  „Jagger“ = Katzenrasse) und alle Ketten-Artikel (Føtex, Lidl, 7-Eleven, SuperBrugsen), die keinen konkreten
  Standort beschreiben. Ergebnis: 31 von 106 Orten haben ein Bild, die übrigen bewusst keines – kein Raten,
  kein Platzhalter, kein Bild eines anderen Standorts. Autor und Lizenz stehen unter jedem Foto, die
  Dateiseite ist verlinkt. Das Skript schreibt die Liste der Orte ohne Bild nach
  `data/photo-review.json` (Zwischenergebnis, nicht eingecheckt).

Preise, Öffnungszeiten und Bewertungen ändern sich. Die Seite zeigt bewusst die Quelle pro Eintrag an;
vor dem Besuch lohnt ein Blick auf die offizielle Website (im Detail-Panel verlinkt).

## Lizenz

Code: frei verwendbar (MIT). Kartendaten und Kacheln: © OpenStreetMap-Mitwirkende (ODbL) – Standard-Kacheln von tile.openstreetmap.org, alternativ CyclOSM. Kein API-Key nötig.
Texte und Zusammenstellung: eigene Arbeit – Angaben ohne Gewähr.
