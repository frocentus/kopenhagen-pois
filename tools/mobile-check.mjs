// Mobile-/Touch-Prüfung mit echtem Chromium (Edge) über CDP – ohne npm-Abhängigkeiten.
// Aufruf:  node tools/mobile-check.mjs [breite] [höhe] [url]
// Findet Touch-Probleme (Button reagiert nicht, verdeckt, zu klein), die jsdom nicht sieht.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const WIDTH = parseInt(process.argv[2] || "390", 10); // iPhone 14/15 logisch
const HEIGHT = parseInt(process.argv[3] || "844", 10);
const ROOT = process.cwd();

const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const browser = BROWSERS.find((p) => fs.existsSync(p));
if (!browser) {
  console.error("Kein Chromium/Edge gefunden.");
  process.exit(1);
}

// ----------------------------------------------------------- statischer Server
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) {
    res.writeHead(404);
    return res.end("nf");
  }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const url = process.argv[4] || base;

// ------------------------------------------------------------------- Browser
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cph-mobile-"));
const port = 9333 + Math.floor(Math.random() * 200);
const proc = spawn(browser, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

async function getJson(p) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}${p}`);
      if (r.ok) return await r.json();
    } catch (e) { /* noch nicht bereit */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("DevTools nicht erreichbar");
}

const targets = await getJson("/json/list");
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let seq = 0;
const waiting = new Map();
const events = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiting.has(m.id)) {
    const { res, rej } = waiting.get(m.id);
    waiting.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  } else if (m.method) {
    events.push(m.method);
  }
};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    waiting.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true,
});
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Page.navigate", { url });

// auf Rendern warten (Daten kommen per fetch)
for (let i = 0; i < 60; i++) {
  const ready = await evalJs("!!document.querySelector('.card')").catch(() => false);
  if (ready) break;
  await new Promise((r) => setTimeout(r, 200));
}
await new Promise((r) => setTimeout(r, 400));

// ------------------------------------------------------------------ Diagnose
const report = await evalJs(`(() => {
  const b = document.getElementById('sidebarToggle');
  const r = b.getBoundingClientRect();
  const cs = getComputedStyle(b);
  const cx = Math.round(r.left + r.width / 2);
  const cy = Math.round(r.top + r.height / 2);
  const top = document.elementFromPoint(cx, cy);
  return {
    exists: !!b,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    display: cs.display, visibility: cs.visibility, zIndex: cs.zIndex, pointerEvents: cs.pointerEvents,
    opacity: cs.opacity, touchAction: cs.touchAction,
    topElementAtCenter: top ? (top.id || top.className || top.tagName) : null,
    isSelfOnTop: top === b || b.contains(top),
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    sidebarOpenClass: document.body.classList.contains('sidebar-open'),
    sidebarRect: (() => { const s = document.querySelector('.sidebar'); const q = s.getBoundingClientRect(); return { y: Math.round(q.y), h: Math.round(q.height) }; })(),
  };
})()`);
console.log("Button:", JSON.stringify(report, null, 1));

// ------------------------------------------------------------ echter Touch-Tap
async function tap(x, y) {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, radiusX: 10, radiusY: 10, force: 1 }] });
  await new Promise((r) => setTimeout(r, 60));
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((r) => setTimeout(r, 350));
}

// Geometrie für iOS-Tauglichkeit
const geo = await evalJs(`(() => {
  const b = document.getElementById('sidebarToggle');
  const r = b.getBoundingClientRect();
  return {
    heightPx: Math.round(r.height),
    widthPx: Math.round(r.width),
    gapToBottomPx: Math.round(innerHeight - r.bottom),
    touchAction: getComputedStyle(b).touchAction,
  };
})()`);
console.log("\nTouch-Ziel:", JSON.stringify(geo));
console.log("  >= 44 px hoch:", geo.heightPx >= 44, "| Abstand unten >= 14 px:", geo.gapToBottomPx >= 14, "| touch-action manipulation:", geo.touchAction === "manipulation");


/**
 * Mal-Prüfung: Anteil reiner Weiß-Pixel im Sheet-Band.
 * Die Karte liefert fast nie große reine Weißflächen, das Sheet (var(--panel)
 * = #ffffff) schon. Damit lässt sich erkennen, ob das Sheet wirklich *gemalt*
 * wird – ein reiner DOM-Check hat den z-index-Bug nicht gefunden.
 */
async function whiteShare(cssX, cssY, cssW, cssH) {
  // Geclippt und verkleinert aufnehmen: hält den Base64-Payload klein,
  // sonst hängt Runtime.evaluate bei großen Screenshots (dpr 3).
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    clip: { x: cssX, y: cssY, width: cssW, height: cssH, scale: 0.5 },
  });
  return await evalJs(`new Promise(res => {
    const i = new Image();
    i.onload = () => {
      const c = document.createElement('canvas');
      c.width = i.width; c.height = i.height;
      const x = c.getContext('2d');
      x.drawImage(i, 0, 0);
      const d = x.getImageData(0, 0, i.width, i.height).data;
      let n = 0, white = 0;
      for (let k = 0; k < d.length; k += 4) {
        if (d[k] >= 248 && d[k + 1] >= 248 && d[k + 2] >= 248) white++;
        n++;
      }
      res(Math.round((white / n) * 100));
    };
    i.onerror = () => res(-1);
    i.src = 'data:image/png;base64,' + ${JSON.stringify(shot.data)};
  })`);
}

const cx = report.rect.x + report.rect.w / 2;
const cy = report.rect.y + report.rect.h / 2;
console.log("  [schritt] messen zu") ;const paintClosed = await whiteShare(0, 300, WIDTH, 500);
const mapBrightClosed = await whiteShare(0, 150, WIDTH, 40); // nur Kartenfläche
await tap(cx, cy);

const afterTap = await evalJs(`(() => {
  const s = document.querySelector('.sidebar').getBoundingClientRect();
  return {
    sidebarOpen: document.body.classList.contains('sidebar-open'),
    ariaExpanded: document.getElementById('sidebarToggle').getAttribute('aria-expanded'),
    backdropVisible: !document.getElementById('sheetBackdrop').hidden,
    sidebarTopY: Math.round(s.y),
    sidebarVisible: s.top < innerHeight && s.bottom > 0,
    sheetHeadVisible: !!document.querySelector('.sheet-head') && getComputedStyle(document.querySelector('.sheet-head')).display !== 'none',
    toggleHiddenWhileOpen: getComputedStyle(document.getElementById('sidebarToggle')).display === 'none',
  };
})()`);
console.log("\nNach Touch-Tap auf den Button:", JSON.stringify(afterTap, null, 1));

const paintOpen = await whiteShare(0, 300, WIDTH, 500);
const mapBrightOpen = await whiteShare(0, 150, WIDTH, 40);
console.log("\nMal-Prüfung (Weißanteil im Sheet-Band y300-800):");
console.log("  geschlossen:", paintClosed + "%", paintClosed < 20 ? "=> Karte sichtbar" : "=> unerwartet hell");
console.log("  geöffnet:  ", paintOpen + "%", paintOpen > 60 ? "=> Sheet liegt darüber" : "=> FEHLER: Karte noch sichtbar");
const paintOk = paintClosed < 20 && paintOpen > 60;

// Backdrop abdunkeln? (Weißanteil der Karte muss beim Öffnen sinken)
console.log("\nBackdrop-Dimmung (Weißanteil Kartenfläche oben):");
console.log("  geschlossen:", mapBrightClosed + "%", "| geöffnet:", mapBrightOpen + "%",
  mapBrightOpen <= mapBrightClosed ? "=> Karte wird abgedunkelt" : "=> FEHLER: kein Dimmen");
const dimOk = mapBrightOpen <= mapBrightClosed;

console.log("  [schritt] screenshot 1");const shot1 = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
const p1 = path.join(os.tmpdir(), `cph-sheet-open-${WIDTH}x${HEIGHT}.png`);
fs.writeFileSync(p1, Buffer.from(shot1.data, "base64"));

// Backdrop antippen -> schließen
await tap(Math.round(WIDTH / 2), 120);
const afterBackdrop = await evalJs(`({ open: document.body.classList.contains('sidebar-open'), backdropHidden: document.getElementById('sheetBackdrop').hidden })`);
console.log("\nNach Tap auf Backdrop (Karte oben):", JSON.stringify(afterBackdrop));

// nochmal öffnen, dann über das Kreuz schließen
await new Promise((r) => setTimeout(r, 450));
await tap(cx, cy);
const reopened = await evalJs(`document.body.classList.contains('sidebar-open')`);
const closeRect = await evalJs(`(() => { const r = document.getElementById('sheetClose').getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2), h: Math.round(r.height) }; })()`);
await tap(closeRect.x, closeRect.y);
const afterClose = await evalJs(`({ open: document.body.classList.contains('sidebar-open'), toggleVisible: getComputedStyle(document.getElementById('sidebarToggle')).display !== 'none' })`);
console.log("Wieder geöffnet:", reopened, "| Kreuz-Tap schließt:", !afterClose.open, "| Button wieder sichtbar:", afterClose.toggleVisible, "| Kreuz-Höhe:", closeRect.h + "px");

console.log("  [schritt] screenshot 2");const shot2 = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
const p2 = path.join(os.tmpdir(), `cph-map-${WIDTH}x${HEIGHT}.png`);
fs.writeFileSync(p2, Buffer.from(shot2.data, "base64"));
console.log("\nScreenshots:\n  " + p1 + "\n  " + p2);

const ok = paintOk && dimOk && afterTap.sidebarOpen === true && afterBackdrop.open === false && reopened === true && afterClose.open === false && geo.heightPx >= 44 && afterTap.sheetHeadVisible && afterTap.toggleHiddenWhileOpen;
console.log("\n" + (ok ? "ERGEBNIS: Sheet-Steuerung voll funktionsfähig" : "ERGEBNIS: FEHLER in der Sheet-Steuerung"));

ws.close();
proc.kill();
server.close();
process.exit(ok ? 0 : 2);
