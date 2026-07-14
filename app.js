(function () {
  "use strict";

  const STORAGE = {
    points: "fungi.mobile.points.v1",
    maps: "fungi.mobile.maps.v1",
    weather: "fungi.mobile.weather.v1",
    updated: "fungi.mobile.updated.v1"
  };
  const DISPLAY = { width: 879, height: 579 };
  const state = {
    manifest: null,
    points: [],
    maps: {},
    scores: {},
    weather: null,
    raster: null,
    selected: null,
    gps: null,
    activeLayer: "ai_local",
    activeDay: "today",
    requestId: null,
    openPointAfterLocation: false,
    map: { scale: 1, fit: 1, x: 0, y: 0, pointers: new Map(), gesture: null }
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  window.MobileNative = {
    onWeather(requestId, body) {
      if (requestId !== state.requestId) return;
      try {
        calculateAndStore(JSON.parse(body));
      } catch (error) {
        updateError(error);
      }
    },
    onWeatherError(requestId, message) {
      if (requestId !== state.requestId) return;
      updateError(new Error(message));
    },
    onLocation(lat, lon, accuracy) {
      state.gps = { lat: Number(lat), lon: Number(lon), accuracy: Number(accuracy) };
      setGpsMarker(state.gps);
      selectLocation(state.gps.lat, state.gps.lon);
      centerOn(state.gps.lat, state.gps.lon, Math.max(state.map.fit * 2.4, state.map.scale));
      if (state.openPointAfterLocation) {
        state.openPointAfterLocation = false;
        openPointModal(state.gps.lat, state.gps.lon);
      }
      showToast("Posizione trovata · precisione circa " + Math.round(state.gps.accuracy) + " m");
    },
    onLocationError(message) {
      showToast(message || "Posizione non disponibile");
    }
  };

  document.addEventListener("DOMContentLoaded", initialize);

  async function initialize() {
    try {
      state.manifest = window.FUNGI_MANIFEST || await fetch("data/manifest.json").then(response => {
        if (!response.ok) throw new Error("Manifest mobile non disponibile");
        return response.json();
      });
      state.points = loadJson(STORAGE.points, []).filter(isPointFeature);
      state.maps = loadJson(STORAGE.maps, {});
      state.weather = loadJson(STORAGE.weather, null);
      loadStoredScores();
      state.raster = await loadModelRasters(state.manifest);
      bindNavigation();
      bindControls();
      populateLayers();
      renderAiRules();
      renderPoints();
      setupMapGestures();
      updateConnectivity();
      window.addEventListener("online", updateConnectivity);
      window.addEventListener("offline", updateConnectivity);
      window.addEventListener("resize", fitMap);
      requestAnimationFrame(() => {
        fitMap();
        setLayer("ai_local");
      });
      const updated = localStorage.getItem(STORAGE.updated);
      if (updated) setModelUpdated(updated);
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
      if (target === "map") requestAnimationFrame(fitMap);
      window.scrollTo(0, 0);
    }));
  }

  function bindControls() {
    $("#layerSelect").addEventListener("change", event => setLayer(event.target.value));
    $("#daySelect").addEventListener("change", event => {
      state.activeDay = event.target.value;
      setLayer(state.activeLayer);
    });
    $("#updateWeather").addEventListener("click", updateWeather);
    $("#resetMap").addEventListener("click", fitMap);
    $("#gpsButton").addEventListener("click", requestLocation);
    $("#addAtMap").addEventListener("click", () => {
      if (!state.selected) return showToast("Prima tocca la mappa o usa il GPS");
      openPointModal(state.selected.lat, state.selected.lon);
    });
    $("#newPoint").addEventListener("click", () => {
      if (state.gps) openPointModal(state.gps.lat, state.gps.lon);
      else {
        showToast("Cerco la posizione per il nuovo punto…");
        state.openPointAfterLocation = true;
        requestLocation();
      }
    });
    $("#exportPoints").addEventListener("click", exportPoints);
    $("#pointForm").addEventListener("submit", savePointFromForm);
    $$('[data-close-modal]').forEach(element => element.addEventListener("click", closePointModal));
  }

  function populateLayers() {
    const select = $("#layerSelect");
    select.innerHTML = '<option value="ai_local">AI-mode locale (ultimo calcolo)</option>';
    for (const layer of state.manifest.layers) {
      const option = document.createElement("option");
      option.value = layer.key;
      option.textContent = layer.label;
      select.appendChild(option);
    }
  }

  function setLayer(key) {
    state.activeLayer = key;
    $("#layerSelect").value = key;
    const base = $("#baseMap");
    const overlay = $("#imageOverlay");
    const canvas = $("#probabilityCanvas");
    const elevationLayer = state.manifest.layers.find(layer => layer.key === "elevation");
    base.src = elevationLayer ? elevationLayer.path : "data/maps/layer_elevation.png";
    overlay.classList.add("hidden");
    canvas.classList.add("hidden");
    $("#dayControl").classList.toggle("hidden", key !== "ai_local");

    if (key === "ai_local") {
      const dataUrl = state.maps[state.activeDay];
      if (dataUrl) {
        drawProbabilityDataUrl(dataUrl);
        canvas.classList.remove("hidden");
      } else {
        const fallbackKey = {
          today: "bundled_today",
          tomorrow: "bundled_tomorrow",
          day_after_tomorrow: "bundled_day_after"
        }[state.activeDay];
        const fallback = state.manifest.layers.find(layer => layer.key === fallbackKey);
        if (fallback) {
          overlay.src = fallback.path;
          overlay.classList.remove("hidden");
        }
        $("#modelStatus").textContent = "AI-mode pronto per l’aggiornamento";
        $("#modelUpdated").textContent = "Nel frattempo è mostrata la mappa inclusa nell’APK";
      }
      readSelectedScore();
      return;
    }

    const layer = state.manifest.layers.find(item => item.key === key);
    if (!layer) return;
    if (layer.mode === "base") {
      base.src = layer.path;
    } else {
      overlay.src = layer.path;
      overlay.classList.remove("hidden");
    }
    $("#scoreReadout").textContent = "—";
  }

  function drawProbabilityDataUrl(dataUrl) {
    const image = new Image();
    image.onload = () => {
      const canvas = $("#probabilityCanvas");
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = dataUrl;
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
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then(calculateAndStore)
        .catch(updateError);
    }
  }

  function calculateAndStore(payload) {
    $("#modelStatus").textContent = "Calcolo locale in corso";
    $("#modelUpdated").textContent = "Pioggia, termico, fase, quota, bosco e punti personali";
    setTimeout(() => {
      try {
        const result = window.FungiModel.calculate(
          payload,
          state.manifest,
          state.raster.habitat,
          state.raster.elevation,
          state.points
        );
        const mapStore = {};
        const scoreStore = {};
        for (const key of window.FungiModel.DAY_KEYS) {
          const day = result.days[key];
          const canvas = document.createElement("canvas");
          canvas.width = state.manifest.model.width;
          canvas.height = state.manifest.model.height;
          canvas.getContext("2d").putImageData(
            new ImageData(day.rgba, canvas.width, canvas.height), 0, 0
          );
          mapStore[key] = canvas.toDataURL("image/png");
          scoreStore[key] = window.FungiModel.bytesToBase64(day.probability);
          state.scores[key] = day.probability;
        }
        state.maps = mapStore;
        state.weather = payload;
        localStorage.setItem(STORAGE.maps, JSON.stringify(mapStore));
        localStorage.setItem(STORAGE.weather, JSON.stringify(payload));
        localStorage.setItem(STORAGE.maps + ".scores", JSON.stringify(scoreStore));
        const timestamp = new Date().toISOString();
        localStorage.setItem(STORAGE.updated, timestamp);
        setModelUpdated(timestamp);
        setLayer("ai_local");
        showToast("Mappe AI aggiornate e salvate sul telefono");
      } catch (error) {
        updateError(error);
        return;
      }
      resetUpdateButton();
    }, 30);
  }

  function recalculateFromCache() {
    if (!state.weather || !state.raster) return;
    try {
      const result = window.FungiModel.calculate(
        state.weather,
        state.manifest,
        state.raster.habitat,
        state.raster.elevation,
        state.points
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
        state.scores[key] = day.probability;
      }
      state.maps = mapStore;
      localStorage.setItem(STORAGE.maps, JSON.stringify(mapStore));
      localStorage.setItem(STORAGE.maps + ".scores", JSON.stringify(scoreStore));
      if (state.activeLayer === "ai_local") setLayer("ai_local");
    } catch (error) {
      showToast("Punto salvato; ricalcolo mappa non riuscito: " + error.message);
    }
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

  function setModelUpdated(timestamp) {
    const date = new Date(timestamp);
    $("#modelStatus").textContent = "AI-mode calcolato sul telefono";
    $("#modelUpdated").textContent = "Ultimo aggiornamento: " + date.toLocaleString("it-IT", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  }

  async function loadModelRasters(manifest) {
    const [habitatData, elevationData] = await Promise.all([
      imagePixels(manifest.data.habitat, manifest.model.width, manifest.model.height),
      imagePixels(manifest.data.elevation, manifest.model.width, manifest.model.height)
    ]);
    const count = manifest.model.width * manifest.model.height;
    const habitat = new Uint8Array(count);
    const elevation = new Int32Array(count);
    for (let index = 0; index < count; index += 1) {
      const source = index * 4;
      habitat[index] = habitatData[source];
      const encoded = elevationData[source] * 256 + elevationData[source + 1];
      elevation[index] = encoded === 0 ? -1 : encoded - 1;
    }
    return { habitat, elevation };
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
        } catch (error) {
          reject(new Error("Raster locale bloccato da Android: " + path));
        }
      };
      image.onerror = () => reject(new Error("Impossibile leggere " + path));
      image.src = path;
    });
  }

  function loadStoredScores() {
    const stored = loadJson(STORAGE.maps + ".scores", {});
    for (const [key, value] of Object.entries(stored)) {
      try { state.scores[key] = window.FungiModel.base64ToBytes(value); } catch (_) { /* ignore corrupt cache */ }
    }
  }

  function setupMapGestures() {
    const viewport = $("#mapViewport");
    viewport.addEventListener("pointerdown", event => {
      viewport.setPointerCapture(event.pointerId);
      state.map.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.map.pointers.size === 1) {
        state.map.gesture = {
          type: "pan", startX: event.clientX, startY: event.clientY,
          mapX: state.map.x, mapY: state.map.y, moved: false
        };
      } else if (state.map.pointers.size === 2) {
        startPinch();
      }
    });
    viewport.addEventListener("pointermove", event => {
      if (!state.map.pointers.has(event.pointerId)) return;
      state.map.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const gesture = state.map.gesture;
      if (!gesture) return;
      if (state.map.pointers.size === 1 && gesture.type === "pan") {
        const dx = event.clientX - gesture.startX;
        const dy = event.clientY - gesture.startY;
        if (Math.hypot(dx, dy) > 5) gesture.moved = true;
        state.map.x = gesture.mapX + dx;
        state.map.y = gesture.mapY + dy;
        clampMap();
        applyMapTransform();
      } else if (state.map.pointers.size === 2) {
        updatePinch();
      }
    });
    const finish = event => {
      const gesture = state.map.gesture;
      const wasTap = state.map.pointers.size === 1 && gesture && gesture.type === "pan" && !gesture.moved;
      state.map.pointers.delete(event.pointerId);
      if (wasTap) handleMapTap(event.clientX, event.clientY);
      if (state.map.pointers.size === 1) {
        const remaining = Array.from(state.map.pointers.values())[0];
        state.map.gesture = { type: "pan", startX: remaining.x, startY: remaining.y,
          mapX: state.map.x, mapY: state.map.y, moved: true };
      } else if (!state.map.pointers.size) {
        state.map.gesture = null;
      }
    };
    viewport.addEventListener("pointerup", finish);
    viewport.addEventListener("pointercancel", finish);
  }

  function startPinch() {
    const values = Array.from(state.map.pointers.values());
    const midpoint = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };
    const rect = $("#mapViewport").getBoundingClientRect();
    state.map.gesture = {
      type: "pinch",
      distance: Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y),
      scale: state.map.scale,
      stageX: (midpoint.x - rect.left - state.map.x) / state.map.scale,
      stageY: (midpoint.y - rect.top - state.map.y) / state.map.scale
    };
  }

  function updatePinch() {
    const values = Array.from(state.map.pointers.values());
    const gesture = state.map.gesture;
    if (!gesture || gesture.type !== "pinch") return;
    const midpoint = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };
    const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    const rect = $("#mapViewport").getBoundingClientRect();
    state.map.scale = clamp(gesture.scale * distance / Math.max(gesture.distance, 1), state.map.fit, state.map.fit * 6);
    state.map.x = midpoint.x - rect.left - gesture.stageX * state.map.scale;
    state.map.y = midpoint.y - rect.top - gesture.stageY * state.map.scale;
    clampMap();
    applyMapTransform();
  }

  function handleMapTap(clientX, clientY) {
    const position = clientToStage(clientX, clientY);
    if (position.x < 0 || position.x > DISPLAY.width || position.y < 0 || position.y > DISPLAY.height) return;
    const bbox = state.manifest.area.bbox;
    const lon = bbox.min_lon + position.x / DISPLAY.width * (bbox.max_lon - bbox.min_lon);
    const lat = bbox.max_lat - position.y / DISPLAY.height * (bbox.max_lat - bbox.min_lat);
    selectLocation(lat, lon);
  }

  function selectLocation(lat, lon) {
    state.selected = { lat, lon };
    $("#coordReadout").textContent = lat.toFixed(5) + ", " + lon.toFixed(5);
    readSelectedScore();
  }

  function readSelectedScore() {
    const scores = state.scores[state.activeDay];
    if (!state.selected || state.activeLayer !== "ai_local" || !scores) {
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
      return;
    }
    $("#scoreReadout").textContent = scores[y * state.manifest.model.width + x] + " / 100";
  }

  function fitMap() {
    const viewport = $("#mapViewport");
    if (!viewport) return;
    state.map.fit = Math.min(viewport.clientWidth / DISPLAY.width, viewport.clientHeight / DISPLAY.height);
    state.map.scale = state.map.fit;
    state.map.x = (viewport.clientWidth - DISPLAY.width * state.map.scale) / 2;
    state.map.y = (viewport.clientHeight - DISPLAY.height * state.map.scale) / 2;
    applyMapTransform();
  }

  function centerOn(lat, lon, scale) {
    const bbox = state.manifest.area.bbox;
    const viewport = $("#mapViewport");
    const x = (lon - bbox.min_lon) / (bbox.max_lon - bbox.min_lon) * DISPLAY.width;
    const y = (bbox.max_lat - lat) / (bbox.max_lat - bbox.min_lat) * DISPLAY.height;
    state.map.scale = clamp(scale, state.map.fit, state.map.fit * 6);
    state.map.x = viewport.clientWidth / 2 - x * state.map.scale;
    state.map.y = viewport.clientHeight / 2 - y * state.map.scale;
    clampMap();
    applyMapTransform();
  }

  function setGpsMarker(location) {
    const bbox = state.manifest.area.bbox;
    const marker = $("#gpsMarker");
    const x = (location.lon - bbox.min_lon) / (bbox.max_lon - bbox.min_lon) * DISPLAY.width;
    const y = (bbox.max_lat - location.lat) / (bbox.max_lat - bbox.min_lat) * DISPLAY.height;
    marker.style.left = x + "px";
    marker.style.top = y + "px";
    marker.classList.toggle("hidden", x < 0 || x > DISPLAY.width || y < 0 || y > DISPLAY.height);
  }

  function clampMap() {
    const viewport = $("#mapViewport");
    const width = DISPLAY.width * state.map.scale;
    const height = DISPLAY.height * state.map.scale;
    const margin = 55;
    state.map.x = clamp(state.map.x, Math.min(margin, viewport.clientWidth - width - margin), Math.max(-margin, viewport.clientWidth - margin));
    state.map.y = clamp(state.map.y, Math.min(margin, viewport.clientHeight - height - margin), Math.max(-margin, viewport.clientHeight - margin));
  }

  function applyMapTransform() {
    $("#mapStage").style.transform = `translate(${state.map.x}px,${state.map.y}px) scale(${state.map.scale})`;
  }

  function clientToStage(clientX, clientY) {
    const rect = $("#mapViewport").getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.map.x) / state.map.scale,
      y: (clientY - rect.top - state.map.y) / state.map.scale
    };
  }

  function requestLocation() {
    if (window.AndroidApp && typeof window.AndroidApp.requestLocation === "function") {
      window.AndroidApp.requestLocation();
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => window.MobileNative.onLocation(
          position.coords.latitude, position.coords.longitude, position.coords.accuracy
        ),
        error => window.MobileNative.onLocationError(error.message),
        { enableHighAccuracy: true, timeout: 20000 }
      );
    } else showToast("GPS non disponibile");
  }

  function openPointModal(lat, lon) {
    state.selected = { lat: Number(lat), lon: Number(lon) };
    $("#formCoordinates").textContent = state.selected.lat.toFixed(6) + ", " + state.selected.lon.toFixed(6);
    $("#pointDate").value = window.FungiModel.localTodayIso();
    $("#pointModal").classList.remove("hidden");
  }

  function closePointModal() {
    $("#pointModal").classList.add("hidden");
  }

  function savePointFromForm(event) {
    event.preventDefault();
    if (!state.selected) return;
    const feature = {
      type: "Feature",
      id: makeId(),
      properties: {
        species: "porcini",
        observation_date: $("#pointDate").value,
        quantity: $("#pointQuantity").value.trim(),
        note: $("#pointNote").value.trim(),
        point_type: $("#pointType").value,
        created_at: new Date().toISOString()
      },
      geometry: { type: "Point", coordinates: [state.selected.lon, state.selected.lat] }
    };
    state.points.push(feature);
    persistPoints();
    $("#pointForm").reset();
    closePointModal();
    renderPoints();
    recalculateFromCache();
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
      const card = document.createElement("article");
      card.className = "point-card";
      const coordinates = point.geometry.coordinates;
      const props = point.properties;
      card.innerHTML = `
        <div class="marker-icon">⌖</div>
        <div><h3>${escapeHtml(pointTypeLabel(props.point_type))} · ${formatDate(props.observation_date)}</h3>
        <p>${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}${props.quantity ? " · " + escapeHtml(props.quantity) : ""}${props.note ? "<br>" + escapeHtml(props.note) : ""}</p></div>
        <button type="button" aria-label="Elimina punto">×</button>`;
      card.querySelector("button").addEventListener("click", () => deletePoint(point.id));
      card.querySelector(".marker-icon").addEventListener("click", () => {
        showPage("map");
        selectLocation(coordinates[1], coordinates[0]);
        centerOn(coordinates[1], coordinates[0], state.map.fit * 3);
      });
      list.appendChild(card);
    }
    renderMarkers();
  }

  function renderMarkers() {
    const layer = $("#markersLayer");
    if (!layer || !state.manifest) return;
    layer.innerHTML = "";
    const bbox = state.manifest.area.bbox;
    for (const point of state.points) {
      const coordinates = point.geometry.coordinates;
      const x = (coordinates[0] - bbox.min_lon) / (bbox.max_lon - bbox.min_lon) * DISPLAY.width;
      const y = (bbox.max_lat - coordinates[1]) / (bbox.max_lat - bbox.min_lat) * DISPLAY.height;
      if (x < 0 || x > DISPLAY.width || y < 0 || y > DISPLAY.height) continue;
      const marker = document.createElement("span");
      marker.className = "point-marker " + (point.properties.point_type || "both");
      marker.style.left = x + "px";
      marker.style.top = y + "px";
      layer.appendChild(marker);
    }
  }

  function deletePoint(id) {
    if (!confirm("Eliminare questa fungaia dal telefono?")) return;
    state.points = state.points.filter(point => point.id !== id);
    persistPoints();
    renderPoints();
    recalculateFromCache();
    showToast("Punto eliminato");
  }

  function persistPoints() {
    localStorage.setItem(STORAGE.points, JSON.stringify(state.points));
  }

  function exportPoints() {
    if (!state.points.length) return showToast("Non ci sono punti da esportare");
    const collection = {
      type: "FeatureCollection",
      name: "fungi_punti",
      exported_at: new Date().toISOString(),
      features: state.points
    };
    const contents = JSON.stringify(collection, null, 2);
    const filename = "fungi_punti_" + window.FungiModel.localTodayIso() + ".geojson";
    if (window.AndroidApp && typeof window.AndroidApp.exportGeoJson === "function") {
      window.AndroidApp.exportGeoJson(contents, filename);
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([contents], { type: "application/geo+json" }));
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function renderAiRules() {
    const profile = state.manifest.ai_profile;
    const rules = [
      ["☂", "Riserva idrica", `7 giorni: nullo sotto ${profile.rain_7d_hard_min_mm} mm, ottimo ${profile.rain_7d_preferred_min_mm}–${profile.rain_7d_preferred_max_mm} mm. 20 giorni: almeno ${profile.rain_20d_hard_min_mm} mm, ottimo ${profile.rain_20d_preferred_min_mm}–${profile.rain_20d_preferred_max_mm} mm.`],
      ["◒", "Termico", `Massime medie ottime ${profile.temp_max_preferred_min_c}–${profile.temp_max_preferred_max_c} °C; minime ${profile.temp_min_preferred_min_c}–${profile.temp_min_preferred_max_c} °C. Fuori dai limiti l’indice termico va a zero.`],
      ["≋", "Umidità e vento", `Umidità nulla sotto ${profile.humidity_hard_min_pct}%, piena da ${profile.humidity_preferred_min_pct}%. Raffiche oltre 45 km/h riducono fino al 45% la componente meteo.`],
      ["◷", "Innesco e buttata", `Stagione ${Math.round(profile.season_start_day)}/${Math.round(profile.season_start_month)}–${Math.round(profile.season_end_day)}/${Math.round(profile.season_end_month)}. Innesco con ${profile.season_rain_24h_min_mm}/${profile.season_rain_48h_min_mm} mm in 24/48 h; picco primario al giorno ${profile.season_primary_peak_days}.`],
      ["↻", "Ripartenze", `Nuovo ciclo da ${profile.restart_rain_24h_min_mm}/${profile.restart_rain_48h_min_mm} mm; parte al giorno ${profile.restart_start_days}, picco ${profile.restart_peak_days}, termina ${profile.restart_end_days}. Fuori finestra resta solo il ${Math.round(profile.pre_trigger_multiplier * 100)}% del meteo.`],
      ["△", "Quota dinamica", `Intervallo ${profile.elevation_hard_min_m}–${profile.elevation_hard_max_m} m, preferito ${profile.elevation_preferred_min_m}–${profile.elevation_preferred_max_m} m. Con caldo la fascia sale; con freddo scende.`],
      ["♣", "Boschi", `Faggio, castagno e abete rosso 1,00; abete bianco ${fixed(profile.forest_fir_score)}, misto ${fixed(profile.forest_mixed_score)}, quercia ${fixed(profile.forest_oak_score)}, pino ${fixed(profile.forest_pine_score)}. Robinia 0,00.`],
      ["◇", "Suolo", `pH teorico ${fixed(profile.soil_ph_hard_min, 1)}–${fixed(profile.soil_ph_hard_max, 1)}, preferito ${fixed(profile.soil_ph_preferred_min, 1)}–${fixed(profile.soil_ph_preferred_max, 1)}. Proxy: siliceo ${fixed(profile.soil_acidic_score)}, mesico ${fixed(profile.soil_mesic_score)}, carbonatico ${fixed(profile.soil_carbonatic_score)}, xerico ${fixed(profile.soil_xeric_score)}.`]
    ];
    $("#aiRules").innerHTML = rules.map(([icon, title, text]) => `
      <article class="rule-card"><div class="rule-icon">${icon}</div><div><h3>${title}</h3><p>${text}</p></div></article>
    `).join("");
  }

  function showPage(target) {
    const button = $(`.bottom-nav button[data-target="${target}"]`);
    if (button) button.click();
  }

  function updateConnectivity() {
    const badge = $("#offlineBadge");
    badge.textContent = navigator.onLine ? "locale · rete ok" : "offline pronto";
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 3300);
  }

  function loadJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
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

  function fixed(value, decimals = 2) {
    return Number(value).toFixed(decimals).replace(".", ",");
  }

  function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
  }
}());
