import fs from "node:fs";
const H = await import("../assets/hours.js").then(m => m.default || globalThis.CPHHours);
const data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));

// Referenzdatum: 2026-10-25 (Sonntag), 13:15 UTC -> 14:15 CPH (CET+1 -> 14:15)
const ref = new Date(Date.UTC(2026, 9, 25));
let unknown = 0, bad = 0;
const now = { weekday: 0, minutes: 14 * 60 + 15 }; // Sonntag 14:15

for (const p of data.places) {
  if (!p.hours) continue;
  const parsed = H.parse(p.hours, ref);
  if (!parsed) { console.log("PARSE-FAIL:", p.id, "|", p.hours); bad++; continue; }
  const week = H.weekTable(parsed).map(r => r.label + " " + r.value).join(" | ");
  const st = H.status(parsed, now);
  console.log(`${p.id}\n   ${week}\n   -> ${st.text}`);
}
console.log("\nFAIL:", bad);

// gezielte Einzelfälle
const cases = [
  ["Mo-Fr 07:30-17:00; Sa,Su 09:00-16:00", 2, 9*60],   // Di 09:00 offen
  ["Mo-Fr 07:30-17:00; Sa,Su 09:00-16:00", 2, 8*60],    // Di 08:00 zu
  ["Su-Th 11:30-24:00, Fr,Sa 11:30-01:00", 5, 0*60+30], // Sa 00:30 offen
  ["24/7", 3, 3*60],
  ["May 01-Sep 30; Mo-Su 10:00-20:00; Oct 01-Apr 30; Mo,Th-Su 10:00-18:00; Tu,We 10:00-21:00", 6, 20*60+30],
  ["Tu,We 10:00-21:00", 2, 20*60],
  ["10:00-22:00, Fr-Sa 10:00-05:00", 5, 3*60],
];
console.log("\n== Fälle ==");
for (const [h, wd, min] of cases) {
  const p = H.parse(h, ref);
  console.log(`${wd}/${min} ${st(p, wd, min)} :: ${h}`);
}
function st(p, wd, min) { const s = H.status(p, { weekday: wd, minutes: min }); return s.text; }
