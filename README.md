# Kopenhagen Stadtplan 🧭

Statische Karte (GitHub Pages) für Kopenhagens Stadtzentrum mit **81 kuratierten Orten**:

| Kategorie | Anzahl | Inhalte |
|---|---|---|
| 🏛 Sehenswürdigkeiten | 22 | Eintrittspreise, Öffnungszeiten, Tipps |
| 🥐 Frühstück & Brunch | 11 | Cafés, Bäckereien, Brunch-Spots |
| 🍽 Restaurants | 22 | Smørrebrød bis Michelin, Preisvergleich |
| 🍔 Fast Food | 9 | Burger, Fritten, Pizza, Streetfood |
| 🛒 Supermärkte | 13 | echte Öffnungszeiten, Preisniveau |
| 🛍 Einkaufszentren | 4 | Kaufhäuser & Malls |

**Features**

- Leaflet-Karte mit OpenStreetMap-Kacheln, Marker-Clustering und Karten-Layer-Umschalter (Voyager / OSM)
- Filter nach Kategorie, Volltextsuche, Sortierung (Empfehlung, Name, Bewertung, Preis, Entfernung)
- **„Nur jetzt geöffnet"** – berechnet aus den OSM-Öffnungszeiten in Zeitzone `Europe/Copenhagen`, inkl. Saisonregeln, Nachtöffnung und Feiertagsausnahmen
- Detailansicht mit Beschreibung, Tipps, Wochen-Öffnungszeiten, Preisen, Bewertung, Website/Speisekarte und Google-Maps-Route
- **Preisvergleich** als sortierbare Tabelle (Restaurants + Fast Food, Hauptgericht in DKK)
- Deep-Links pro Ort (`#gasoline-grill`), Dark Mode, mobiltaugliches Bottom-Sheet

## Struktur

```
index.html                 Seite (Layout + CDN-Einbindung von Leaflet)
assets/style.css           Design, Light/Dark, responsive
assets/app.js              Karte, Filter, Liste, Detailansicht, Preisvergleich
assets/hours.js            Parser für OSM-Öffnungszeiten + "jetzt geöffnet"
data/places.json           Der kuratierte Datensatz (alle Inhalte)
tools/                     Hilfsskripte zum Auffrischen der Daten (nicht für die Seite nötig)
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
  "rating": 4.5,                   // optional (Google-Bewertung)
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
node tools/linkcheck.mjs      # Website- und Menü-Links auf HTTP-Status prüfen
node tools/test-hours.mjs     # Parser gegen alle Datensätze prüfen
node tools/smoke.mjs          # UI-Smoke-Test ohne Browser (npm i jsdom)
```

## Quellen & Genauigkeit

- **Öffnungszeiten**: OpenStreetMap (`opening_hours`), Lizenz ODbL, Abruf Oktober 2026.
- **Eintrittspreise, Bewertungen, Beschreibungen**: VisitCopenhagen, kopenhagen.info, Anbieterseiten
  sowie Google-Rezensionen (über Exa Places). Stand: Oktober 2026.
- **Preisniveau (`mainDKK`)**: Schätzung anhand der Speisekarten – im Preisvergleich als „ca." gekennzeichnet.

Preise, Öffnungszeiten und Bewertungen ändern sich. Die Seite zeigt bewusst die Quelle pro Eintrag an;
vor dem Besuch lohnt ein Blick auf die offizielle Website (im Detail-Panel verlinkt).

## Lizenz

Code: frei verwendbar (MIT). Kartendaten: © OpenStreetMap-Mitwirkende (ODbL), Kacheln © CARTO.
Texte und Zusammenstellung: eigene Arbeit – Angaben ohne Gewähr.
