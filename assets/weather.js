/*!
 * weather.js – aktuelles Wetter für Kopenhagen über Open-Meteo.
 *
 * Open-Meteo braucht keinen API-Key und liefert CORS-Header, passt also zur
 * statischen Seite ohne Backend. Abgefragt wird nur das Nötigste: aktueller
 * Niederschlag, Regenmenge, WMO-Wettercode und Temperatur.
 *
 * Ausfallverhalten: Jeder Fehler führt zu `null`. Die Oberfläche blendet den
 * Regen-Hinweis dann einfach nicht ein – eine kaputte Wetterabfrage darf die
 * Karte nicht stören.
 */
(function (root) {
  "use strict";

  var API = "https://api.open-meteo.com/v1/forecast";
  var CPH = { lat: 55.6761, lon: 12.5683 };
  var TTL_MS = 10 * 60 * 1000; // 10 Minuten – häufiger ändert sich Regen nicht
  var CACHE_KEY = "cph-weather";

  // WMO-Codes, die "nass" bedeuten: Sprühregen, Regen, Schauer, Gewitter.
  var WET_CODES = {
    51: 1, 53: 1, 55: 1, 56: 1, 57: 1,
    61: 1, 63: 1, 65: 1, 66: 1, 67: 1,
    80: 1, 81: 1, 82: 1,
    95: 1, 96: 1, 99: 1,
  };

  var CODE_TEXT = {
    0: "klar", 1: "überwiegend klar", 2: "teils bewölkt", 3: "bedeckt",
    45: "Nebel", 48: "Reifnebel",
    51: "leichter Sprühregen", 53: "Sprühregen", 55: "starker Sprühregen",
    56: "gefr. Sprühregen", 57: "gefr. Sprühregen",
    61: "leichter Regen", 63: "Regen", 65: "starker Regen",
    66: "gefr. Regen", 67: "gefr. Regen",
    71: "leichter Schneefall", 73: "Schneefall", 75: "starker Schneefall",
    80: "leichte Schauer", 81: "Schauer", 82: "heftige Schauer",
    95: "Gewitter", 96: "Gewitter mit Hagel", 99: "starkes Gewitter",
  };

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj.at !== "number") return null;
      if (Date.now() - obj.at > TTL_MS) return null;
      return obj.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data }));
    } catch (e) { /* Speicher voll oder gesperrt – dann eben ohne Cache */ }
  }

  function normalize(cur) {
    if (!cur) return null;
    var code = typeof cur.weather_code === "number" ? cur.weather_code : null;
    var mm = typeof cur.precipitation === "number" ? cur.precipitation : 0;
    var rain = typeof cur.rain === "number" ? cur.rain : 0;
    var wet = mm > 0.05 || rain > 0.05 || (code !== null && WET_CODES[code] === 1);
    return {
      wet: wet,
      mm: mm,
      code: code,
      tempC: typeof cur.temperature_2m === "number" ? Math.round(cur.temperature_2m) : null,
      text: code !== null && CODE_TEXT[code] ? CODE_TEXT[code] : wet ? "Regen" : "trocken",
      at: cur.time || null,
    };
  }

  /**
   * @returns {Promise<{wet:boolean, mm:number, code:number|null, tempC:number|null, text:string, at:string|null}|null>}
   */
  function fetchWeather() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);

    var url =
      API +
      "?latitude=" + CPH.lat +
      "&longitude=" + CPH.lon +
      "&current=precipitation,rain,weather_code,temperature_2m" +
      "&timezone=Europe%2FCopenhagen";

    return fetch(url, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (json) {
        var out = normalize(json && json.current);
        if (out) writeCache(out);
        return out;
      })
      .catch(function () {
        return null; // stiller Ausfall: kein Hinweis, keine Fehlermeldung
      });
  }

  root.CPHWeather = { fetch: fetchWeather, WET_CODES: WET_CODES };
})(typeof globalThis !== "undefined" ? globalThis : this);
