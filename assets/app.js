/*!
 * app.js – Kopenhagen Stadtplan
 * Statische Seite, keine Build-Schritte, keine Tracker.
 */
(function () {
  "use strict";

  var DATA_URL = "data/places.json";

  var state = {
    places: [],
    categories: [],
    catById: {},
    active: {}, // Kategorie -> sichtbar
    tags: {}, // Tag -> aktiv (Themenfilter, UND-verknüpft)
    favs: {}, // id -> gemerkt
    favOnly: false,
    query: "",
    openOnly: false,
    sort: "empfohlen",
    userPos: null,
    selected: null,
  };

  var els = {};
  var map;
  var cluster;
  var markerById = {};
  var userMarker = null;
  var CPH_BOUNDS = null;

  // ---------------------------------------------------------------- Utilities

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function haversine(a, b) {
    var R = 6371000;
    var dLat = ((b.lat - a.lat) * Math.PI) / 180;
    var dLon = ((b.lon - a.lon) * Math.PI) / 180;
    var la1 = (a.lat * Math.PI) / 180;
    var la2 = (b.lat * Math.PI) / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function distanceLabel(m) {
    if (m == null) return "";
    if (m < 1000) return Math.round(m / 10) * 10 + " m";
    return (m / 1000).toFixed(1).replace(".", ",") + " km";
  }
  function priceDots(level) {
    if (!level) return "";
    var out = "<span class='price-dots' title='Preisniveau " + level + " von 4'>";
    for (var i = 1; i <= 4; i++) out += i <= level ? "<i class='on'></i>" : "<i></i>";
    return out + "</span>";
  }
  function ratingHtml(p) {
    if (!p.rating) return "";
    var src = p.ratingSource || "Google";
    return (
      "<span class='rating' title='" + esc(src) + "-Bewertung, Stand Okt 2026'>★ " +
      p.rating.toFixed(1).replace(".", ",") +
      (p.reviews && p.reviews !== "—" ? " <small>(" + esc(p.reviews) + ")</small>" : "") +
      "</span>"
    );
  }

  /** Expliziter Hinweis, wenn keine Bewertung vorliegt (statt sie einfach wegzulassen). */
  function noRatingHtml(p) {
    return (
      "<span class='no-rating' title='" + esc(p.ratingNote || "Keine Bewertung verfügbar") + "'>" +
      "— keine Bewertung</span>"
    );
  }

  /**
   * Nicht jeder Ort ist bewertbar.
   * - Supermärkte: Bewertungen von Filialen einer Kette sind kaum aussagekräftig
   *   und unterscheiden sich je Standort.
   * - Hop-On-Hop-Off-Haltestellen: Infrastruktur, kein Gastronomiebetrieb – ein
   *   Platzhalter „keine Bewertung“ wäre an 11 Karten nur Rauschen.
   */
  function showsRating(p) {
    return p.cat !== "supermarket" && p.cat !== "hoho";
  }

  function isGastro(p) {
    // Cafés bewusst ausgenommen: dort ist eine Online-Speisekarte die Ausnahme,
    // ein Hinweis „keine Karte online“ wäre bei 12 Betrieben nur Rauschen.
    return p.cat === "restaurant" || p.cat === "fastfood" || p.cat === "breakfast";
  }
  function hoursStatus(p) {
    if (!p.hours) return { known: false, open: null, text: "Öffnungszeiten nicht verfügbar" };
    var parsed = window.CPHHours.parse(p.hours, refDate());
    return window.CPHHours.status(parsed);
  }

  /**
   * Beschriftung für den Zeitstatus. Touren haben keine Öffnungszeiten, sondern
   * Abfahrtszeiten – „Zeiten unbekannt“ wäre dort schlicht falsch, weil die
   * Abfahrten im hoursNote des Eintrags stehen.
   */
  function hoursLabel(p, st) {
    if (st.known) return st.text;
    return p.cat === "tour" ? "Abfahrtszeiten laut Anbieter" : "Zeiten unbekannt";
  }
  function refDate() { return new Date(); }

  // ---------------------------------------------------------------- Rendering

  function renderChips() {
    var counts = {};
    state.places.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });

    els.chips.innerHTML = state.categories
      .map(function (c) {
        var on = state.active[c.id];
        return (
          "<button type='button' class='chip" + (on ? " is-on" : "") + "' data-cat='" + c.id + "' " +
          "aria-pressed='" + (on ? "true" : "false") +
          "' style='--c:" + c.color + "'>" +
          "<span class='chip-ico' aria-hidden='true'>" + c.icon + "</span>" +
          "<span class='chip-label'>" + esc(c.short) + "</span>" +
          "<span class='chip-count'>" + (counts[c.id] || 0) + "</span>" +
          "</button>"
        );
      })
      .join("");

    els.chips.querySelectorAll(".chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.cat;
        // letzte aktive Kategorie nicht abschaltbar
        var activeCount = Object.keys(state.active).filter(function (k) { return state.active[k]; }).length;
        if (state.active[id] && activeCount === 1) return;
        state.active[id] = !state.active[id];
        renderChips();
        renderTags(); // Themenliste hängt an den aktiven Kategorien
        renderList();
        syncMarkers();
      });
    });
  }

  /**
   * Tags als Filter nutzbar machen: nur Tags, die in den gerade aktiven
   * Kategorien mindestens zweimal vorkommen (ein Einzelfall lohnt keinen Chip).
   * Höchstens 12, absteigend nach Häufigkeit.
   */
  function availableTags() {
    var counts = {};
    state.places.forEach(function (p) {
      if (!state.active[p.cat]) return;
      (p.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.keys(counts)
      .filter(function (t) { return counts[t] >= 2; })
      .sort(function (a, b) {
        return counts[b] - counts[a] || a.localeCompare(b, "de");
      })
      .slice(0, 12)
      .map(function (t) { return { tag: t, count: counts[t] }; });
  }

  function renderTags() {
    var avail = availableTags();
    var names = avail.map(function (a) { return a.tag; });

    // Aktive Tags, die durch einen Kategoriewechsel weggefallen sind, lösen –
    // sonst filtert ein unsichtbarer Tag die Liste auf null Treffer.
    Object.keys(state.tags).forEach(function (t) {
      if (state.tags[t] && names.indexOf(t) === -1) delete state.tags[t];
    });

    var anyOn = Object.keys(state.tags).some(function (t) { return state.tags[t]; });
    if (!avail.length) {
      els.tagbar.hidden = true;
      els.tagbar.innerHTML = "";
      return;
    }
    els.tagbar.hidden = false;
    els.tagbar.innerHTML =
      avail
        .map(function (a) {
          var on = !!state.tags[a.tag];
          return (
            "<button type='button' class='tag" + (on ? " is-on" : "") + "' data-tag='" + esc(a.tag) + "' " +
            "aria-pressed='" + (on ? "true" : "false") + "'>" +
            esc(a.tag) + "<span class='tag-count'>" + a.count + "</span></button>"
          );
        })
        .join("") +
      (anyOn ? "<button type='button' class='tag-clear'>Themen zurücksetzen</button>" : "");

    els.tagbar.querySelectorAll(".tag").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var t = btn.dataset.tag;
        state.tags[t] = !state.tags[t];
        renderTags();
        renderList();
        syncMarkers();
      });
    });
    var clear = els.tagbar.querySelector(".tag-clear");
    if (clear) {
      clear.addEventListener("click", function () {
        state.tags = {};
        renderTags();
        renderList();
        syncMarkers();
      });
    }
  }

  // ------------------------------------------------------------- Favoriten
  // Rein lokal im Browser (localStorage). Kein Konto, kein Server, keine Tracker.
  var FAV_KEY = "cph-favs";

  function loadFavs() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      state.favs = {};
      if (Array.isArray(arr)) arr.forEach(function (id) { state.favs[id] = true; });
    } catch (e) {
      state.favs = {}; // privater Modus / kaputter Wert -> einfach ohne Favoriten
    }
  }

  function saveFavs() {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(Object.keys(state.favs).filter(function (k) { return state.favs[k]; })));
    } catch (e) { /* Speicher voll oder gesperrt – Favoriten gelten dann nur für diese Sitzung */ }
  }

  function favCount() {
    return Object.keys(state.favs).filter(function (k) { return state.favs[k]; }).length;
  }

  function syncFavButton() {
    var n = favCount();
    var btn = $("favBtn");
    if (!btn) return;
    $("favCount").textContent = n;
    btn.setAttribute("aria-pressed", state.favOnly ? "true" : "false");
    btn.disabled = n === 0 && !state.favOnly;
    btn.title = n ? "Nur gemerkte Orte (" + n + ")" : "Noch nichts gemerkt";
  }

  function toggleFav(id) {
    if (state.favs[id]) delete state.favs[id];
    else state.favs[id] = true;
    saveFavs();
    syncFavButton();
    renderList();
    syncMarkers();
    var d = els.drawer.querySelector(".fav-toggle");
    if (d) syncDrawerFav(d, id);
  }

  function syncDrawerFav(btn, id) {
    var on = !!state.favs[id];
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "★ Gemerkt" : "☆ Merken";
  }

  function visiblePlaces() {
    var q = state.query.trim().toLowerCase();
    var activeTags = Object.keys(state.tags).filter(function (t) { return state.tags[t]; });

    var list = state.places.filter(function (p) {
      if (!state.active[p.cat]) return false;
      if (state.favOnly && !state.favs[p.id]) return false;
      if (activeTags.length) {
        var own = p.tags || [];
        for (var i = 0; i < activeTags.length; i++) {
          if (own.indexOf(activeTags[i]) === -1) return false;
        }
      }
      if (state.openOnly) {
        if (!p.hours) return false;
        if (hoursStatus(p).open !== true) return false;
      }
      if (!q) return true;
      var hay = [p.name, p.sub, p.area, p.desc, (p.tags || []).join(" "), p.priceText, p.cat]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    var order = state.categories.map(function (c) { return c.id; });
    list.sort(function (a, b) {
      switch (state.sort) {
        case "name":
          return a.name.localeCompare(b.name, "de");
        case "rating":
          return (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name, "de");
        case "price":
          var pa = a.mainDKK == null ? 99999 : a.mainDKK;
          var pb = b.mainDKK == null ? 99999 : b.mainDKK;
          return pa - pb || a.name.localeCompare(b.name, "de");
        case "distance":
          if (!state.userPos) return a.name.localeCompare(b.name, "de");
          return haversine(state.userPos, a) - haversine(state.userPos, b);
        default:
          // kuratierte Reihenfolge aus data/places.json (innerhalb der Kategorien)
          var d = order.indexOf(a.cat) - order.indexOf(b.cat);
          return d !== 0 ? d : (a._idx || 0) - (b._idx || 0);
      }
    });
    return list;
  }

  function renderList() {
    var list = visiblePlaces();
    var now = window.CPHHours.nowInCopenhagen();

    els.count.textContent =
      list.length + " von " + state.places.length + " Orten" + (state.openOnly ? " · jetzt geöffnet" : "");

    if (!list.length) {
      els.list.innerHTML =
        "<li class='empty'>Keine Treffer. Suchbegriff löschen oder Kategorie aktivieren.</li>";
      return;
    }

    var html = "";
    var lastCat = null;
    var grouped = state.sort === "empfohlen";
    list.forEach(function (p) {
      if (grouped && p.cat !== lastCat) {
        var c = state.catById[p.cat];
        html +=
          "<li class='group' style='--c:" + c.color + "'>" +
          "<span aria-hidden='true'>" + c.icon + "</span> " + esc(c.label) + "</li>";
        lastCat = p.cat;
      }
      var st = window.CPHHours.status(window.CPHHours.parse(p.hours, refDate()), now);
      var dotClass = st.open === true ? "is-open" : st.open === false ? "is-closed" : "is-unknown";
      var dist = state.userPos ? distanceLabel(haversine(state.userPos, p)) : "";

      html +=
        "<li class='card' data-id='" + p.id + "' style='--c:" + state.catById[p.cat].color + "'>" +
        "<button class='card-btn' type='button' data-id='" + p.id + "'>" +
        "<span class='card-head'>" +
        "<span class='card-title'>" + esc(p.name) + "</span>" +
        "<span class='card-badge'>" + esc(p.sub) + "</span>" +
        "</span>" +
        "<span class='card-meta'>" +
        (p.priceLevel ? priceDots(p.priceLevel) : "") +
        (showsRating(p) ? (p.rating ? ratingHtml(p) : noRatingHtml(p)) : "") +
        (dist ? "<span class='dist'>" + dist + "</span>" : "") +
        "</span>" +
        "<span class='card-hours'><span class='status-dot " + dotClass + "'></span>" +
        "<span>" + esc(hoursLabel(p, st)) + "</span></span>" +
        "</button>" +
        "<button class='card-fav" + (state.favs[p.id] ? " is-on" : "") + "' type='button' " +
        "data-fav='" + p.id + "' aria-pressed='" + (state.favs[p.id] ? "true" : "false") + "' " +
        "aria-label='" + esc(p.name) + (state.favs[p.id] ? " nicht mehr merken" : " merken") + "' " +
        "title='" + (state.favs[p.id] ? "Gemerkt" : "Merken") + "'>★</button>" +
        "</li>";
    });
    els.list.innerHTML = html;

    els.list.querySelectorAll(".card-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { openDetail(btn.dataset.id, true); });
    });
    els.list.querySelectorAll(".card-fav").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        // Verhindert, dass der Klick zusätzlich die Detailansicht öffnet
        e.stopPropagation();
        toggleFav(btn.dataset.fav);
      });
    });
  }

  // ------------------------------------------------------------------- Marker

  function makeIcon(p) {
    var c = state.catById[p.cat];
    return L.divIcon({
      className: "pin-wrap",
      html:
        "<span class='pin' style='--c:" + c.color + "'>" + c.icon + "</span>",
      iconSize: [30, 30],
      iconAnchor: [15, 26],
      popupAnchor: [0, -24],
    });
  }

  function buildMarkers() {
    if (cluster) {
      map.removeLayer(cluster);
    }
    markerById = {};
    cluster = L.markerClusterGroup
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          maxClusterRadius: 42,
          iconCreateFunction: function (cl) {
            var n = cl.getChildCount();
            var size = n < 10 ? 36 : n < 25 ? 42 : 48;
            return L.divIcon({
              html: "<span class='cluster'>" + n + "</span>",
              className: "cluster-wrap",
              iconSize: [size, size],
            });
          },
        })
      : L.layerGroup();

    state.places.forEach(function (p) {
      var marker = L.marker([p.lat, p.lon], {
        icon: makeIcon(p),
        title: p.name,
        alt: p.name,
        riseOnHover: true,
      });
      marker.bindPopup(popupHtml(p), { maxWidth: 300, minWidth: 220, closeButton: true });
      marker.on("popupopen", function () {
        var btn = document.querySelector(".popup-more[data-id='" + p.id + "']");
        if (btn) btn.addEventListener("click", function () { openDetail(p.id, false); });
      });
      marker.on("click", function () { setSelectedCard(p.id); });
      markerById[p.id] = marker;
    });

    cluster.addTo(map);
    syncMarkers();
  }

  function syncMarkers() {
    if (!cluster) return;
    var visible = {};
    visiblePlaces().forEach(function (p) { visible[p.id] = true; });

    var toAdd = [];
    var toRemove = [];
    Object.keys(markerById).forEach(function (id) {
      var onMap = cluster.hasLayer(markerById[id]);
      if (visible[id] && !onMap) toAdd.push(markerById[id]);
      if (!visible[id] && onMap) toRemove.push(markerById[id]);
    });
    if (toRemove.length) cluster.removeLayers(toRemove);
    if (toAdd.length) cluster.addLayers(toAdd);
  }

  function popupHtml(p) {
    var st = window.CPHHours.status(window.CPHHours.parse(p.hours, refDate()));
    var dot = st.open === true ? "is-open" : st.open === false ? "is-closed" : "is-unknown";
    return (
      "<div class='popup'>" +
      "<div class='popup-cat'>" + esc(state.catById[p.cat].label) + " · " + esc(p.sub) + "</div>" +
      "<h4>" + esc(p.name) + "</h4>" +
      "<div class='popup-meta'>" + priceDots(p.priceLevel) + (showsRating(p) ? (p.rating ? ratingHtml(p) : noRatingHtml(p)) : "") + "</div>" +
      "<div class='card-hours'><span class='status-dot " + dot + "'></span>" +
      "<span>" + esc(hoursLabel(p, st)) + "</span></div>" +
      "<button type='button' class='popup-more' data-id='" + p.id + "'>Details ansehen →</button>" +
      "</div>"
    );
  }

  // -------------------------------------------------- Mobile Liste (Bottom-Sheet)
  // Zentrale Steuerung, damit Button, Backdrop, Schließen-Kreuz, Escape und
  // Detailansicht denselben Zustand setzen und nie gegeneinander arbeiten.
  var lastSheetTap = 0;
  var sheetOpenedAt = 0;
  var mqMobile = window.matchMedia ? window.matchMedia("(max-width: 760px)") : null;

  function sheetOpen() {
    return document.body.classList.contains("sidebar-open");
  }

  /**
   * aria-hidden nur im Mobilmodus setzen: am Desktop ist die Liste dauerhaft
   * sichtbar und muss für Screenreader erreichbar bleiben.
   */
  function syncSheetA11y() {
    var sheet = document.querySelector(".sidebar");
    if (!sheet) return;
    if (mqMobile && mqMobile.matches && !sheetOpen()) sheet.setAttribute("aria-hidden", "true");
    else sheet.removeAttribute("aria-hidden");
  }

  function setSheet(open) {
    if (open === sheetOpen()) return;
    document.body.classList.toggle("sidebar-open", open);
    var toggle = $("sidebarToggle");
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    var bd = $("sheetBackdrop");
    if (bd) bd.hidden = !open;
    if (open) sheetOpenedAt = Date.now();
    syncSheetA11y();
  }

  /**
   * Schließen aus der Oberfläche. Ignoriert Events der ersten ~350 ms nach dem
   * Öffnen: iOS/Chromium liefern nach einem Tap auf den Button einen nachlaufenden
   * click, der dann schon auf dem eingeblendeten Backdrop landet und das Sheet
   * sofort wieder zumachen würde.
   */
  function closeSheetFromUi() {
    if (Date.now() - sheetOpenedAt < 350) return;
    setSheet(false);
  }

  /** Tap/Click mit Doppel-Feuer-Schutz (Safari kann Events doppelt zustellen). */
  function toggleSheet() {
    var now = Date.now();
    if (now - lastSheetTap < 400) return;
    lastSheetTap = now;
    setSheet(!sheetOpen());
  }

  // ------------------------------------------------------------------- Detail

  function openDetail(id, fly) {
    var p = state.places.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    state.selected = id;
    setSelectedCard(id);

    var c = state.catById[p.cat];
    var parsed = window.CPHHours.parse(p.hours, refDate());
    var st = window.CPHHours.status(parsed);
    var week = window.CPHHours.weekTable(parsed);
    var dot = st.open === true ? "is-open" : st.open === false ? "is-closed" : "is-unknown";
    var dist = state.userPos ? distanceLabel(haversine(state.userPos, p)) : "";

    var links = "";
    if (p.website) {
      links +=
        "<a class='btn btn-primary' href='" + esc(p.website) + "' target='_blank' rel='noopener noreferrer'>" +
        (isGastro(p) ? "Website & Karte" : "Website") +
        "</a>";
    }
    if (p.menu) {
      links +=
        "<a class='btn' href='" + esc(p.menu) + "' target='_blank' rel='noopener noreferrer'>Speisekarte</a>";
    }
    links +=
      "<a class='btn btn-ghost' href='https://www.google.com/maps/dir/?api=1&destination=" +
      p.lat + "," + p.lon + "' target='_blank' rel='noopener noreferrer'>Route</a>";

    // Foto aus Wikipedia/Commons – mit Namensnennung und Lizenz, wie es die
    // freien Lizenzen verlangen. Ohne Foto entfällt der Block vollständig.
    var photoHtml = "";
    if (p.photo && p.photo.url) {
      photoHtml =
        "<figure class='drawer-photo'>" +
        "<img src='" + esc(p.photo.url) + "' alt='" + esc(p.name) + "' loading='lazy' decoding='async'>" +
        "<figcaption>Bild: " +
        "<a href='" + esc(p.photo.page) + "' target='_blank' rel='noopener noreferrer'>" +
        esc(p.photo.author) + "</a> · " + esc(p.photo.license) + " · via Wikimedia Commons" +
        "</figcaption>" +
        "</figure>";
    }

    // Gastro ohne Online-Karte: explizit benennen statt den Button einfach wegzulassen
    var menuMissing =
      isGastro(p) && !p.menu
        ? "<p class='note note-quiet'><strong>Keine Speisekarte online.</strong> " +
          esc(p.menuNote || "Für diesen Ort ist keine Speisekarte im Netz verfügbar.") + "</p>"
        : "";

    els.drawer.innerHTML =
      "<div class='drawer-head' style='--c:" + c.color + "'>" +
      "<div class='drawer-cat'><span aria-hidden='true'>" + c.icon + "</span> " + esc(c.label) + "</div>" +
      "<button class='icon-btn' id='drawerClose' aria-label='Schließen'>✕</button>" +
      "</div>" +
      "<div class='drawer-body'>" +
      photoHtml +
      "<h2>" + esc(p.name) + "</h2>" +
      "<p class='drawer-sub'>" + esc(p.sub) + " · " + esc(p.area) + (dist ? " · " + dist : "") + "</p>" +

      "<div class='drawer-facts'>" +
      (p.priceText ? "<div class='fact'><span class='fact-k'>" + (p.cat === "attraction" ? "Eintritt" : p.cat === "supermarket" || p.cat === "mall" ? "Preisniveau" : "Preis") + "</span><span class='fact-v'>" + esc(p.priceText) + "</span></div>" : "") +
      (showsRating(p)
        ? (p.rating
            ? "<div class='fact'><span class='fact-k'>Bewertung</span><span class='fact-v'>" +
              ratingHtml(p) + " <small class='src-tag'>" + esc(p.ratingSource || "Google") + "</small></span></div>"
            : "<div class='fact'><span class='fact-k'>Bewertung</span><span class='fact-v muted'>Keine Bewertung verfügbar</span></div>")
        : "") +
      "<div class='fact'><span class='fact-k'>Status</span><span class='fact-v'><span class='status-dot " + dot + "'></span> " + esc(hoursLabel(p, st)) + "</span></div>" +
      "</div>" +

      (showsRating(p) && !p.rating && p.ratingNote ? "<p class='note note-quiet'>" + esc(p.ratingNote) + "</p>" : "") +
      "<p class='drawer-desc'>" + esc(p.desc) + "</p>" +

      (p.tips && p.tips.length
        ? "<h3 class='drawer-h'>Tipps</h3><ul class='tips'>" +
          p.tips.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
          "</ul>"
        : "") +

      (week.length
        ? "<h3 class='drawer-h'>Öffnungszeiten</h3><table class='hours-table'>" +
          week.map(function (r) {
            return "<tr><th>" + esc(r.label) + "</th><td class='" + (r.closed ? "closed" : "") + "'>" + esc(r.value) + "</td></tr>";
          }).join("") +
          "</table>"
        : "") +
      (p.hoursNote ? "<p class='note'>" + esc(p.hoursNote) + "</p>" : "") +

      "<div class='drawer-actions'>" +
      "<button type='button' class='btn btn-soft fav-toggle' aria-pressed='false'></button>" +
      "<button type='button' class='btn btn-ghost share-btn'>🔗 Link kopieren</button>" +
      links +
      "</div>" +
      menuMissing +

      "<p class='drawer-src'>Quelle: " + esc(p.src || "OpenStreetMap") + " · Angaben ohne Gewähr</p>" +
      "</div>";

    els.drawer.hidden = false;
    void els.drawer.offsetWidth; // Reflow erzwingen, damit die Einblend-Animation läuft
    els.drawer.classList.add("is-open");
    document.body.classList.add("drawer-open");
    setSheet(false);
    $("drawerClose").addEventListener("click", closeDetail);

    var favBtn = els.drawer.querySelector(".fav-toggle");
    if (favBtn) {
      syncDrawerFav(favBtn, p.id);
      favBtn.addEventListener("click", function () { toggleFav(p.id); });
    }
    var shareBtn = els.drawer.querySelector(".share-btn");
    if (shareBtn) shareBtn.addEventListener("click", function () { sharePlace(p, shareBtn); });

    els.drawer.querySelector(".drawer-body").scrollTop = 0;

    if (fly) {
      map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
      var m = markerById[p.id];
      if (m && cluster.hasLayer(m)) m.openPopup();
    }
    try {
      history.replaceState(null, "", "#" + p.id);
    } catch (e) { /* file:// */ }
  }

  function closeDetail() {
    els.drawer.hidden = true;
    els.drawer.classList.remove("is-open");
    document.body.classList.remove("drawer-open");
    state.selected = null;
    setSelectedCard(null);
    map.closePopup();
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) { /* file:// */ }
  }

  function setSelectedCard(id) {
    els.list.querySelectorAll(".card").forEach(function (c) {
      c.classList.toggle("is-selected", c.dataset.id === id);
    });
  }

  // ------------------------------------------------------------------ Teilen

  /**
   * Kopiert den Deep-Link des Ortes. `navigator.clipboard` gibt es nur in
   * sicheren Kontexten (https/localhost) – lokal per http oder in älteren
   * Browsern fällt es auf einen temporären <textarea> zurück.
   */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error("Kopieren nicht möglich"));
    });
  }

  function sharePlace(p, btn) {
    var url = location.origin + location.pathname + "#" + p.id;
    var original = btn.textContent;

    function done(msg) {
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = original; }, 1800);
    }

    copyText(url)
      .then(function () { done("✓ Kopiert"); })
      .catch(function () {
        // Letzter Ausweg: Link sichtbar machen, damit er manuell kopiert werden kann
        window.prompt("Link zum Kopieren:", url);
        done(original);
      });
  }

  // ---------------------------------------------------------- Preisvergleich

  function renderPrices() {
    var rows = state.places
      .filter(function (p) { return p.cat === "restaurant" || p.cat === "fastfood"; })
      .sort(function (a, b) {
        var pa = a.mainDKK == null ? 99999 : a.mainDKK;
        var pb = b.mainDKK == null ? 99999 : b.mainDKK;
        return pa - pb || a.name.localeCompare(b.name, "de");
      });

    var max = 0;
    rows.forEach(function (r) { if (r.mainDKK > max) max = r.mainDKK; });

    var html =
      "<p class='modal-intro'>Typische Preise für ein Hauptgericht bzw. eine Portion, aufsteigend sortiert. " +
      "Schätzung auf Basis der Speisekarten (Stand Okt 2026) – Getränke nicht enthalten.</p>" +
      "<table class='price-table'><thead><tr>" +
      "<th>Ort</th><th>Art</th><th class='num'>Hauptgericht</th><th>Niveau</th>" +
      "</tr></thead><tbody>";

    rows.forEach(function (p) {
      var c = state.catById[p.cat];
      var barPct = p.mainDKK && max ? Math.round((p.mainDKK / max) * 100) : 0;
      html +=
        "<tr data-id='" + p.id + "'>" +
        "<td><button class='link-btn' data-id='" + p.id + "'>" + esc(p.name) + "</button>" +
        "<div class='row-sub'>" + esc(p.area) + "</div></td>" +
        "<td><span class='mini-badge' style='--c:" + c.color + "'>" + esc(c.short) + "</span></td>" +
        "<td class='num'>" +
        (p.mainDKK ? "<span class='bar'><i style='width:" + barPct + "%'></i></span><b>" + p.mainDKK + " DKK</b>" : "<em>Menü</em>") +
        "</td>" +
        "<td>" + priceDots(p.priceLevel) + "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    els.modalBody.innerHTML = html;

    els.modalBody.querySelectorAll(".link-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        closeModal();
        openDetail(b.dataset.id, true);
      });
    });
  }

  function openPrices() {
    renderPrices();
    els.modal.hidden = false;
    document.body.classList.add("modal-open");
  }
  function closeModal() {
    els.modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  // --------------------------------------------------------------------- Map

  function initMap(meta) {
    CPH_BOUNDS = L.latLngBounds([55.640, 12.510], [55.720, 12.630]);
    map = L.map("map", {
      center: meta.center || [55.679, 12.575],
      zoom: meta.zoom || 15,
      zoomControl: false,
      minZoom: 11,
      maxBounds: CPH_BOUNDS.pad(0.35),
      maxBoundsViscosity: 0.6,
    });

    // Kachel-Anbieter ohne API-Key. CARTO-Basemaps verlangen inzwischen einen Key
    // und liefern sonst nur eine Platzhaltergrafik – deshalb nicht mehr verwendet.
    var osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende',
    });
    var cyclosm = L.tileLayer("https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", {
      maxZoom: 20,
      subdomains: "abc",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende · Stil: <a href="https://www.cyclosm.org/" target="_blank" rel="noopener">CyclOSM</a>',
    });

    osm.addTo(map);
    L.control
      .layers({ "Karte": osm, "Rad & Wandern": cyclosm }, null, { position: "topright" })
      .addTo(map);
    L.control.zoom({ position: "topleft" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
    watchTiles([osm, cyclosm]);

    map.on("popupclose", function () { setSelectedCard(null); });
    map.on("click", function () { setSheet(false); });
  }

  /**
   * Warnt, wenn Kartenkacheln nicht laden (Netzwerk, Werbeblocker, Anbieter down).
   * Ohne diesen Hinweis sieht der Nutzer nur eine leere/graue Karte.
   */
  function watchTiles(layers) {
    var wrap = document.querySelector(".map-wrap");
    var warning = null;

    function show() {
      if (warning) return;
      warning = document.createElement("div");
      warning.className = "tile-warning";
      warning.innerHTML =
        "Kartenkacheln laden nicht. Bitte Verbindung, Werbeblocker oder DNS-Filter prüfen." +
        "<button type=\"button\">Hinweis schließen</button>";
      warning.querySelector("button").addEventListener("click", function () {
        warning.remove();
        warning = null;
      });
      wrap.appendChild(warning);
    }

    layers.forEach(function (layer) {
      var errors = 0;
      layer.on("tileerror", function () {
        errors++;
        if (errors >= 6) show();
      });
      layer.on("tileload", function () {
        errors = 0;
        if (warning) {
          warning.remove();
          warning = null;
        }
      });
    });
  }

  function locate() {
    if (!navigator.geolocation) {
      alert("Dein Browser unterstützt keine Standortbestimmung.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([state.userPos.lat, state.userPos.lon], {
          radius: 8,
          color: "#fff",
          weight: 3,
          fillColor: "#2f6fed",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup("Dein Standort");
        map.flyTo([state.userPos.lat, state.userPos.lon], 15, { duration: 0.8 });
        state.sort = "distance";
        els.sort.value = "distance";
        renderList();
      },
      function () {
        alert("Standort konnte nicht ermittelt werden. Bitte Berechtigung prüfen.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // ------------------------------------------------------------------- Setup

  function wire() {
    els.search.addEventListener("input", function () {
      state.query = els.search.value;
      renderList();
      syncMarkers();
    });

    els.openOnly.addEventListener("change", function () {
      state.openOnly = els.openOnly.checked;
      renderList();
      syncMarkers();
    });

    els.sort.addEventListener("change", function () {
      state.sort = els.sort.value;
      renderList();
      syncMarkers();
    });

    var favBtn = $("favBtn");
    if (favBtn) {
      favBtn.addEventListener("click", function () {
        state.favOnly = !state.favOnly;
        syncFavButton();
        renderList();
        syncMarkers();
      });
    }

    els.compare.addEventListener("click", openPrices);
    els.locate.addEventListener("click", locate);
    $("locateFloat").addEventListener("click", locate);
    $("modalClose").addEventListener("click", closeModal);
    els.modal.addEventListener("click", function (e) {
      if (e.target === els.modal) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (!els.modal.hidden) closeModal();
        else if (!els.drawer.hidden) closeDetail();
        else setSheet(false);
      }
    });

    var toggle = $("sidebarToggle");
    // Bewusst nur "click": ein zusätzlicher pointerup-Handler feuert vor dem click
    // und führt dazu, dass der nachlaufende click auf dem dann schon sichtbaren
    // Backdrop landet und das Sheet sofort wieder schließt.
    toggle.addEventListener("click", toggleSheet);
    toggle.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSheet(); }
    });

    var bd = $("sheetBackdrop");
    if (bd) bd.addEventListener("click", closeSheetFromUi);
    var sheetClose = $("sheetClose");
    if (sheetClose) sheetClose.addEventListener("click", function () { setSheet(false); });

    if (mqMobile) {
      var onMq = function () { syncSheetA11y(); };
      if (mqMobile.addEventListener) mqMobile.addEventListener("change", onMq);
      else if (mqMobile.addListener) mqMobile.addListener(onMq);
    }
    syncSheetA11y();

    var themeBtn = $("themeBtn");
    themeBtn.addEventListener("click", function () {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
      try { localStorage.setItem("cph-theme", dark ? "light" : "dark"); } catch (err) {}
      themeBtn.textContent = dark ? "◐" : "☀";
    });

    // Deep-Link beim Laden
    var hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (hash && state.places.some(function (p) { return p.id === hash; })) {
      setTimeout(function () { openDetail(hash, true); }, 300);
    }
  }

  function init() {
    els.chips = $("chips");
    els.list = $("list");
    els.count = $("count");
    els.search = $("search");
    els.openOnly = $("openOnly");
    els.sort = $("sort");
    els.compare = $("compare");
    els.locate = $("locateBtn");
    els.drawer = $("drawer");
    els.modal = $("modal");
    els.modalBody = $("modalBody");
    els.tagbar = $("tagbar");

    var savedTheme = null;
    try { savedTheme = localStorage.getItem("cph-theme"); } catch (e) {}
    if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
    $("themeBtn").textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀" : "◐";

    fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        state.places = data.places.map(function (p, i) {
          p._idx = i;
          return p;
        });
        state.categories = data.categories;
        state.categories.forEach(function (c) {
          state.catById[c.id] = c;
          state.active[c.id] = true;
        });

        if (!window.L) {
          els.list.innerHTML =
            "<li class='empty'>Die Kartenbibliothek (Leaflet) konnte nicht geladen werden. " +
            "Bitte Internetverbindung bzw. einen Werbeblocker prüfen und die Seite neu laden.</li>";
          return;
        }

        initMap(data.meta || {});
        buildMarkers();
        loadFavs();
        renderChips();
        renderTags();
        syncFavButton();
        renderList();
        wire();

        $("dataStamp").textContent = "Datenstand: " + (data.meta && data.meta.generated ? data.meta.generated.split("-").reverse().join(".") : "—");
      })
      .catch(function (err) {
        els.list.innerHTML =
          "<li class='empty'>Daten konnten nicht geladen werden (" + esc(err.message) + ").<br>" +
          "Auf GitHub Pages funktioniert die Seite direkt; lokal bitte einen Server starten:<br><code>npx serve .</code></li>";
        console.error(err);
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
