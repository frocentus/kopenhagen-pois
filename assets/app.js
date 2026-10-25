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
    return (
      "<span class='rating' title='Google-Bewertung, Stand Okt 2026'>★ " +
      p.rating.toFixed(1).replace(".", ",") +
      (p.reviews && p.reviews !== "—" ? " <small>(" + esc(p.reviews) + ")</small>" : "") +
      "</span>"
    );
  }
  function hoursStatus(p) {
    if (!p.hours) return { known: false, open: null, text: "Öffnungszeiten unbekannt" };
    var parsed = window.CPHHours.parse(p.hours, refDate());
    return window.CPHHours.status(parsed);
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
        renderList();
        syncMarkers();
      });
    });
  }

  function visiblePlaces() {
    var q = state.query.trim().toLowerCase();
    var now = window.CPHHours.nowInCopenhagen();

    var list = state.places.filter(function (p) {
      if (!state.active[p.cat]) return false;
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
        "<li class='card' data-id='" + p.id + "' tabindex='0' role='button' style='--c:" + state.catById[p.cat].color + "'>" +
        "<div class='card-head'>" +
        "<h3>" + esc(p.name) + "</h3>" +
        "<span class='card-badge'>" + esc(p.sub) + "</span>" +
        "</div>" +
        "<div class='card-meta'>" +
        (p.priceLevel ? priceDots(p.priceLevel) : "") +
        ratingHtml(p) +
        (dist ? "<span class='dist'>" + dist + "</span>" : "") +
        "</div>" +
        "<div class='card-hours'><span class='status-dot " + dotClass + "'></span>" +
        "<span>" + esc(st.known ? st.text : "Zeiten unbekannt") + "</span></div>" +
        "</li>";
    });
    els.list.innerHTML = html;

    els.list.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function () { openDetail(card.dataset.id, true); });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail(card.dataset.id, true);
        }
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
      "<div class='popup-meta'>" + priceDots(p.priceLevel) + ratingHtml(p) + "</div>" +
      "<div class='card-hours'><span class='status-dot " + dot + "'></span>" +
      "<span>" + esc(st.known ? st.text : "Zeiten unbekannt") + "</span></div>" +
      "<button type='button' class='popup-more' data-id='" + p.id + "'>Details ansehen →</button>" +
      "</div>"
    );
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
        (p.cat === "restaurant" || p.cat === "fastfood" || p.cat === "breakfast" ? "Website & Karte" : "Website") +
        "</a>";
    }
    if (p.menu) {
      links +=
        "<a class='btn' href='" + esc(p.menu) + "' target='_blank' rel='noopener noreferrer'>Speisekarte</a>";
    }
    links +=
      "<a class='btn btn-ghost' href='https://www.google.com/maps/dir/?api=1&destination=" +
      p.lat + "," + p.lon + "' target='_blank' rel='noopener noreferrer'>Route</a>";

    els.drawer.innerHTML =
      "<div class='drawer-head' style='--c:" + c.color + "'>" +
      "<div class='drawer-cat'><span aria-hidden='true'>" + c.icon + "</span> " + esc(c.label) + "</div>" +
      "<button class='icon-btn' id='drawerClose' aria-label='Schließen'>✕</button>" +
      "</div>" +
      "<div class='drawer-body'>" +
      "<h2>" + esc(p.name) + "</h2>" +
      "<p class='drawer-sub'>" + esc(p.sub) + " · " + esc(p.area) + (dist ? " · " + dist : "") + "</p>" +

      "<div class='drawer-facts'>" +
      (p.priceText ? "<div class='fact'><span class='fact-k'>" + (p.cat === "attraction" ? "Eintritt" : p.cat === "supermarket" || p.cat === "mall" ? "Preisniveau" : "Preis") + "</span><span class='fact-v'>" + esc(p.priceText) + "</span></div>" : "") +
      (p.rating ? "<div class='fact'><span class='fact-k'>Bewertung</span><span class='fact-v'>" + ratingHtml(p) + "</span></div>" : "") +
      "<div class='fact'><span class='fact-k'>Status</span><span class='fact-v'><span class='status-dot " + dot + "'></span> " + esc(st.text) + "</span></div>" +
      "</div>" +

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

      "<div class='drawer-actions'>" + links + "</div>" +

      "<p class='drawer-src'>Quelle: " + esc(p.src || "OpenStreetMap") + " · Angaben ohne Gewähr</p>" +
      "</div>";

    els.drawer.hidden = false;
    void els.drawer.offsetWidth; // Reflow erzwingen, damit die Einblend-Animation läuft
    els.drawer.classList.add("is-open");
    document.body.classList.add("drawer-open");
    document.body.classList.remove("sidebar-open");
    $("sidebarToggle").setAttribute("aria-expanded", "false");
    $("drawerClose").addEventListener("click", closeDetail);
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
    map.on("click", function () {
      document.body.classList.remove("sidebar-open");
    });
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
      }
    });

    var toggle = $("sidebarToggle");
    toggle.addEventListener("click", function () {
      document.body.classList.toggle("sidebar-open");
      toggle.setAttribute("aria-expanded", document.body.classList.contains("sidebar-open") ? "true" : "false");
    });

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
        renderChips();
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
