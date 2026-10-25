// Verify homepage + guessed menu URLs; only 200s get written into the dataset.
import fs from "node:fs";

const HOMES = {
  tivoli: "https://www.tivoli.dk/",
  rundetaarn: "https://www.rundetaarn.dk/en/visit-us/",
  rosenborg: "https://denkongeligesamling.dk/en/rosenborg-castle/",
  christiansborg: "https://denkongeligesamling.dk/en/christiansborg-palace/",
  amalienborg: "https://denkongeligesamling.dk/en/amalienborg/",
  nationalmuseet: "https://www.nationalmuseet.dk/en/",
  glyptoteket: "https://www.glyptoteket.dk/en/",
  smk: "https://www.smk.dk/en/",
  designmuseum: "https://designmuseum.dk/en/",
  botanisk: "https://snm.dk/en/botanical-garden",
  vorfrelser: "https://vorfrelserskirke.dk/",
  domkirken: "https://www.domkirken.dk/",
  marmorkirken: "https://www.marmorkirken.dk/",
  diamant: "https://www.kb.dk/en",
  torvehallerne: "https://torvehallernekbh.dk/",
  hoest: "https://cofoco.dk/en/restaurants/hoest/",
  vaekst: "https://cofoco.dk/en/vaekst/",
  schonnemann: "https://www.restaurantschonnemann.dk/",
  pluto: "https://restaurantpluto.dk/",
  marchal: "https://www.marchal.dk/",
  fiskebar: "https://fiskebaren.dk/en/",
  baest: "https://baest.dk/",
  mangia: "https://mangia.dk/",
  caphorn: "https://www.caphorn.dk/",
  palaegade: "https://palaegade.dk/",
  marvogben: "https://www.marvogben.dk/",
  norrlyst: "https://norrlyst.dk/",
  bistroboheme: "https://bistroboheme.dk/",
  aoc: "https://www.restaurantaoc.dk/",
  konghans: "https://konghans.dk/",
  husmanns: "https://www.husmannsvinstue.dk/",
  nyhavn17: "https://www.nyhavn17.dk/",
  kanalen: "https://restaurant-kanalen.dk/",
  gasoline: "https://www.gasolinegrill.com/",
  dandelion: "https://www.dandelionburger.com/",
  tommis: "https://www.burgerjoint.dk/",
  jagger: "https://www.jagger.dk/",
  sunset: "https://sunset-boulevard.dk/",
  broens: "https://broensgadekoekken.dk/",
  atelier: "https://cafeatelierseptember.com/",
  sonny: "https://www.sonnycph.dk/",
  dyrehaven: "https://www.dyrehavenkbh.dk/",
  madogkaffe: "https://madogkaffe.dk/en/",
  hart: "https://hartbageri.com/",
  kafbar: "https://kaf-bar.dk/",
  frenchy: "https://www.frenchy.dk/",
  groed: "https://www.groed.com/",
  lagkagehuset: "https://lagkagehuset.dk/",
  emmerys: "https://emmerys.dk/",
  illumnet: "https://www.illum.dk/",
  magasin: "https://www.magasin.dk/",
  fisketorvet: "https://www.westfield.com/da/denmark/fisketorvet",
  frbc: "https://frbc-shopping.dk/",
  netto: "https://netto.dk/",
  rema1000: "https://rema1000.dk/",
  foetex: "https://www.foetex.dk/",
  coop365: "https://coop365.coop.dk/",
  superbrugsen: "https://superbrugsen.coop.dk/",
  meny: "https://meny.dk/",
  lidl: "https://www.lidl.dk/",
  syve: "https://www.7-eleven.dk/",
  reffen: "https://reffen.dk/",
  kokkeriet: "https://kokkeriet.dk/",
  creme: "https://www.cremeguides.com/",
};

const MENU_GUESSES = [
  ["hoest", ["https://cofoco.dk/en/restaurants/hoest/#menu", "https://cofoco.dk/en/restaurants/hoest/menu/"]],
  ["vaekst", ["https://cofoco.dk/en/vaekst/menu/"]],
  ["schonnemann", ["https://www.restaurantschonnemann.dk/menu", "https://www.restaurantschonnemann.dk/en/menu"]],
  ["pluto", ["https://restaurantpluto.dk/menu", "https://restaurantpluto.dk/en/menu"]],
  ["marchal", ["https://www.marchal.dk/menu", "https://www.marchal.dk/en/menu"]],
  ["fiskebar", ["https://fiskebaren.dk/en/menu", "https://fiskebaren.dk/menu"]],
  ["baest", ["https://baest.dk/menu", "https://baest.dk/en/menu"]],
  ["mangia", ["https://mangia.dk/menu", "https://mangia.dk/en/menu"]],
  ["caphorn", ["https://www.caphorn.dk/menu"]],
  ["palaegade", ["https://palaegade.dk/menu", "https://palaegade.dk/en/menu"]],
  ["marvogben", ["https://www.marvogben.dk/menu", "https://www.marvogben.dk/en/menu"]],
  ["norrlyst", ["https://norrlyst.dk/menu"]],
  ["bistroboheme", ["https://bistroboheme.dk/menu", "https://bistroboheme.dk/en/menu"]],
  ["aoc", ["https://www.restaurantaoc.dk/menu"]],
  ["konghans", ["https://konghans.dk/menu", "https://konghans.dk/en/menu"]],
  ["husmanns", ["https://www.husmannsvinstue.dk/menu"]],
  ["nyhavn17", ["https://www.nyhavn17.dk/menu"]],
  ["kanalen", ["https://restaurant-kanalen.dk/menu"]],
  ["gasoline", ["https://www.gasolinegrill.com/menu"]],
  ["dandelion", ["https://www.dandelionburger.com/menu"]],
  ["jagger", ["https://www.jagger.dk/menu"]],
  ["sunset", ["https://sunset-boulevard.dk/menu"]],
  ["tommijoint", ["https://www.burgerjoint.dk/menu"]],
  ["atelier", ["https://cafeatelierseptember.com/menu"]],
  ["sonny", ["https://www.sonnycph.dk/menu"]],
  ["madogkaffe", ["https://madogkaffe.dk/en/menu"]],
];

async function probe(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; kopenhagen-poi-builder/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    return { url, status: r.status, final: r.url };
  } catch (e) {
    return { url, status: 0, error: e.name };
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

const homeRes = await pool(Object.entries(HOMES), 8, ([k, u]) => probe(u).then((r) => ({ k, ...r })));
console.log("== Homepages ==");
for (const r of homeRes) console.log((r.status === 200 ? "OK  " : "BAD ") + r.status + "  " + r.k + "  " + r.url + (r.final && r.final !== r.url ? " -> " + r.final : ""));

const menuRes = [];
for (const [k, urls] of MENU_GUESSES) {
  const rs = await pool(urls, 2, probe);
  const ok = rs.find((r) => r.status === 200);
  menuRes.push({ k, ok: ok ? ok.final : null, tried: rs.map((r) => r.status) });
  console.log("MENU " + (ok ? "OK  " : "none") + " " + k + "  " + (ok ? ok.final : JSON.stringify(rs.map((r) => r.status))));
}

fs.writeFileSync(
  "data/linkcheck.json",
  JSON.stringify({ home: homeRes, menu: menuRes, checkedAt: new Date().toISOString() }, null, 1),
);
