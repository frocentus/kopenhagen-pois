/*!
 * hours.js – Öffnungszeiten-Parser für die OSM opening_hours Strings dieser Seite.
 * Bewusst kein vollständiger OSM-Parser, sondern exakt die in data/places.json
 * vorkommenden Muster:
 *   "24/7", "Mo-Su 07:00-22:00", "Mo-Fr 07:30-17:00; Sa,Su 09:00-16:00",
 *   "Mo-Th 07:30-10:00,12:00-16:30,18:00-22:00", "10:00-22:00,Fr-Sa 10:00-05:00",
 *   "May 01-Sep 30; Mo-Su 10:00-20:00; Oct 01-Apr 30; ...", "Apr-Sep: 08:30-18:00",
 *   "week 1-26 Mo-Fr ...", "Mo closed", "PH off", "Mo-Su,PH 10:00-17:00",
 *   "Tu,We 10:00-21:00"
 */
(function (root) {
  "use strict";

  var DAY_KEYS = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
  var DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mo..So
  var DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  var DAY_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  var ALL_DAYS = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };
  var DAY_TOKEN = "mo|tu|we|th|fr|sa|su";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toMin(hhmm) {
    var p = hhmm.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }
  function fmt(min) {
    var m = ((min % 1440) + 1440) % 1440;
    return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  }
  function union(a, b) {
    var out = {};
    [a, b].forEach(function (s) {
      if (!s) return;
      Object.keys(s).forEach(function (k) { out[k] = true; });
    });
    return Object.keys(out).length ? out : null;
  }

  function parseDays(spec) {
    if (!spec) return null;
    var out = {};
    var any = false;
    spec.split(",").forEach(function (chunk) {
      var s = chunk.trim().toLowerCase().replace(/[.]/g, "");
      if (!s) return;
      var m = s.match(new RegExp("^(" + DAY_TOKEN + ")\\s*-\\s*(" + DAY_TOKEN + ")$"));
      if (m) {
        var from = DAY_KEYS[m[1]];
        var to = DAY_KEYS[m[2]];
        var i = from;
        for (var guard = 0; guard < 8; guard++) {
          out[i] = true;
          any = true;
          if (i === to) break;
          i = (i + 1) % 7;
        }
        return;
      }
      if (DAY_KEYS[s] !== undefined) {
        out[DAY_KEYS[s]] = true;
        any = true;
      }
    });
    return any ? out : null;
  }

  /** Saisonangabe am Chunk-Anfang erkennen: "Apr-Oct", "May 01-Sep 30", "Dec". */
  function parseSeason(chunk) {
    var range = chunk.match(
      new RegExp(
        "^(?:\\d{1,2}\\.?\\s*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\\s+(\\d{1,2})(?![\\d:]))?\\s*[-–]\\s*(?:\\d{1,2}\\.?\\s*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\\s+(\\d{1,2})(?![\\d:]))?\\s*:?\\s*",
        "i",
      ),
    );
    if (range) {
      return {
        rest: chunk.slice(range[0].length),
        from: { m: MONTHS.indexOf(range[1].toLowerCase()), d: range[2] ? parseInt(range[2], 10) : 1 },
        to: { m: MONTHS.indexOf(range[3].toLowerCase()), d: range[4] ? parseInt(range[4], 10) : 31 },
      };
    }
    var single = chunk.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\s+\d{1,2}(?![\d:]))?\s*:?\s*/i);
    if (single) {
      var mi = MONTHS.indexOf(single[1].toLowerCase());
      var day = single[2] ? parseInt(single[2].trim(), 10) : null;
      return {
        rest: chunk.slice(single[0].length),
        from: { m: mi, d: day || 1 },
        to: { m: mi, d: day || 31 },
      };
    }
    return null;
  }

  function inSeason(season, date) {
    if (!season) return true;
    var v = date.getUTCMonth() * 100 + date.getUTCDate();
    var a = season.from.m * 100 + season.from.d;
    var b = season.to.m * 100 + season.to.d;
    if (a <= b) return v >= a && v <= b;
    return v >= a || v <= b;
  }

  function parseTimes(text) {
    var out = [];
    var re = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g;
    var m;
    while ((m = re.exec(text))) {
      var s = toMin(m[1]);
      var e = toMin(m[2]);
      if (e === 0) e = 1440; // "bis 00:00" = Tagesende
      if (e <= s) e += 1440; // über Mitternacht
      out.push({ s: s, e: e });
    }
    return out;
  }

  function isoWeek(date) {
    var d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - start) / 86400000 + 1) / 7);
  }

  /**
   * @param {string} raw OSM opening_hours
   * @param {Date} [ref] Referenzdatum für saisonale Regeln
   * @returns {{days: Array<Array<{s:number,e:number}>>, ok: boolean}|null}
   */
  function parse(raw, ref) {
    if (!raw || typeof raw !== "string") return null;
    var text = raw.trim();
    var date = ref || new Date();

    if (/^24\/7$/.test(text)) {
      var full = [];
      for (var f = 0; f < 7; f++) full.push([{ s: 0, e: 1440 }]);
      return { days: full, ok: true, allDay: true };
    }

    var days = [[], [], [], [], [], [], []];
    var closedDays = [false, false, false, false, false, false, false];
    var marker = null; // saisonaler Marker, gilt für folgende Chunks

    text.split(";").forEach(function (chunkRaw) {
      var chunk = chunkRaw.trim();
      if (!chunk) return;

      // Wochenfilter: "week 1-26 ..." – nur den zutreffenden Zeitraum nutzen
      var week = chunk.match(/^week\s+(\d{1,2})\s*-\s*(\d{1,2})\s+(.*)$/i);
      if (week) {
        var w = isoWeek(date);
        if (!(w >= parseInt(week[1], 10) && w <= parseInt(week[2], 10))) return;
        chunk = week[3];
      }

      // reine Feiertags-/Sonderregeln ignorieren
      if (/easter|whitsun|PH\b.*(off|closed)/i.test(chunk) && !/\d{1,2}:\d{2}/.test(chunk)) return;

      // Saison am Chunk-Anfang: nur ein alleinstehender Marker gilt für die folgenden Chunks.
      // Steht danach noch Text, wird sie pro Teil-Regel ausgewertet (siehe unten).
      var chunkSeason = null;
      var head = parseSeason(chunk);
      if (head) {
        var rest = head.rest.trim();
        if (!rest) {
          marker = head;
          return;
        }
        if (/^(off|closed)$/i.test(rest)) return;
        chunkSeason = head;
      }

      var dayList = null; // Tage, die auf eine folgende Zeitangabe warten

      chunk.split(",").forEach(function (partRaw) {
        var part = partRaw.trim();
        if (!part) return;

        // Saison der Teil-Regel ("Oct-Mar: 08:30-16:00") beachten
        var partSeason = null;
        var pH = parseSeason(part);
        if (pH) {
          if (!pH.rest.trim()) return; // reine Saisonangabe
          partSeason = pH;
          part = pH.rest.trim();
        }
        var scopeSeason = partSeason || chunkSeason || marker;
        if (!inSeason(scopeSeason, date)) return;

        // Feiertagskürzel am Anfang entfernen ("PH 10:00-17:00")
        part = part.replace(new RegExp("^(PH|SH)\\s*", "i"), "");

        var dset = null;
        var dm = part.match(
          new RegExp(
            "^((?:" + DAY_TOKEN + ")(?:\\s*-\\s*(?:" + DAY_TOKEN + "))?(?:\\s*,\\s*(?:" + DAY_TOKEN + ")(?:\\s*-\\s*(?:" + DAY_TOKEN + "))?)*)",
            "i",
          ),
        );
        if (dm) {
          dset = parseDays(dm[1]);
          part = part.slice(dm[0].length).trim();
        }
        if (!part) {
          if (dset) dayList = union(dayList, dset);
          return;
        }
        // reine Datumsangaben ("Dec 24", "24", "31 off") ignorieren
        if (/^\d{1,2}(\.\d{1,2})?(\s+(off|closed))?$/i.test(part)) return;
        if (/^[A-Za-z]{3}\s+\d/.test(part)) return;

        var times = parseTimes(part);
        var closed = /(off|closed)/i.test(part);

        if (!times.length) {
          if (closed) {
            // nur Tage schließen, die explizit benannt sind ("Mo closed")
            var target = union(dayList, dset);
            if (target) Object.keys(target).forEach(function (k) { closedDays[k] = true; });
          } else if (dset) {
            dayList = union(dayList, dset);
          }
          return;
        }

        var applyTo = union(dayList, dset) || ALL_DAYS;
        Object.keys(applyTo).forEach(function (k) {
          times.forEach(function (t) { days[k].push({ s: t.s, e: t.e }); });
        });
        dayList = dset ? union(dayList, dset) : null;
      });
    });

    var ok = false;
    for (var i = 0; i < 7; i++) {
      days[i].sort(function (a, b) { return a.s - b.s; });
      var merged = [];
      days[i].forEach(function (t) {
        var last = merged[merged.length - 1];
        if (last && t.s <= last.e) last.e = Math.max(last.e, t.e);
        else merged.push({ s: t.s, e: t.e });
      });
      days[i] = merged;
      if (merged.length) ok = true;
    }
    if (!ok) return null;
    return { days: days, ok: true };
  }

  /** Aktuelle Zeit in Europe/Copenhagen: {weekday (0=So), minutes} */
  function nowInCopenhagen() {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Copenhagen",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(new Date());
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[map.weekday];
    return { weekday: wd === undefined ? 1 : wd, minutes: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10) };
  }

  /** @returns {{known:boolean, open:boolean|null, text:string}} */
  function status(parsed, now) {
    if (!parsed || !parsed.ok) return { known: false, open: null, text: "Öffnungszeiten unbekannt" };
    var t = now || nowInCopenhagen();
    var today = parsed.days[t.weekday] || [];
    var yest = parsed.days[(t.weekday + 6) % 7] || [];

    if (parsed.allDay) return { known: true, open: true, text: "Rund um die Uhr geöffnet" };

    var i;
    for (i = 0; i < today.length; i++) {
      if (t.minutes >= today[i].s && t.minutes < today[i].e) {
        var end = today[i].e;
        return {
          known: true,
          open: true,
          text: "Jetzt geöffnet · bis " + fmt(end) + (end > 1440 ? " (Folgetag)" : ""),
        };
      }
    }
    for (i = 0; i < yest.length; i++) {
      if (yest[i].e > 1440 && t.minutes + 1440 < yest[i].e) {
        return { known: true, open: true, text: "Jetzt geöffnet · bis " + fmt(yest[i].e) + " (Nacht)" };
      }
    }
    for (var off = 0; off < 8; off++) {
      var wd = (t.weekday + off) % 7;
      var list = parsed.days[wd] || [];
      for (i = 0; i < list.length; i++) {
        if (off === 0 && list[i].s <= t.minutes) continue;
        var label = off === 0 ? "heute" : off === 1 ? "morgen" : DAY_SHORT[wd];
        return { known: true, open: false, text: "Geschlossen · öffnet " + label + " " + fmt(list[i].s) };
      }
    }
    return { known: true, open: false, text: "Geschlossen" };
  }

  /** Wochenübersicht Mo..So, aufeinanderfolgende gleiche Tage zusammengefasst. */
  function weekTable(parsed) {
    if (!parsed || !parsed.ok) return [];
    if (parsed.allDay) return [{ label: "Mo–So", value: "24 Stunden", closed: false }];
    var rows = DAY_ORDER.map(function (wd) {
      var list = parsed.days[wd] || [];
      return {
        wd: wd,
        label: DAY_SHORT[wd],
        value: list.length ? list.map(function (t) { return fmt(t.s) + "–" + fmt(t.e); }).join(", ") : "geschlossen",
        closed: !list.length,
      };
    });
    var out = [];
    var run = null;
    rows.forEach(function (r) {
      if (run && run.value === r.value) {
        run.end = r.label;
        run.count++;
      } else {
        run = { start: r.label, end: null, value: r.value, closed: r.closed, count: 1 };
        out.push(run);
      }
    });
    return out.map(function (r) {
      return {
        label: r.count > 1 ? r.start + "–" + (r.end || r.start) : r.start,
        value: r.value,
        closed: r.closed,
      };
    });
  }

  var api = {
    parse: parse,
    status: status,
    weekTable: weekTable,
    nowInCopenhagen: nowInCopenhagen,
    fmt: fmt,
    DAY_SHORT: DAY_SHORT,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CPHHours = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
