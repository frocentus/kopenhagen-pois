// Erntet pro Gastro-Ort: Menü-Link (aus den echten <a href> der Website) und
// Öffnungszeiten-Hinweise (Text um "Åbningstider"/"Opening hours").
// Ausgabe ist bewusst kompakt – dient als Arbeitsliste, nicht als Quelle.
import fs from "node:fs";

const UA = "Mozilla/5.0 (compatible; kopenhagen-poi-builder/1.0)";
const targets = [
  { id: "atelier-september", url: "https://cafeatelierseptember.com/" },
  { id: "sonny", url: "https://www.sonnycph.dk/" },
  { id: "democratic-coffee", url: "https://www.democraticcoffee.dk/" },
  { id: "kafbar", url: "https://kaf-bar.dk/" },
  { id: "dyrehaven", url: "https://www.dyrehavenkbh.dk" },
  { id: "lagkagehuset", url: "https://lagkagehuset.dk/" },
  { id: "lille-fugl", url: "https://www.flerefugle.dk/en/lille-fugl" },
  { id: "emmerys", url: "https://emmerys.dk/" },
  { id: "frenchy", url: "https://www.frenchy.dk/" },
  { id: "hoest", url: "https://cofoco.dk/en/restaurant/hoest" },
  { id: "vaekst", url: "https://cofoco.dk/en/restaurant/vaekst" },
  { id: "palaegade", url: "https://formelbgroup.dk/palaegade/" },
  { id: "norrlyst", url: "https://norrlyst.dk/" },
  { id: "marchal", url: "https://www.marchal.dk/" },
  { id: "fiskebar", url: "https://fiskebaren.dk/en/" },
  { id: "cap-horn", url: "https://tholstrup.dk/cap-horn/" },
  { id: "dandelion-burger", url: "https://www.dandelionburger.com/" },
  { id: "broens-gadekoekken", url: "https://broensstreetfood.dk/" },
  { id: "marmorkirken", url: "https://www.marmorkirken.dk/" },
  { id: "mcdonalds-nyhavn", url: "https://www.mcdonalds.com/dk/da-dk/menu.html" },
  { id: "burger-king-stroget", url: "https://www.burgerking.dk/" },
  { id: "dominos-christianshavn", url: "https://www.dominos.dk/" },
];

async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "da,en;q=0.8" },
      });
      const html = r.status === 200 ? await r.text() : "";
      return { status: r.status, final: r.url, html };
    } catch (e) {
      if (i === tries - 1) return { status: 0, final: url, html: "", error: e.name };
    } finally {
      clearTimeout(t);
    }
  }
}

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const MENU_RE = /(menu|menukort|spisekort|kort\b|madkort|card|dinner|drinks|vin|frokost)/i;

function menuCandidates(html, baseUrl) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const label = textOf(m[2]).slice(0, 60);
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    let abs;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(abs)) continue;
    const hay = (label + " " + abs).toLowerCase();
    if (!MENU_RE.test(hay)) continue;
    if (/privacy|cookie|policy|handelsbetingelser|job|kontakt|login|cart|kurv/i.test(abs)) continue;
    seen.add(abs);
    let score = 0;
    if (/menukort|spisekort/i.test(hay)) score += 5;
    if (/\/menu/i.test(abs)) score += 4;
    if (/^menu/i.test(label.toLowerCase())) score += 3;
    if (/menukort|speisekarte|menu/i.test(label)) score += 2;
    if (/vinkort|wine|drinks|bar/i.test(hay)) score -= 2;
    out.push({ abs, label, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

function hoursSnippet(text) {
  const m = text.match(/(åbningstider|åbent|opening hours|opening times|open(ing)?\s*hours)/i);
  if (!m) return null;
  return text.slice(m.index, m.index + 220).replace(/\s+/g, " ").trim();
}

const results = [];
async function work(t) {
  const page = await get(t.url);
  const text = textOf(page.html);
  const cands = page.html ? menuCandidates(page.html, page.final) : [];
  const verified = [];
  for (const c of cands) {
    const r = await get(c.abs, 1);
    if (r.status === 200) verified.push({ url: r.final, label: c.label, status: r.status });
  }
  results.push({
    id: t.id,
    pageStatus: page.status,
    finalUrl: page.final,
    menu: verified,
    hours: hoursSnippet(text),
  });
}

let i = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (i < targets.length) await work(targets[i++]);
}));

fs.writeFileSync("data/research-web.json", JSON.stringify(results, null, 1));
for (const r of results.sort((a, b) => a.id.localeCompare(b.id))) {
  console.log("## " + r.id + "  (HTTP " + r.pageStatus + ")");
  if (r.menu.length) r.menu.forEach((m) => console.log("   MENU  " + m.url + "   [" + m.label + "]"));
  else console.log("   MENU  –");
  console.log("   ZEIT  " + (r.hours || "–"));
}
