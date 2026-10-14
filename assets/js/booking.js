/*
 * Booking page: map + address search, validation, and sending the request to WhatsApp.
 *
 * Map tiles and address search: OpenStreetMap / Nominatim (free, no key; fair-use limits).
 * Driving distance: public OSRM demo server (free, no key; fair-use limits).
 * For production traffic, swap these for a paid provider (e.g. Google Maps Platform).
 */
(function () {
  "use strict";

  var cfg = window.BB_CONFIG;
  var form = document.getElementById("booking-form");
  var successPanel = document.getElementById("success");
  var NOMINATIM = "https://nominatim.openstreetmap.org";
  var OSRM = "https://router.project-osrm.org/route/v1/driving/";

  // ---------------------------------------------------------------------------
  // Locations state
  // ---------------------------------------------------------------------------
  var points = {
    pickup: { lat: null, lng: null, label: "", marker: null },
    dropoff: { lat: null, lng: null, label: "", marker: null }
  };
  var route = { km: null, minutes: null, approx: false, line: null };

  // ---------------------------------------------------------------------------
  // Map
  // ---------------------------------------------------------------------------
  var map = null;
  if (window.L) {
    map = L.map("map", { scrollWheelZoom: false, tap: true }).setView(cfg.mapCenter, cfg.mapZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    // Let people scroll the page past the map, but zoom with the wheel after clicking into it
    map.on("focus click", function () { map.scrollWheelZoom.enable(); });
    map.on("blur", function () { map.scrollWheelZoom.disable(); });

    map.on("click", function (e) {
      var which = form.querySelector('input[name="mapmode"]:checked').value;
      setPoint(which, e.latlng.lat, e.latlng.lng, null, { reverse: true });
      // After placing the pickup, the next tap most likely means drop-off
      if (which === "pickup" && points.dropoff.lat === null) setMapMode("dropoff");
    });
  } else {
    document.getElementById("map").innerHTML =
      '<p style="padding:16px">The map could not load. Please type the addresses above. You can still send your request.</p>';
  }

  function setMapMode(which) {
    form.querySelector('input[name="mapmode"][value="' + which + '"]').checked = true;
  }

  function pinIcon(letter, cls) {
    return L.divIcon({
      className: "",
      html: '<div class="pin ' + cls + '"><b>' + letter + "</b></div>",
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    });
  }

  function setPoint(which, lat, lng, label, opts) {
    opts = opts || {};
    var p = points[which];
    var input = document.getElementById(which);
    p.lat = lat;
    p.lng = lng;
    p.label = label || "";
    if (label) input.value = label;
    else if (opts.reverse) input.value = "Pinned on map (" + lat.toFixed(5) + ", " + lng.toFixed(5) + ")";
    clearInvalid(document.getElementById(which + "-field"));

    if (map) {
      if (!p.marker) {
        p.marker = L.marker([lat, lng], {
          draggable: true,
          icon: pinIcon(which === "pickup" ? "A" : "B", which === "pickup" ? "a" : "b"),
          title: which === "pickup" ? "Pickup" : "Drop-off"
        }).addTo(map);
        p.marker.on("dragend", function () {
          var ll = p.marker.getLatLng();
          setPoint(which, ll.lat, ll.lng, null, { reverse: true, keepView: true });
        });
      } else {
        p.marker.setLatLng([lat, lng]);
      }
      if (!opts.keepView) fitView();
    }
    if (opts.reverse) reverseGeocode(which, lat, lng);
    updateRoute();
  }

  function fitView() {
    var a = points.pickup, b = points.dropoff;
    if (a.lat !== null && b.lat !== null) {
      map.fitBounds([[a.lat, a.lng], [b.lat, b.lng]], { padding: [40, 40], maxZoom: 15 });
    } else {
      var p = a.lat !== null ? a : b;
      map.setView([p.lat, p.lng], Math.max(map.getZoom(), 15));
    }
  }

  // ---------------------------------------------------------------------------
  // Geocoding (Nominatim)
  // ---------------------------------------------------------------------------
  function shortLabel(r) {
    // Nominatim's display_name is long; trim the country/postcode tail for readability
    var parts = (r.display_name || "").split(", ");
    var cut = parts.filter(function (s) { return s !== "South Africa" && !/^\d{4}$/.test(s); });
    return cut.slice(0, 5).join(", ");
  }

  function reverseGeocode(which, lat, lng) {
    var url = NOMINATIM + "/reverse?format=jsonv2&zoom=18&lat=" + lat + "&lon=" + lng;
    fetch(url, { headers: { "Accept-Language": "en" } })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        var p = points[which];
        // Ignore stale answers if the pin moved again in the meantime
        if (!r || !r.display_name || p.lat !== lat || p.lng !== lng) return;
        p.label = shortLabel(r);
        document.getElementById(which).value = p.label;
      })
      .catch(function () { /* keep the coordinates label */ });
  }

  function setupSearch(which) {
    var input = document.getElementById(which);
    var list = document.getElementById(which + "-list");
    var timer = null, controller = null, results = [], active = -1;

    function close() {
      list.innerHTML = "";
      results = [];
      active = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function note(text) {
      list.innerHTML = '<li class="note">' + text + "</li>";
      input.setAttribute("aria-expanded", "true");
    }

    function render() {
      list.innerHTML = "";
      if (!results.length) { note("No matches. Try a street, suburb or place name, or tap the map."); return; }
      results.forEach(function (r, i) {
        var li = document.createElement("li");
        li.id = which + "-opt-" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", i === active ? "true" : "false");
        li.textContent = shortLabel(r);
        // mousedown fires before the input's blur, so the choice isn't lost
        li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(i); });
        list.appendChild(li);
      });
      input.setAttribute("aria-expanded", "true");
      if (active >= 0) input.setAttribute("aria-activedescendant", which + "-opt-" + active);
    }

    function choose(i) {
      var r = results[i];
      if (!r) return;
      close();
      setPoint(which, parseFloat(r.lat), parseFloat(r.lon), shortLabel(r));
      if (which === "pickup" && points.dropoff.lat === null) setMapMode("dropoff");
    }

    function search(q) {
      if (controller) controller.abort();
      controller = window.AbortController ? new AbortController() : null;
      var params = "format=jsonv2&addressdetails=0&limit=6&countrycodes=" + encodeURIComponent(cfg.searchCountries) +
        "&q=" + encodeURIComponent(q);
      if (map) {
        // Prefer results near what the customer is looking at, without excluding others
        var b = map.getBounds().pad(2);
        params += "&viewbox=" + [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()].join(",");
      }
      note("Searching…");
      fetch(NOMINATIM + "/search?" + params, {
        headers: { "Accept-Language": "en" },
        signal: controller ? controller.signal : undefined
      })
        .then(function (r) { return r.json(); })
        .then(function (data) { results = data || []; active = -1; render(); })
        .catch(function (err) {
          if (err && err.name === "AbortError") return;
          note("Search is unavailable right now. Tap the map to place the pin instead.");
        });
    }

    input.addEventListener("input", function () {
      // Typing invalidates the previously chosen point until a new one is picked
      points[which].lat = null;
      points[which].lng = null;
      updateRoute();
      clearTimeout(timer);
      var q = input.value.trim();
      if (q.length < 3) { close(); return; }
      // Nominatim's fair-use policy: at most ~1 request per second
      timer = setTimeout(function () { search(q); }, 800);
    });

    input.addEventListener("keydown", function (e) {
      if (!results.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % results.length; render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + results.length) % results.length; render(); }
      else if (e.key === "Enter") { e.preventDefault(); choose(active >= 0 ? active : 0); }
      else if (e.key === "Escape") { close(); }
    });

    input.addEventListener("blur", function () { setTimeout(close, 150); });
  }

  setupSearch("pickup");
  setupSearch("dropoff");

  // "Use my current location" for the pickup
  var locateBtn = document.getElementById("locate-btn");
  var locateStatus = document.getElementById("locate-status");
  locateBtn.addEventListener("click", function () {
    if (!navigator.geolocation) {
      locateStatus.textContent = "Your browser can't share location. Please search or tap the map.";
      return;
    }
    locateStatus.textContent = "Finding your location…";
    locateBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        locateBtn.disabled = false;
        var acc = Math.round(pos.coords.accuracy);
        locateStatus.textContent = "Location found (accurate to about " + acc + " m). Drag pin A if it's not quite right.";
        setPoint("pickup", pos.coords.latitude, pos.coords.longitude, null, { reverse: true });
        if (points.dropoff.lat === null) setMapMode("dropoff");
      },
      function (err) {
        locateBtn.disabled = false;
        locateStatus.textContent = err.code === 1
          ? "Location permission was denied. Please search for the address or tap the map."
          : "Couldn't get your location. Please search for the address or tap the map.";
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });

  // ---------------------------------------------------------------------------
  // Route distance (and optional price estimate)
  // ---------------------------------------------------------------------------
  var summary = document.getElementById("route-summary");
  var routeSeq = 0;

  function haversineKm(a, b) {
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function estimatePrice(km) {
    var p = cfg.pricing;
    if (!p || !p.enabled || km == null) return null;
    return Math.max(p.minimum || 0, (p.callOutFee || 0) + (p.perKm || 0) * km);
  }

  function formatMoney(v) {
    return cfg.pricing.currency + " " + Math.round(v).toLocaleString("en-ZA");
  }

  function drawLine(coords) {
    if (!map) return;
    if (route.line) map.removeLayer(route.line);
    route.line = L.polyline(coords, { color: "#1a6be0", weight: 5, opacity: .75 }).addTo(map);
  }

  function updateRoute() {
    var a = points.pickup, b = points.dropoff;
    route.km = route.minutes = null;
    if (a.lat === null || b.lat === null) {
      if (route.line && map) { map.removeLayer(route.line); route.line = null; }
      summary.classList.remove("show");
      return;
    }
    var seq = ++routeSeq;
    summary.classList.add("show");
    summary.textContent = "Working out the distance…";

    var url = OSRM + a.lng + "," + a.lat + ";" + b.lng + "," + b.lat + "?overview=full&geometries=geojson";
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (seq !== routeSeq) return;
        if (!data.routes || !data.routes.length) throw new Error("no route");
        var r = data.routes[0];
        route.km = r.distance / 1000;
        route.minutes = r.duration / 60;
        route.approx = false;
        drawLine(r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }));
        renderSummary();
      })
      .catch(function () {
        if (seq !== routeSeq) return;
        // Fallback: straight-line distance with a typical road-detour factor
        route.km = haversineKm(a, b) * 1.3;
        route.minutes = null;
        route.approx = true;
        drawLine([[a.lat, a.lng], [b.lat, b.lng]]);
        renderSummary();
      });
  }

  function renderSummary() {
    var html = "<span>Distance: " + (route.approx ? "about " : "") + route.km.toFixed(1) + " km</span>";
    if (route.minutes) html += "<span>Drive time: ~" + Math.round(route.minutes) + " min</span>";
    var price = estimatePrice(route.km);
    if (price !== null) html += '<span class="estimate">Estimated price: ' + formatMoney(price) + "</span>";
    else html += '<span style="font-weight:400;color:var(--muted)">We\'ll confirm the price on WhatsApp.</span>';
    summary.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // Conditional fields
  // ---------------------------------------------------------------------------
  var ownerDetails = document.getElementById("owner-details");
  var schedule = document.getElementById("schedule");
  var dateInput = document.getElementById("date");

  function todayISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  dateInput.min = todayISO();

  form.addEventListener("change", function (e) {
    var t = e.target;
    if (t.name === "owner") ownerDetails.classList.toggle("show", t.value === "No");
    if (t.name === "when") schedule.classList.toggle("show", t.value === "Later");
    var field = t.closest(".field");
    if (field) clearInvalid(field);
  });
  form.addEventListener("input", function (e) {
    var field = e.target.closest(".field");
    if (field) clearInvalid(field);
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  // Accepts SA numbers like 082 123 4567, 0821234567, +27 82 123 4567, 27821234567,
  // and other international numbers starting with +. Returns digits in international form.
  function normalisePhone(raw) {
    var s = (raw || "").replace(/[\s\-().]/g, "");
    if (/^\+\d{8,15}$/.test(s)) return s.slice(1);
    if (/^00\d{8,15}$/.test(s)) return s.slice(2);
    if (/^27\d{9}$/.test(s)) return s;
    if (/^0\d{9}$/.test(s)) return "27" + s.slice(1);
    return null;
  }

  function displayPhone(intl) {
    // 27821234567 -> 082 123 4567 (SA) ; others -> +<digits>
    if (/^27\d{9}$/.test(intl)) {
      var n = "0" + intl.slice(2);
      return n.slice(0, 3) + " " + n.slice(3, 6) + " " + n.slice(6);
    }
    return "+" + intl;
  }

  function markInvalid(field) { field.classList.add("invalid"); }
  function clearInvalid(field) { field.classList.remove("invalid"); }
  function val(id) { return document.getElementById(id).value.trim(); }
  function radio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  function validate() {
    var bad = [];
    function check(ok, el, label) {
      var field = el.closest(".field");
      if (ok) { clearInvalid(field); return; }
      markInvalid(field);
      bad.push({ el: el, label: label });
    }
    function byId(id) { return document.getElementById(id); }

    check(val("name").length >= 2, byId("name"), "your name");
    check(!!normalisePhone(val("whatsapp")), byId("whatsapp"), "WhatsApp number");
    check(!val("altphone") || !!normalisePhone(val("altphone")), byId("altphone"), "other number");
    check(!!val("make"), byId("make"), "vehicle make");
    check(!!val("model"), byId("model"), "vehicle model");
    check(!!val("vtype"), byId("vtype"), "vehicle type");
    check(!!val("problem"), byId("problem"), "what happened");
    check(!!radio("keys"), form.querySelector('input[name="keys"]'), "keys");
    check(!!radio("owner"), form.querySelector('input[name="owner"]'), "owner");
    if (radio("owner") === "No") {
      check(!val("ownerPhone") || !!normalisePhone(val("ownerPhone")), byId("ownerPhone"), "owner's number");
    }
    // A typed address without a chosen result still counts: the owner can read it
    check(points.pickup.lat !== null || val("pickup").length >= 5, byId("pickup"), "pickup location");
    check(points.dropoff.lat !== null || val("dropoff").length >= 5, byId("dropoff"), "drop-off location");
    if (radio("when") === "Later") {
      check(!!val("date") && val("date") >= todayISO(), byId("date"), "date");
      check(!!val("time"), byId("time"), "time");
    }
    check(byId("consent").checked, byId("consent"), "consent");
    return bad;
  }

  // ---------------------------------------------------------------------------
  // Message
  // ---------------------------------------------------------------------------
  function makeRef() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return "BB-" + pad(d.getDate()) + pad(d.getMonth() + 1) + "-" + Math.floor(1000 + Math.random() * 9000);
  }

  function mapsLink(p) {
    return "https://maps.google.com/?q=" + p.lat.toFixed(6) + "," + p.lng.toFixed(6);
  }

  function formatWhen() {
    if (radio("when") !== "Later") return "As soon as possible";
    var d = new Date(val("date") + "T" + val("time"));
    if (isNaN(d)) return val("date") + " " + val("time");
    return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" }) + " at " + val("time");
  }

  function buildMessage(ref) {
    var a = points.pickup, b = points.dropoff;
    var lines = [];
    lines.push("*NEW TOW REQUEST* (" + ref + ")");
    lines.push("");
    lines.push("*Customer*");
    lines.push("Name: " + val("name"));
    lines.push("WhatsApp: " + displayPhone(normalisePhone(val("whatsapp"))));
    if (val("altphone")) lines.push("Calls: " + displayPhone(normalisePhone(val("altphone"))));
    lines.push("");
    lines.push("*Vehicle*");
    lines.push(val("make") + " " + val("model") + " (" + val("vtype") + ")");
    if (val("reg")) lines.push("Reg/colour: " + val("reg"));
    lines.push("Problem: " + val("problem"));
    lines.push("Has keys: " + radio("keys"));
    lines.push("Owner: " + radio("owner"));
    if (radio("owner") === "No" && (val("ownerName") || val("ownerPhone"))) {
      lines.push("Owner details: " + [val("ownerName"), val("ownerPhone") ? displayPhone(normalisePhone(val("ownerPhone"))) : ""]
        .filter(Boolean).join(", "));
    }
    if (radio("rolls")) lines.push("Wheels turn freely: " + radio("rolls"));
    lines.push("");
    lines.push("*Pickup (A)*");
    lines.push(val("pickup"));
    if (a.lat !== null) lines.push(mapsLink(a));
    if (val("landmark")) lines.push("Landmark: " + val("landmark"));
    lines.push("");
    lines.push("*Drop-off (B)*");
    lines.push(val("dropoff"));
    if (b.lat !== null) lines.push(mapsLink(b));
    if (route.km !== null) {
      lines.push("");
      lines.push("Distance: " + (route.approx ? "approx. " : "") + route.km.toFixed(1) + " km" +
        (route.minutes ? " (~" + Math.round(route.minutes) + " min drive)" : ""));
      var price = estimatePrice(route.km);
      if (price !== null) lines.push("Website estimate: " + formatMoney(price));
    }
    if (a.lat !== null && b.lat !== null) {
      lines.push("Route: https://www.google.com/maps/dir/?api=1&origin=" + a.lat.toFixed(6) + "," + a.lng.toFixed(6) +
        "&destination=" + b.lat.toFixed(6) + "," + b.lng.toFixed(6));
    }
    lines.push("");
    lines.push("*When:* " + formatWhen());
    if (val("notes")) {
      lines.push("");
      lines.push("*Notes*");
      lines.push(val("notes"));
    }
    return lines.join("\n");
  }

  // ---------------------------------------------------------------------------
  // Remember the customer's name and number on this device for next time
  // ---------------------------------------------------------------------------
  var STORE_KEY = "bb-towing-contact";
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved) {
      if (saved.name) document.getElementById("name").value = saved.name;
      if (saved.whatsapp) document.getElementById("whatsapp").value = saved.whatsapp;
    }
  } catch (e) { /* storage unavailable */ }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  var errorsBox = document.getElementById("form-errors");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var bad = validate();
    if (bad.length) {
      errorsBox.textContent = "Please check: " + bad.map(function (b) { return b.label; }).join(", ") + ".";
      errorsBox.classList.add("show");
      bad[0].el.focus({ preventScroll: true });
      bad[0].el.closest(".field").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    errorsBox.classList.remove("show");

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ name: val("name"), whatsapp: val("whatsapp") }));
    } catch (err) { /* storage unavailable */ }

    var ref = makeRef();
    var text = buildMessage(ref);
    var url = "https://wa.me/" + cfg.whatsappNumber + "?text=" + encodeURIComponent(text);

    document.getElementById("success-ref").textContent = ref;
    document.getElementById("success-text").textContent = text;
    document.getElementById("wa-again").href = url;
    form.style.display = "none";
    successPanel.classList.add("show");
    successPanel.focus({ preventScroll: true });
    window.scrollTo({ top: successPanel.getBoundingClientRect().top + window.scrollY - 90, behavior: "instant" });

    // Open WhatsApp (new tab on desktop; on phones this hands over to the app)
    // ("noopener" as a window feature would make window.open return null, so detach manually)
    var win = window.open(url, "_blank");
    if (win) win.opener = null;
    else window.location.href = url;
  });

  document.getElementById("edit-btn").addEventListener("click", function () {
    successPanel.classList.remove("show");
    form.style.display = "";
    if (map) setTimeout(function () { map.invalidateSize(); }, 50);
    form.scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("copy-btn").addEventListener("click", function () {
    var btn = this;
    var text = document.getElementById("success-text").textContent;
    var done = function () { btn.textContent = "Copied!"; setTimeout(function () { btn.textContent = "Copy request text"; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    else {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { /* ignore */ }
      ta.remove();
    }
  });
})();
