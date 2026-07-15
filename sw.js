const APP_CACHE = "fungi-ai-app-v6";
const RUNTIME_CACHE = "fungi-ai-runtime-v2";
const MAX_RUNTIME_ENTRIES = 350;
const APP_FILES = [
  "./", "./index.html", "./styles.css", "./gate.js", "./app_v2.js", "./model.js",
  "./manifest.webmanifest", "./vendor/leaflet/leaflet.css", "./vendor/leaflet/leaflet.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./data/manifest.js", "./data/manifest.json", "./data/allowed_land.png", "./data/elevation_encoded.png",
  "./data/forest_type_encoded.png", "./data/soil_class_encoded.png", "./data/habitat_ai.png",
  "./data/habitats/habitat_ai_mode.png", "./data/habitats/habitat_aperto.png",
  "./data/habitats/habitat_base.png", "./data/habitats/habitat_conservativo.png",
  "./data/habitats/habitat_medio.png", "./data/habitats/habitat_mio.png",
  "./data/maps/layer_elevation.png", "./data/maps/layer_forest_type.png", "./data/maps/layer_land_cover.png",
  "./data/maps/layer_porcini_today_dynamic_elevation.png", "./data/maps/layer_porcini_today_dynamic_habitat.png",
  "./data/maps/layer_porcini_today_dynamic_score.png", "./data/maps/layer_porcini_today_weather_score.png",
  "./data/maps/layer_porcini_today_wind_penalty.png", "./data/maps/layer_slope.png",
  "./data/maps/layer_static_habitat.png", "./data/maps/porcini_probability_today.png",
  "./data/maps/porcini_probability_tomorrow.png", "./data/maps/porcini_probability_day_after_tomorrow.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => ![APP_CACHE, RUNTIME_CACHE].includes(key))
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/fungi/")) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(APP_CACHE).then(cache => cache.put(request, copy));
      return response;
    })).catch(() => request.mode === "navigate" ? caches.match("./index.html") : Response.error()));
    return;
  }
  if (url.protocol === "https:") {
    event.respondWith(caches.open(RUNTIME_CACHE).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response.ok || response.type === "opaque") {
          cache.put(request, response.clone()).then(async () => {
            const keys = await cache.keys();
            const excess = keys.length - MAX_RUNTIME_ENTRIES;
            if (excess > 0) await Promise.all(keys.slice(0, excess).map(key => cache.delete(key)));
          });
        }
        return response;
      });
      return cached || network;
    }));
  }
});
