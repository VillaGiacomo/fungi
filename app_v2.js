(function () {
  "use strict";

  const STORAGE = {
    points: "fungi.mobile.points.v1",
    maps: "fungi.mobile.maps.v2",
    scores: "fungi.mobile.scores.v2",
    weather: "fungi.mobile.weather.v1",
    updated: "fungi.mobile.updated.v2",
    activeProfile: "fungi.mobile.active-profile.v1",
    customProfile: "fungi.mobile.custom-profile.v1",
    basemap: "fungi.mobile.basemap.v1",
    overlay: "fungi.mobile.overlay.v1",
    opacity: "fungi.mobile.overlay-opacity.v1"
  };

  const PROFILE_DESCRIPTIONS = {
    base: "Valori base del modello desktop",
    ai_mode: "Il profilo porcini progettato da AI",
    conservativo: "Mostra solo condizioni più selettive",
    medio: "Equilibrio tra prudenza e sensibilità",
    aperto: "Segnala anche finestre meno nette",
    mio: "Valori personali modificabili sul telefono"
  };

  const EDITOR_GROUPS = [
    ["Pioggia", [
      "rain_7d_hard_min_mm", "rain_7d_preferred_min_mm", "rain_7d_preferred_max_mm",
      "rain_20d_hard_min_mm", "rain_20d_preferred_min_mm", "rain_20d_preferred_max_mm"
    ]],
    ["Temperature", [
      "temp_max_hard_min_c", "temp_max_preferred_min_c", "temp_max_preferred_max_c", "temp_max_hard_max_c",
      "temp_min_hard_min_c", "temp_min_preferred_min_c", "temp_min_preferred_max_c", "temp_min_hard_max_c",
      "humidity_hard_min_pct", "humidity_preferred_min_pct"
    ]],
    ["Stagione e buttata", [
      "season_start_month", "season_start_day", "season_end_month", "season_end_day",
      "season_rain_24h_min_mm", "season_rain_48h_min_mm", "season_thermal_score_min",
      "season_primary_start_days", "season_primary_peak_days", "season_primary_end_days",
      "restart_rain_24h_min_mm", "restart_rain_48h_min_mm", "restart_thermal_score_min",
      "restart_start_days", "restart_peak_days", "restart_end_days", "pre_trigger_multiplier"
    ]],
    ["Quota", [
      "elevation_hard_min_m", "elevation_preferred_min_m", "elevation_preferred_max_m", "elevation_hard_max_m"
    ]],
    ["Boschi", [
      "forest_beech_score", "forest_chestnut_score", "forest_spruce_score", "forest_fir_score",
      "forest_oak_score", "forest_pine_score", "forest_mixed_broadleaf_conifer_score",
      "forest_broadleaf_score", "forest_conifer_score", "forest_mixed_score", "forest_unclassified_score",
      "forest_larch_score", "forest_cembra_score", "forest_larch_cembran_score", "forest_mugo_score",
      "forest_riparian_score", "forest_black_locust_score", "forest_maple_score", "forest_ash_score",
      "forest_maple_ash_score"
    ]],
    ["Suolo e habitat", [
      "soil_ph_hard_min", "soil_ph_preferred_min", "soil_ph_preferred_max", "soil_ph_hard_max",
      "soil_acidic_score", "soil_mesic_score", "soil_carbonatic_score", "soil_xeric_score",
      "soil_unknown_score", "habitat_power"
    ]]
  ];

  const FIELD_LABELS = {
    rain_7d_hard_min_mm: "Pioggia 7g minima (mm)", rain_7d_preferred_min_mm: "Pioggia 7g ottima min",
    rain_7d_preferred_max_mm: "Pioggia 7g ottima max", rain_20d_hard_min_mm: "Pioggia 20g minima (mm)",
    rain_20d_preferred_min_mm: "Pioggia 20g ottima min", rain_20d_preferred_max_mm: "Pioggia 20g ottima max",
    temp_max_hard_min_c: "T max limite minimo °C", temp_max_hard_max_c: "T max limite massimo °C",
    temp_max_preferred_min_c: "T max ottima min °C", temp_max_preferred_max_c: "T max ottima max °C",
    temp_min_hard_min_c: "T min limite minimo °C", temp_min_hard_max_c: "T min limite massimo °C",
    temp_min_preferred_min_c: "T min ottima min °C", temp_min_preferred_max_c: "T min ottima max °C",
    humidity_hard_min_pct: "Umidità minima %", humidity_preferred_min_pct: "Umidità ottima da %",
    season_start_month: "Mese inizio", season_start_day: "Giorno inizio", season_end_month: "Mese fine",
    season_end_day: "Giorno fine", season_rain_24h_min_mm: "Innesco 24h (mm)",
    season_rain_48h_min_mm: "Innesco 48h (mm)", season_thermal_score_min: "Termico minimo innesco",
    season_primary_start_days: "Buttata: inizio giorni", season_primary_peak_days: "Buttata: picco giorni",
    season_primary_end_days: "Buttata: fine giorni", restart_rain_24h_min_mm: "Ripartenza 24h (mm)",
    restart_rain_48h_min_mm: "Ripartenza 48h (mm)", restart_thermal_score_min: "Termico ripartenza",
    restart_start_days: "Ripartenza: inizio", restart_peak_days: "Ripartenza: picco",
    restart_end_days: "Ripartenza: fine", pre_trigger_multiplier: "Indice prima dell’innesco",
    elevation_hard_min_m: "Quota limite min (m)", elevation_hard_max_m: "Quota limite max (m)",
    elevation_preferred_min_m: "Quota ottima min (m)", elevation_preferred_max_m: "Quota ottima max (m)",
    forest_beech_score: "Faggio", forest_chestnut_score: "Castagno", forest_spruce_score: "Abete rosso",
    forest_fir_score: "Abete bianco", forest_oak_score: "Quercia", forest_pine_score: "Pino",
    forest_mixed_broadleaf_conifer_score: "Misto latifoglie/conifere", forest_broadleaf_score: "Latifoglie",
    forest_conifer_score: "Conifere", forest_mixed_score: "Bosco misto", forest_unclassified_score: "Non classificato",
    forest_larch_score: "Larice", forest_cembra_score: "Cembro", forest_larch_cembran_score: "Larice-cembro",
    forest_mugo_score: "Mugo", forest_riparian_score: "Ripariale", forest_black_locust_score: "Robinia",
    forest_maple_score: "Acero", forest_ash_score: "Frassino", forest_maple_ash_score: "Acero-frassino",
    soil_ph_hard_min: "pH limite min", soil_ph_hard_max: "pH limite max", soil_ph_preferred_min: "pH ottimo min",
    soil_ph_preferred_max: "pH ottimo max", soil_acidic_score: "Suolo siliceo", soil_mesic_score: "Suolo mesico",
    soil_carbonatic_score: "Suolo carbonatico", soil_xeric_score: "Suolo xerico", soil_unknown_score: "Suolo ignoto",
    habitat_power: "Selettività habitat"
  };

  const state = {
    manifest: null,
    profiles: {},
    activeProfile: "ai_mode",
    points: [],
    maps: {},
    scores: {},
    weather: null,
    raster: null,
    selected: null,
    gps: null,
    requestId: null,
    openPointAfterLocation: false,
    activeDay: "today",
    activeOverlay: "probability",
    activeBasemap: "osm",
    overlayOpacity: 0.72,
    map: null,
    baseLayer: null,
    overlayLayer: null,
    gpsMarker: null,
    accuracyCircle: null,
    selectedMarker: null,
    pointsLayer: null,
    projectBounds: null
  };

  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const banner = document.querySelector("#installBanner");
    if (banner) banner.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    const banner = document.querySelector("#installBanner");
    if (banner) banner.classList.add("hidden");
  });

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  window.MobileNative = {
    onWeather(requestId, body) {
      if (requestId !== state.requestId) return;
      try { calculateAndStore(JSON.parse(body)); } catch (error) { updateError(error); }
    },
    onWeatherError(requestId, message) {
      if (requestId !== state.requestId) return;
      updateError(new Error(message));
    },
    onLocation(lat, lon, accuracy) {
      const location = { lat: Number(lat), lon: Number(lon), accuracy: Number(accuracy) };
      state.gps = location;
      showGps(location);
      selectLocation(location.lat, location.lon, false);
      state.map.setView([location.lat, location.lon], Math.max(state.map.getZoom(), 14), { animate: true });
      if (state.openPointAfterLocation) {
        state.openPointAfterLocation = false;
        openPointModal(location.lat, location.lon);
      }
      const outside = !state.projectBounds.contains([location.lat, location.lon]);
      const precision = Number.isFinite(location.accuracy) ? Math.round(location.accuracy) : "?";
      showToast(outside
        ? `Posizione trovata (${precision} m), fuori dall’area dei layer porcini`
        : `Posizione trovata · precisione circa ${precision} m`);
    },
    onLocationError(message) { showToast(message || "Posizione non disponibile"); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();

  async function initialize() {
    try {
      if (!window.L) throw new Error("Motore cartografico non disponibile");
      state.manifest = window.FUNGI_MANIFEST || await fetch("data/manifest.json").then(response => response.json());
      for (const entry of state.manifest.profiles || []) state.profiles[entry.key] = deepCopy(entry);
      if (!state.profiles.ai_mode) {
        state.profiles.ai_mode = { key: "ai_mode", label: "AI-mode", profile: state.manifest.ai_profile,
          habitat: state.manifest.data.habitat };
      }
      const storedCustom = loadJson(STORAGE.customProfile, null);
      if (storedCustom && state.profiles.mio) state.profiles.mio.profile = normalizeProfile(storedCustom);
      const storedActive = localStorage.getItem(STORAGE.activeProfile);
      state.activeProfile = state.profiles[storedActive] ? storedActive : "ai_mode";
      state.points = loadJson(STORAGE.points, []).filter(isPointFeature);
      state.maps = loadJson(STORAGE.maps, {});
      state.weather = loadJson(STORAGE.weather, null);
      loadStoredScores();
      state.activeBasemap = localStorage.getItem(STORAGE.basemap) || "osm";
      state.activeOverlay = localStorage.getItem(STORAGE.overlay) || "probability";
      state.overlayOpacity = clamp(Number(localStorage.getItem(STORAGE.opacity) || 72) / 100, 0.15, 1);
      state.raster = await loadModelRasters(state.manifest);
      bindNavigation();
      bindControls();
      bindInstallExperience();
      populateControls();
      initializeMap();
      renderProfileUi();
      renderPoints();
      updateConnectivity();
      window.addEventListener("online", updateConnectivity);
      window.addEventListener("offline", updateConnectivity);
      const updated = loadJson(STORAGE.updated, {});
      if (updated[state.activeProfile]) setModelUpdated(updated[state.activeProfile]);
      else setProfileReadyStatus();
    } catch (error) {
      $("#modelStatus").textContent = "Avvio incompleto";
      $("#modelUpdated").textContent = error.message;
      showToast(error.message);
    }
  }

  function bindNavigation() {
    $$(".bottom-nav button").forEach(button => button.addEventListener("click", () => {
      const target = button.dataset.target;
      $$(".bottom-nav button").forEach(item => item.classList.toggle("active", item === button));
      $$(".page").forEach(page => page.classList.toggle("active", page.dataset.page === target));
      if (target === "map" && state.map) setTimeout(() => state.map.invalidateSize(), 30);
      window.scrollTo(0, 0);
    }));
  }

  function bindControls() {
    $("#basemapSelect").addEventListener("change", event => setBasemap(event.target.value));
    $("#layerSelect").addEventListener("change", event => setOverlay(event.target.value));
    $("#daySelect").addEventListener("change", event => {
      state.activeDay = event.target.value;
      setOverlay(state.activeOverlay);
    });
    $("#overlayOpacity").addEventListener("input", event => {
      state.overlayOpacity = Number(event.target.value) / 100;
      localStorage.setItem(STORAGE.opacity, String(event.target.value));
      if (state.overlayLayer && state.overlayLayer.setOpacity) state.overlayLayer.setOpacity(state.overlayOpacity);
    });
    $("#updateWeather").addEventListener("click", updateWeather);
    $("#resetMap").addEventListener("click", () => state.map.fitBounds(state.projectBounds, { padding: [8, 8] }));
    $("#gpsButton").addEventListener("click", requestLocation);
    $("#addAtMap").addEventListener("click", () => {
      if (!state.selected) return showToast("Prima tocca la mappa o usa il GPS");
      openPointModal(state.selected.lat, state.selected.lon);
    });
    $("#newPoint").addEventListener("click", () => {
      if (state.gps) openPointModal(state.gps.lat, state.gps.lon);
      else {
        state.openPointAfterLocation = true;
        showToast("Cerco la posizione per il nuovo punto…");
        requestLocation();
      }
    });
    $("#exportPoints").addEventListener("click", exportPoints);
    $("#pointForm").addEventListener("submit", savePointFromForm);
    $$('[data-close-modal]').forEach(element => element.addEventListener("click", closePointModal));
    $("#profileSelect").addEventListener("change", () => renderSelectedProfile());
    $("#activateProfile").addEventListener("click", activateSelectedProfile);
    $("#copyToCustom").addEventListener("click", copySelectedToCustom);
    $("#customProfileForm").addEventListener("submit", saveCustomProfile);
  }

  function bindInstallExperience() {
    const banner = $("#installBanner");
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
    if (!standalone && localStorage.getItem("fungi.mobile.install-dismissed") !== "1") {
      banner.classList.remove("hidden");
    }
    $("#installAppButton").addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        banner.classList.add("hidden");
        return;
      }
      const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      showToast(isApple
        ? "In Safari: tocca Condividi ↑ e poi “Aggiungi alla schermata Home”"
        : "Apri il menu del browser e scegli “Installa app” o “Aggiungi a schermata Home”");
    });
    $("#dismissInstall").addEventListener("click", () => {
      localStorage.setItem("fungi.mobile.install-dismissed", "1");
      banner.classList.add("hidden");
    });
  }

  function populateControls() {
    const overlaySelect = $("#layerSelect");
    overlaySelect.innerHTML = '<option value="probability">Probabilità porcini</option>';
    for (const layer of state.manifest.layers) {
      if (layer.key.startsWith("bundled_")) continue;
      const option = document.createElement("option");
      option.value = layer.key;
      option.textContent = layer.label;
      overlaySelect.appendChild(option);
    }
    if (![...overlaySelect.options].some(option => option.value === state.activeOverlay)) {
      state.activeOverlay = "probability";
    }
    overlaySelect.value = state.activeOverlay;
    $("#basemapSelect").value = ["osm", "satellite", "offline"].includes(state.activeBasemap)
      ? state.activeBasemap : "osm";
    $("#overlayOpacity").value = String(Math.round(state.overlayOpacity * 100));
    const profileSelect = $("#profileSelect");
    profileSelect.innerHTML = "";
    for (const entry of Object.values(state.profiles)) {
      const option = document.createElement("option");
      option.value = entry.key;
      option.textContent = entry.label;
      profileSelect.appendChild(option);
    }
    profileSelect.value = state.activeProfile;
  }

  function initializeMap() {
    const bbox = state.manifest.area.bbox;
    state.projectBounds = L.latLngBounds([bbox.min_lat, bbox.min_lon], [bbox.max_lat, bbox.max_lon]);
    state.map = L.map("leafletMap", { zoomControl: true, attributionControl: true, preferCanvas: true });
    state.map.createPane("fungiOverlay");
    state.map.getPane("fungiOverlay").style.zIndex = "430";
    state.map.fitBounds(state.projectBounds, { padding: [8, 8] });
    L.rectangle(state.projectBounds, { color: "#74452e", weight: 1, dashArray: "5 5", fill: false,
      opacity: 0.55, interactive: false }).addTo(state.map);
    state.pointsLayer = L.layerGroup().addTo(state.map);
    state.map.on("click", event => selectLocation(event.latlng.lat, event.latlng.lng, true));
    setBasemap(state.activeBasemap);
    setOverlay(state.activeOverlay);
  }

  function setBasemap(key) {
    state.activeBasemap = ["osm", "satellite", "offline"].includes(key) ? key : "osm";
    localStorage.setItem(STORAGE.basemap, state.activeBasemap);
    $("#basemapSelect").value = state.activeBasemap;
    if (state.baseLayer) state.map.removeLayer(state.baseLayer);
    if (state.activeBasemap === "osm") {
      state.baseLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
        subdomains: "abcd", maxZoom: 20, keepBuffer: 1, updateWhenIdle: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>'
      });
    } else if (state.activeBasemap === "satellite") {
      state.baseLayer = L.tileLayer(
        "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
        { maxNativeZoom: 14, maxZoom: 18, keepBuffer: 1, updateWhenIdle: true, noWrap: true,
          attribution: '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX · modified Copernicus Sentinel-2 2024' }
      );
    } else {
      const elevation = state.manifest.layers.find(layer => layer.key === "elevation");
      state.baseLayer = L.imageOverlay(elevation ? elevation.path : "data/maps/layer_elevation.png",
        state.projectBounds, { opacity: 1, zIndex: 100, alt: "Quota offline" });
    }
    state.baseLayer.addTo(state.map);
    if (state.baseLayer.bringToBack) state.baseLayer.bringToBack();
  }

  function setOverlay(key) {
    state.activeOverlay = key || "probability";
    localStorage.setItem(STORAGE.overlay, state.activeOverlay);
    $("#layerSelect").value = state.activeOverlay;
    $("#dayControl").classList.toggle("hidden", state.activeOverlay !== "probability");
    $("#probabilityLegend").classList.toggle("hidden", state.activeOverlay !== "probability");
    if (state.overlayLayer) {
      state.map.removeLayer(state.overlayLayer);
      state.overlayLayer = null;
    }
    let path = null;
    if (state.activeOverlay === "probability") {
      const profileMaps = state.maps[state.activeProfile] || {};
      path = profileMaps[state.activeDay] || bundledProbabilityPath(state.activeDay);
    } else {
      const layer = state.manifest.layers.find(item => item.key === state.activeOverlay);
      path = layer && layer.path;
    }
    if (path) {
      state.overlayLayer = L.imageOverlay(path, state.projectBounds, {
        opacity: state.overlayOpacity, pane: "fungiOverlay", alt: "Layer " + state.activeOverlay
      }).addTo(state.map);
    }
    readSelectedScore();
  }

  function bundledProbabilityPath(day) {
    const key = { today: "bundled_today", tomorrow: "bundled_tomorrow",
      day_after_tomorrow: "bundled_day_after" }[day];
    const layer = state.manifest.layers.find(item => item.key === key);
    return layer && layer.path;
  }

  function updateWeather() {
    if (!state.manifest || !state.raster) return;
    state.requestId = "weather-" + Date.now();
    const url = window.FungiModel.buildWeatherRequest(state.manifest);
    const button = $("#updateWeather");
    button.disabled = true;
    button.innerHTML = '<span class="button-icon">···</span> Scarico';
    $("#modelStatus").textContent = "Download meteo in corso";
    $("#modelUpdated").textContent = "25 punti · storico 92 giorni · forecast 3 giorni";
    if (window.AndroidApp && typeof window.AndroidApp.fetchWeather === "function") {
      window.AndroidApp.fetchWeather(state.requestId, url);
    } else {
      fetch(url).then(response => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      }).then(calculateAndStore).catch(updateError);
    }
  }

  function calculateAndStore(payload) {
    state.weather = payload;
    localStorage.setItem(STORAGE.weather, JSON.stringify(payload));
    recalculateActiveProfile(true);
  }

  function recalculateActiveProfile(fromDownload) {
    if (!state.weather || !state.raster) {
      setProfileReadyStatus();
      setOverlay("probability");
      return;
    }
    $("#modelStatus").textContent = "Calcolo " + activeProfileEntry().label + " sul telefono";
    $("#modelUpdated").textContent = "Pioggia, termico, fase, quota, bosco, suolo e punti personali";
    setTimeout(() => {
      try {
        const profile = activeProfileEntry().profile;
        const habitat = habitatForActiveProfile();
        const result = window.FungiModel.calculate(
          state.weather, state.manifest, habitat, state.raster.elevation, state.points, profile
        );
        const mapStore = {};
        const scoreStore = {};
        for (const key of window.FungiModel.DAY_KEYS) {
          const day = result.days[key];
          const canvas = document.createElement("canvas");
          canvas.width = state.manifest.model.width;
          canvas.height = state.manifest.model.height;
          canvas.getContext("2d").putImageData(new ImageData(day.rgba, canvas.width, canvas.height), 0, 0);
          mapStore[key] = canvas.toDataURL("image/png");
          scoreStore[key] = window.FungiModel.bytesToBase64(day.probability);
        }
        state.maps[state.activeProfile] = mapStore;
        state.scores[state.activeProfile] = Object.fromEntries(window.FungiModel.DAY_KEYS.map(
          key => [key, window.FungiModel.base64ToBytes(scoreStore[key])]
        ));
        localStorage.setItem(STORAGE.maps, JSON.stringify(state.maps));
        const storedScores = loadJson(STORAGE.scores, {});
        storedScores[state.activeProfile] = scoreStore;
        localStorage.setItem(STORAGE.scores, JSON.stringify(storedScores));
        const timestamp = new Date().toISOString();
        const updated = loadJson(STORAGE.updated, {});
        updated[state.activeProfile] = timestamp;
        localStorage.setItem(STORAGE.updated, JSON.stringify(updated));
        setModelUpdated(timestamp);
        setOverlay("probability");
        showToast(`${activeProfileEntry().label}: mappe aggiornate e salvate sul telefono`);
      } catch (error) {
        updateError(error);
        return;
      }
      resetUpdateButton();
    }, fromDownload ? 30 : 10);
  }

  function habitatForActiveProfile() {
    if (state.activeProfile !== "mio") return state.raster.habitats[state.activeProfile] || state.raster.habitats.ai_mode;
    const profile = activeProfileEntry().profile;
    const count = state.manifest.model.width * state.manifest.model.height;
    const habitat = new Uint8Array(count);
    const soilKeys = ["soil_unknown_score", "soil_acidic_score", "soil_mesic_score",
      "soil_carbonatic_score", "soil_xeric_score"];
    for (let index = 0; index < count; index += 1) {
      if (!state.raster.allowed[index]) continue;
      const forestKey = state.manifest.data.forest_profile_keys[String(state.raster.forest[index])]
        || "forest_unclassified_score";
      const soilKey = soilKeys[state.raster.soil[index]] || "soil_unknown_score";
      habitat[index] = Math.round(clamp(Number(profile[forestKey]) * Number(profile[soilKey]), 0, 1) * 255);
    }
    return habitat;
  }

  function loadStoredScores() {
    const stored = loadJson(STORAGE.scores, {});
    for (const [profileKey, days] of Object.entries(stored)) {
      state.scores[profileKey] = {};
      for (const [day, value] of Object.entries(days || {})) {
        try { state.scores[profileKey][day] = window.FungiModel.base64ToBytes(value); } catch (_) { /* ignore */ }
      }
    }
  }

  async function loadModelRasters(manifest) {
    const width = manifest.model.width;
    const height = manifest.model.height;
    const habitatEntries = Object.entries(manifest.data.habitats || { ai_mode: manifest.data.habitat });
    const [elevationData, forestData, soilData, allowedData, ...habitatData] = await Promise.all([
      imagePixels(manifest.data.elevation, width, height),
      imagePixels(manifest.data.forest_type, width, height),
      imagePixels(manifest.data.soil_class, width, height),
      imagePixels(manifest.data.allowed_land, width, height),
      ...habitatEntries.map(([, path]) => imagePixels(path, width, height))
    ]);
    const count = width * height;
    const elevation = new Int32Array(count);
    const forest = new Uint8Array(count);
    const soil = new Uint8Array(count);
    const allowed = new Uint8Array(count);
    const habitats = {};
    for (const [profileKey] of habitatEntries) habitats[profileKey] = new Uint8Array(count);
    for (let index = 0; index < count; index += 1) {
      const source = index * 4;
      const encoded = elevationData[source] * 256 + elevationData[source + 1];
      elevation[index] = encoded === 0 ? -1 : encoded - 1;
      forest[index] = forestData[source];
      soil[index] = soilData[source];
      allowed[index] = allowedData[source] > 127 ? 1 : 0;
      habitatEntries.forEach(([profileKey], habitatIndex) => {
        habitats[profileKey][index] = habitatData[habitatIndex][source];
      });
    }
    return { elevation, forest, soil, allowed, habitats };
  }

  function imagePixels(path, width, height) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(image, 0, 0, width, height);
          resolve(context.getImageData(0, 0, width, height).data);
        } catch (_) { reject(new Error("Raster locale bloccato: " + path)); }
      };
      image.onerror = () => reject(new Error("Impossibile leggere " + path));
      image.src = path;
    });
  }

  function renderProfileUi() {
    $("#activeProfileBadge").textContent = activeProfileEntry().label;
    $("#activeProfileEyebrow").textContent = activeProfileEntry().label + " locale";
    $("#profileStatus").textContent = "Profilo attivo sul telefono: " + activeProfileEntry().label;
    const container = $("#profilePresetCards");
    container.innerHTML = "";
    for (const entry of Object.values(state.profiles)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "profile-preset" + (entry.key === state.activeProfile ? " active" : "");
      button.innerHTML = `<strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(PROFILE_DESCRIPTIONS[entry.key] || "Profilo salvato")}</small>`;
      button.addEventListener("click", () => {
        $("#profileSelect").value = entry.key;
        renderSelectedProfile();
      });
      container.appendChild(button);
    }
    renderSelectedProfile();
    renderCustomEditor();
  }

  function renderSelectedProfile() {
    const entry = selectedProfileEntry();
    $("#profileRulesTitle").textContent = entry.label;
    renderRules(entry.profile);
    $$(".profile-preset").forEach((button, index) => {
      button.classList.toggle("active", Object.values(state.profiles)[index].key === entry.key);
    });
  }

  function activateSelectedProfile() {
    state.activeProfile = selectedProfileEntry().key;
    localStorage.setItem(STORAGE.activeProfile, state.activeProfile);
    renderProfileUi();
    setOverlay("probability");
    recalculateActiveProfile(false);
  }

  function copySelectedToCustom() {
    const copy = normalizeProfile(deepCopy(selectedProfileEntry().profile));
    state.profiles.mio.profile = copy;
    localStorage.setItem(STORAGE.customProfile, JSON.stringify(copy));
    $("#profileSelect").value = "mio";
    renderCustomEditor();
    renderSelectedProfile();
    $("#customEditor").open = true;
    showToast("Valori copiati in Mio profilo; ora puoi modificarli");
  }

  function renderCustomEditor() {
    const profile = state.profiles.mio.profile;
    const container = $("#profileEditorFields");
    container.innerHTML = "";
    for (const [title, keys] of EDITOR_GROUPS) {
      const details = document.createElement("details");
      details.className = "editor-group";
      const summary = document.createElement("summary");
      summary.textContent = title;
      const grid = document.createElement("div");
      grid.className = "editor-grid";
      for (const key of keys) {
        if (!(key in profile)) continue;
        const label = document.createElement("label");
        const span = document.createElement("span");
        span.textContent = FIELD_LABELS[key] || key;
        const input = document.createElement("input");
        input.type = "number";
        input.dataset.profileKey = key;
        input.value = String(profile[key]);
        input.step = fieldStep(key);
        const limits = fieldLimits(key);
        input.min = String(limits[0]);
        input.max = String(limits[1]);
        label.append(span, input);
        grid.appendChild(label);
      }
      details.append(summary, grid);
      container.appendChild(details);
    }
  }

  function saveCustomProfile(event) {
    event.preventDefault();
    const profile = deepCopy(state.profiles.mio.profile);
    $$("[data-profile-key]").forEach(input => {
      const value = Number(input.value);
      if (Number.isFinite(value)) profile[input.dataset.profileKey] = value;
    });
    state.profiles.mio.profile = normalizeProfile(profile);
    localStorage.setItem(STORAGE.customProfile, JSON.stringify(state.profiles.mio.profile));
    state.activeProfile = "mio";
    localStorage.setItem(STORAGE.activeProfile, "mio");
    $("#profileSelect").value = "mio";
    renderProfileUi();
    recalculateActiveProfile(false);
    showToast("Mio profilo salvato e attivato sul telefono");
  }

  function normalizeProfile(value) {
    const profile = {};
    for (const [key, raw] of Object.entries(value || {})) {
      const number = Number(raw);
      if (Number.isFinite(number)) profile[key] = number;
    }
    const ordered = [
      ["temp_max_hard_min_c", "temp_max_preferred_min_c", "temp_max_preferred_max_c", "temp_max_hard_max_c"],
      ["temp_min_hard_min_c", "temp_min_preferred_min_c", "temp_min_preferred_max_c", "temp_min_hard_max_c"],
      ["elevation_hard_min_m", "elevation_preferred_min_m", "elevation_preferred_max_m", "elevation_hard_max_m"],
      ["soil_ph_hard_min", "soil_ph_preferred_min", "soil_ph_preferred_max", "soil_ph_hard_max"],
      ["season_primary_start_days", "season_primary_peak_days", "season_primary_end_days"],
      ["restart_start_days", "restart_peak_days", "restart_end_days"]
    ];
    for (const keys of ordered) {
      if (keys.every(key => Number.isFinite(profile[key]))) {
        const values = keys.map(key => profile[key]).sort((a, b) => a - b);
        keys.forEach((key, index) => { profile[key] = values[index]; });
      }
    }
    for (const prefix of ["forest_", "soil_"]) {
      for (const key of Object.keys(profile)) {
        if (key.startsWith(prefix) && key.endsWith("_score")) profile[key] = clamp(profile[key], 0, 1);
      }
    }
    profile.pre_trigger_multiplier = clamp(profile.pre_trigger_multiplier, 0, 1);
    profile.habitat_power = clamp(profile.habitat_power, 0.3, 2);
    return profile;
  }

  function renderRules(profile) {
    const rules = [
      ["☂", "Riserva idrica", `7 giorni: minimo ${profile.rain_7d_hard_min_mm} mm, ottimo ${profile.rain_7d_preferred_min_mm}–${profile.rain_7d_preferred_max_mm} mm. 20 giorni: minimo ${profile.rain_20d_hard_min_mm} mm, ottimo ${profile.rain_20d_preferred_min_mm}–${profile.rain_20d_preferred_max_mm} mm.`],
      ["◒", "Termico", `Massime ottime ${profile.temp_max_preferred_min_c}–${profile.temp_max_preferred_max_c} °C; minime ${profile.temp_min_preferred_min_c}–${profile.temp_min_preferred_max_c} °C.`],
      ["≋", "Umidità", `Indice nullo sotto ${profile.humidity_hard_min_pct}%, pieno da ${profile.humidity_preferred_min_pct}%. Il vento forte riduce la componente meteo.`],
      ["◷", "Innesco e buttata", `Stagione ${Math.round(profile.season_start_day)}/${Math.round(profile.season_start_month)}–${Math.round(profile.season_end_day)}/${Math.round(profile.season_end_month)}. Innesco ${profile.season_rain_24h_min_mm}/${profile.season_rain_48h_min_mm} mm; picco al giorno ${profile.season_primary_peak_days}.`],
      ["↻", "Ripartenze", `Pioggia ${profile.restart_rain_24h_min_mm}/${profile.restart_rain_48h_min_mm} mm; picco dopo ${profile.restart_peak_days} giorni; fine dopo ${profile.restart_end_days}.`],
      ["△", "Quota dinamica", `Limiti ${profile.elevation_hard_min_m}–${profile.elevation_hard_max_m} m; fascia preferita ${profile.elevation_preferred_min_m}–${profile.elevation_preferred_max_m} m.`],
      ["♣", "Boschi", `Faggio ${fixed(profile.forest_beech_score)}, castagno ${fixed(profile.forest_chestnut_score)}, abete rosso ${fixed(profile.forest_spruce_score)}, quercia ${fixed(profile.forest_oak_score)}, pino ${fixed(profile.forest_pine_score)}.`],
      ["◇", "Suolo", `pH preferito ${fixed(profile.soil_ph_preferred_min, 1)}–${fixed(profile.soil_ph_preferred_max, 1)}. Siliceo ${fixed(profile.soil_acidic_score)}, mesico ${fixed(profile.soil_mesic_score)}, carbonatico ${fixed(profile.soil_carbonatic_score)}.`]
    ];
    $("#aiRules").innerHTML = rules.map(([icon, title, text]) =>
      `<article class="rule-card"><div class="rule-icon">${icon}</div><div><h3>${title}</h3><p>${text}</p></div></article>`
    ).join("");
  }

  function requestLocation() {
    showToast("Ricerca posizione precisa…");
    if (window.AndroidApp && typeof window.AndroidApp.requestLocation === "function") {
      window.AndroidApp.requestLocation();
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => window.MobileNative.onLocation(
        position.coords.latitude, position.coords.longitude, position.coords.accuracy
      ), error => window.MobileNative.onLocationError(error.message),
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
    } else showToast("GPS non disponibile");
  }

  function showGps(location) {
    if (state.gpsMarker) state.map.removeLayer(state.gpsMarker);
    if (state.accuracyCircle) state.map.removeLayer(state.accuracyCircle);
    state.gpsMarker = L.marker([location.lat, location.lon], {
      icon: L.divIcon({ className: "", html: '<div class="gps-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      zIndexOffset: 1000
    }).addTo(state.map).bindTooltip("La mia posizione");
    if (Number.isFinite(location.accuracy)) {
      state.accuracyCircle = L.circle([location.lat, location.lon], { radius: location.accuracy,
        color: "#287dcc", weight: 1, fillColor: "#287dcc", fillOpacity: 0.10, interactive: false }).addTo(state.map);
    }
  }

  function selectLocation(lat, lon, showMarker) {
    state.selected = { lat: Number(lat), lon: Number(lon) };
    $("#coordReadout").textContent = state.selected.lat.toFixed(5) + ", " + state.selected.lon.toFixed(5);
    if (showMarker) {
      if (state.selectedMarker) state.map.removeLayer(state.selectedMarker);
      state.selectedMarker = L.circleMarker([lat, lon], { radius: 5, color: "#fff", weight: 2,
        fillColor: "#a65a34", fillOpacity: 1 }).addTo(state.map);
    }
    readSelectedScore();
  }

  function readSelectedScore() {
    const scores = (state.scores[state.activeProfile] || {})[state.activeDay];
    if (!state.selected || state.activeOverlay !== "probability") {
      $("#scoreReadout").textContent = "—";
      return;
    }
    const bbox = state.manifest.area.bbox;
    const x = Math.round((state.selected.lon - bbox.min_lon) / (bbox.max_lon - bbox.min_lon)
      * (state.manifest.model.width - 1));
    const y = Math.round((bbox.max_lat - state.selected.lat) / (bbox.max_lat - bbox.min_lat)
      * (state.manifest.model.height - 1));
    if (x < 0 || x >= state.manifest.model.width || y < 0 || y >= state.manifest.model.height) {
      $("#scoreReadout").textContent = "fuori area";
    } else if (!scores) {
      $("#scoreReadout").textContent = "aggiorna";
    } else $("#scoreReadout").textContent = scores[y * state.manifest.model.width + x] + " / 100";
  }

  function openPointModal(lat, lon) {
    state.selected = { lat: Number(lat), lon: Number(lon) };
    $("#formCoordinates").textContent = state.selected.lat.toFixed(6) + ", " + state.selected.lon.toFixed(6);
    $("#pointDate").value = window.FungiModel.localTodayIso();
    $("#pointModal").classList.remove("hidden");
  }

  function closePointModal() { $("#pointModal").classList.add("hidden"); }

  function savePointFromForm(event) {
    event.preventDefault();
    if (!state.selected) return;
    state.points.push({ type: "Feature", id: makeId(), properties: {
      species: "porcini", observation_date: $("#pointDate").value,
      quantity: $("#pointQuantity").value.trim(), note: $("#pointNote").value.trim(),
      point_type: $("#pointType").value, created_at: new Date().toISOString()
    }, geometry: { type: "Point", coordinates: [state.selected.lon, state.selected.lat] } });
    persistPoints();
    $("#pointForm").reset();
    closePointModal();
    renderPoints();
    recalculateActiveProfile(false);
    showToast("Fungaia salvata sul telefono");
  }

  function renderPoints() {
    const list = $("#pointsList");
    list.innerHTML = "";
    const sorted = [...state.points].sort((a, b) => String(b.properties.observation_date)
      .localeCompare(String(a.properties.observation_date)));
    $("#pointsEmpty").classList.toggle("hidden", sorted.length > 0);
    $("#pointCount").textContent = sorted.length;
    $("#lastPointDate").textContent = sorted.length ? formatDate(sorted[0].properties.observation_date) : "—";
    for (const point of sorted) {
      const coordinates = point.geometry.coordinates;
      const props = point.properties;
      const card = document.createElement("article");
      card.className = "point-card";
      card.innerHTML = `<div class="marker-icon">⌖</div><div><h3>${escapeHtml(pointTypeLabel(props.point_type))} · ${formatDate(props.observation_date)}</h3>
        <p>${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}${props.quantity ? " · " + escapeHtml(props.quantity) : ""}${props.note ? "<br>" + escapeHtml(props.note) : ""}</p></div>
        <button type="button" aria-label="Elimina punto">×</button>`;
      card.querySelector("button").addEventListener("click", () => deletePoint(point.id));
      card.querySelector(".marker-icon").addEventListener("click", () => {
        showPage("map");
        selectLocation(coordinates[1], coordinates[0], true);
        state.map.setView([coordinates[1], coordinates[0]], 15);
      });
      list.appendChild(card);
    }
    renderPointMarkers();
  }

  function renderPointMarkers() {
    if (!state.pointsLayer) return;
    state.pointsLayer.clearLayers();
    for (const point of state.points) {
      const coordinates = point.geometry.coordinates;
      const type = point.properties.point_type || "both";
      const marker = L.marker([coordinates[1], coordinates[0]], {
        icon: L.divIcon({ className: "", html: `<div class="point-pin ${type}"></div>`,
          iconSize: [16, 16], iconAnchor: [8, 16] })
      }).addTo(state.pointsLayer);
      marker.on("click", () => selectLocation(coordinates[1], coordinates[0], false));
    }
  }

  function deletePoint(id) {
    if (!confirm("Eliminare questa fungaia dal telefono?")) return;
    state.points = state.points.filter(point => point.id !== id);
    persistPoints();
    renderPoints();
    recalculateActiveProfile(false);
    showToast("Punto eliminato");
  }

  function persistPoints() { localStorage.setItem(STORAGE.points, JSON.stringify(state.points)); }

  async function exportPoints() {
    if (!state.points.length) return showToast("Non ci sono punti da esportare");
    const contents = JSON.stringify({ type: "FeatureCollection", name: "fungi_punti",
      exported_at: new Date().toISOString(), features: state.points }, null, 2);
    const filename = "fungi_punti_" + window.FungiModel.localTodayIso() + ".geojson";
    if (window.AndroidApp && typeof window.AndroidApp.exportGeoJson === "function") {
      window.AndroidApp.exportGeoJson(contents, filename);
    } else {
      const file = new File([contents], filename, { type: "application/json" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        try {
          await navigator.share({ title: "Punti fungaia", text: "Esportazione Fungi AI", files: [file] });
          showToast("GeoJSON condiviso");
          return;
        } catch (error) {
          if (error && error.name === "AbortError") return;
        }
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      showToast("GeoJSON scaricato");
    }
  }

  function activeProfileEntry() { return state.profiles[state.activeProfile]; }
  function selectedProfileEntry() { return state.profiles[$("#profileSelect").value] || activeProfileEntry(); }

  function setProfileReadyStatus() {
    $("#modelStatus").textContent = activeProfileEntry().label + " attivo";
    $("#modelUpdated").textContent = state.weather
      ? "Il meteo è disponibile: calcolo locale pronto"
      : "Premi Aggiorna dati per calcolare le probabilità con questo profilo";
  }

  function setModelUpdated(timestamp) {
    const date = new Date(timestamp);
    $("#modelStatus").textContent = activeProfileEntry().label + " calcolato sul telefono";
    $("#modelUpdated").textContent = "Ultimo aggiornamento: " + date.toLocaleString("it-IT", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  }

  function updateError(error) {
    $("#modelStatus").textContent = "Aggiornamento non riuscito";
    $("#modelUpdated").textContent = "Resta disponibile l’ultima mappa salvata";
    resetUpdateButton();
    showToast(error && error.message ? error.message : "Errore durante l’aggiornamento");
  }

  function resetUpdateButton() {
    const button = $("#updateWeather");
    button.disabled = false;
    button.innerHTML = '<span class="button-icon">↻</span> Aggiorna dati';
  }

  function fieldStep(key) {
    if (key.includes("month") || key.includes("day") || key.endsWith("_m")) return "1";
    if (key.includes("soil_ph")) return "0.1";
    if (key.includes("score") || key.includes("multiplier") || key === "habitat_power") return "0.01";
    return "0.5";
  }

  function fieldLimits(key) {
    if (key.includes("month")) return [1, 12];
    if (key.includes("day") && !key.includes("rain")) return [0, 40];
    if (key.endsWith("_score") || key.includes("multiplier")) return [0, 1];
    if (key === "habitat_power") return [0.3, 2];
    if (key.includes("elevation")) return [0, 4000];
    if (key.includes("soil_ph")) return [0, 14];
    if (key.includes("humidity")) return [0, 100];
    if (key.includes("temp_")) return [-20, 45];
    return [0, 500];
  }

  function showPage(target) {
    const button = $(`.bottom-nav button[data-target="${target}"]`);
    if (button) button.click();
  }

  function updateConnectivity() {
    $("#offlineBadge").textContent = navigator.onLine ? "locale · rete ok" : "offline pronto";
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 3600);
  }

  function loadJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) { return fallback; }
  }

  function isPointFeature(value) {
    return value && value.type === "Feature" && value.geometry && value.geometry.type === "Point"
      && Array.isArray(value.geometry.coordinates) && value.geometry.coordinates.length >= 2;
  }

  function pointTypeLabel(value) {
    return { both: "Fungaia + ritrovamento", known_spot: "Fungaia nota", finding: "Ritrovamento" }[value] || "Fungaia";
  }

  function formatDate(value) {
    if (!value) return "—";
    const parts = value.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value == null ? "" : String(value);
    return element.innerHTML;
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "point-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function fixed(value, decimals = 2) { return Number(value).toFixed(decimals).replace(".", ","); }
  function clamp(value, low, high) { return Math.min(Math.max(value, low), high); }
  function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
}());
