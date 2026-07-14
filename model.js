(function () {
  "use strict";

  const DAY_KEYS = ["today", "tomorrow", "day_after_tomorrow"];
  const DAY_OFFSETS = [0, 1, 2];

  function buildWeatherRequest(manifest) {
    const bbox = manifest.area.bbox;
    const n = manifest.model.weather_points_per_axis;
    const latitudes = [];
    const longitudes = [];
    for (let row = 0; row < n; row += 1) {
      const lat = bbox.max_lat - (bbox.max_lat - bbox.min_lat) * row / (n - 1);
      for (let col = 0; col < n; col += 1) {
        const lon = bbox.min_lon + (bbox.max_lon - bbox.min_lon) * col / (n - 1);
        latitudes.push(lat.toFixed(5));
        longitudes.push(lon.toFixed(5));
      }
    }
    const daily = [
      "precipitation_sum",
      "temperature_2m_mean",
      "temperature_2m_max",
      "temperature_2m_min",
      "relative_humidity_2m_mean",
      "wind_gusts_10m_max"
    ].join(",");
    const query = new URLSearchParams({
      latitude: latitudes.join(","),
      longitude: longitudes.join(","),
      daily,
      timezone: "Europe/Rome",
      past_days: "92",
      forecast_days: "3",
      cell_selection: "land"
    });
    return "https://api.open-meteo.com/v1/forecast?" + query.toString();
  }

  function calculate(payloadValue, manifest, habitatPixels, elevationPixels, points, selectedProfile) {
    const payloads = Array.isArray(payloadValue) ? payloadValue : [payloadValue];
    const expected = manifest.model.weather_points_per_axis ** 2;
    if (payloads.length !== expected) {
      throw new Error("Il provider ha restituito " + payloads.length + " punti invece di " + expected);
    }
    const profile = selectedProfile || manifest.ai_profile;
    const targets = DAY_OFFSETS.map(offset => addDays(localTodayIso(), offset));
    const sampleDays = targets.map(target => payloads.map(payload => pointFeatures(payload.daily, target, profile)));
    const output = {};
    for (let dayIndex = 0; dayIndex < DAY_KEYS.length; dayIndex += 1) {
      const target = targets[dayIndex];
      const features = sampleDays[dayIndex];
      output[DAY_KEYS[dayIndex]] = renderDay(
        manifest,
        profile,
        features,
        target,
        habitatPixels,
        elevationPixels,
        points
      );
    }
    return { days: output, target_dates: Object.fromEntries(DAY_KEYS.map((key, i) => [key, targets[i]])) };
  }

  function pointFeatures(daily, targetDate, profile) {
    if (!daily || !Array.isArray(daily.time)) {
      throw new Error("Serie meteo giornaliera non valida");
    }
    const rain7 = rolling(daily, "precipitation_sum", targetDate, 7, "sum");
    const rain20 = rolling(daily, "precipitation_sum", targetDate, 20, "sum");
    const max7 = rolling(daily, "temperature_2m_max", targetDate, 7, "mean");
    const min7 = rolling(daily, "temperature_2m_min", targetDate, 7, "mean");
    const mean7 = rolling(daily, "temperature_2m_mean", targetDate, 7, "mean");
    const humidity7 = rolling(daily, "relative_humidity_2m_mean", targetDate, 7, "mean");
    const gust2 = rolling(daily, "wind_gusts_10m_max", targetDate, 2, "max");

    const rain7Score = preferredRange(rain7, profile.rain_7d_hard_min_mm, null,
      profile.rain_7d_preferred_min_mm, profile.rain_7d_preferred_max_mm);
    const rain20Score = preferredRange(rain20, profile.rain_20d_hard_min_mm, null,
      profile.rain_20d_preferred_min_mm, profile.rain_20d_preferred_max_mm);
    const thermal = thermalScore(max7, min7, profile);
    const humidity = minimumScore(humidity7, profile.humidity_hard_min_pct, profile.humidity_preferred_min_pct);
    const wind = windScore(gust2);
    const flush = seasonalFlush(daily, targetDate, profile);
    const base = averageFinite([rain7Score, rain20Score, thermal, humidity, wind]);
    const weather = clamp(base * Math.max(flush, profile.pre_trigger_multiplier), 0, 1);
    return { weather, temperature: Number.isFinite(mean7) ? mean7 : (max7 + min7) / 2, flush };
  }

  function renderDay(manifest, profile, sampleFeatures, targetDate, habitatPixels, elevationPixels, points) {
    const width = manifest.model.width;
    const height = manifest.model.height;
    const n = manifest.model.weather_points_per_axis;
    const total = width * height;
    if (habitatPixels.length !== total || elevationPixels.length !== total) {
      throw new Error("Dimensione raster mobile non valida");
    }
    const probability = new Uint8Array(total);
    const userBonus = userBonusGrid(points, targetDate, manifest);

    for (let y = 0; y < height; y += 1) {
      const gy = y / Math.max(height - 1, 1) * (n - 1);
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const habitat = habitatPixels[index] / 255;
        if (habitat <= 0 || elevationPixels[index] < 0) {
          probability[index] = 0;
          continue;
        }
        const gx = x / Math.max(width - 1, 1) * (n - 1);
        const weather = bilinear(sampleFeatures, "weather", gx, gy, n);
        const temperature = bilinear(sampleFeatures, "temperature", gx, gy, n);
        const elevationScore = dynamicElevationScore(elevationPixels[index], temperature, profile);
        const habitatEffect = Math.pow(clamp(habitat * elevationScore, 0, 1), profile.habitat_power);
        const score = clamp(weather + userBonus[index], 0, 1) * habitatEffect;
        probability[index] = Math.round(score * 100);
      }
    }
    return { probability, rgba: colorize(probability, width, height) };
  }

  function seasonalFlush(daily, targetDate, profile) {
    const year = Number(targetDate.slice(0, 4));
    const start = isoDate(year, profile.season_start_month, profile.season_start_day);
    const end = isoDate(year, profile.season_end_month, profile.season_end_day);
    if (targetDate < start || targetDate > end) return 0;

    const times = daily.time;
    let triggerDate = null;
    for (const candidate of times) {
      if (candidate < start || candidate > targetDate) continue;
      const rain1 = rolling(daily, "precipitation_sum", candidate, 1, "sum");
      const rain2 = rolling(daily, "precipitation_sum", candidate, 2, "sum");
      const thermal = thermalAt(daily, candidate, profile);
      if (rain1 >= profile.season_rain_24h_min_mm
          && rain2 >= profile.season_rain_48h_min_mm
          && thermal >= profile.season_thermal_score_min) {
        triggerDate = candidate;
        break;
      }
    }

    // A first install late in the season only receives 92 past days. A valid
    // restart event is therefore allowed to recover the current cycle.
    if (!triggerDate) {
      for (const candidate of times) {
        if (candidate < start || candidate > targetDate) continue;
        const rain1 = rolling(daily, "precipitation_sum", candidate, 1, "sum");
        const rain2 = rolling(daily, "precipitation_sum", candidate, 2, "sum");
        const thermal = thermalAt(daily, candidate, profile);
        if (rain1 >= profile.restart_rain_24h_min_mm
            && rain2 >= profile.restart_rain_48h_min_mm
            && thermal >= profile.restart_thermal_score_min) {
          triggerDate = candidate;
          break;
        }
      }
    }
    if (!triggerDate) return 0;

    const primaryDays = daysBetween(triggerDate, targetDate);
    const primary = triangular(primaryDays, profile.season_primary_start_days,
      profile.season_primary_peak_days, profile.season_primary_end_days);
    let restartDate = null;
    for (const candidate of times) {
      if (candidate <= triggerDate || candidate > targetDate) continue;
      const rain1 = rolling(daily, "precipitation_sum", candidate, 1, "sum");
      const rain2 = rolling(daily, "precipitation_sum", candidate, 2, "sum");
      const thermal = thermalAt(daily, candidate, profile);
      if (rain1 >= profile.restart_rain_24h_min_mm
          && rain2 >= profile.restart_rain_48h_min_mm
          && thermal >= profile.restart_thermal_score_min) {
        restartDate = candidate;
      }
    }
    const restart = restartDate
      ? triangular(daysBetween(restartDate, targetDate), profile.restart_start_days,
        profile.restart_peak_days, profile.restart_end_days)
      : 0;
    return Math.max(primary, restart);
  }

  function thermalAt(daily, targetDate, profile) {
    const max7 = rolling(daily, "temperature_2m_max", targetDate, 7, "mean");
    const min7 = rolling(daily, "temperature_2m_min", targetDate, 7, "mean");
    return thermalScore(max7, min7, profile);
  }

  function thermalScore(maxValue, minValue, profile) {
    return averageFinite([
      preferredRange(maxValue, profile.temp_max_hard_min_c, profile.temp_max_hard_max_c,
        profile.temp_max_preferred_min_c, profile.temp_max_preferred_max_c),
      preferredRange(minValue, profile.temp_min_hard_min_c, profile.temp_min_hard_max_c,
        profile.temp_min_preferred_min_c, profile.temp_min_preferred_max_c)
    ]);
  }

  function dynamicElevationScore(elevation, temperature, profile) {
    let shift = 0;
    if (temperature <= 9) shift = -350;
    else if (temperature <= 12) shift = -200;
    else if (temperature >= 21) shift = 350;
    else if (temperature >= 18) shift = 200;
    const baseMin = profile.elevation_hard_min_m;
    const baseMax = profile.elevation_hard_max_m;
    const hardMin = Math.max(baseMin, baseMin + shift);
    const hardMax = Math.min(baseMax, baseMax + shift);
    const preferredMin = clamp(profile.elevation_preferred_min_m + shift, baseMin, baseMax);
    const preferredMax = clamp(profile.elevation_preferred_max_m + shift, baseMin, baseMax);
    return preferredRange(elevation, hardMin, hardMax, preferredMin, preferredMax);
  }

  function userBonusGrid(points, targetDate, manifest) {
    const width = manifest.model.width;
    const height = manifest.model.height;
    const bbox = manifest.area.bbox;
    const bonus = new Float32Array(width * height);
    const metersLat = 111320;
    const midLat = (bbox.min_lat + bbox.max_lat) / 2;
    const metersLon = metersLat * Math.cos(midLat * Math.PI / 180);
    const radiusM = 700;
    const radiusX = radiusM / ((bbox.max_lon - bbox.min_lon) * metersLon) * width;
    const radiusY = radiusM / ((bbox.max_lat - bbox.min_lat) * metersLat) * height;
    for (const point of points || []) {
      const coordinates = point.geometry && point.geometry.coordinates;
      const properties = point.properties || {};
      if (!coordinates || coordinates.length < 2 || properties.species !== "porcini") continue;
      const px = (coordinates[0] - bbox.min_lon) / (bbox.max_lon - bbox.min_lon) * (width - 1);
      const py = (bbox.max_lat - coordinates[1]) / (bbox.max_lat - bbox.min_lat) * (height - 1);
      const ageDays = daysBetween(properties.observation_date, targetDate);
      if (ageDays < 0) continue;
      const type = properties.point_type || "both";
      const x0 = Math.max(0, Math.floor(px - radiusX));
      const x1 = Math.min(width - 1, Math.ceil(px + radiusX));
      const y0 = Math.max(0, Math.floor(py - radiusY));
      const y1 = Math.min(height - 1, Math.ceil(py + radiusY));
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const dx = (x - px) / Math.max(radiusX, 1);
          const dy = (y - py) / Math.max(radiusY, 1);
          const spatial = clamp(1 - Math.sqrt(dx * dx + dy * dy), 0, 1);
          let value = (type === "known_spot" || type === "both") ? spatial * 0.10 : 0;
          if ((type === "finding" || type === "both") && ageDays <= 30) {
            value += spatial * (1 - ageDays / 30) * 0.20;
          }
          const index = y * width + x;
          bonus[index] = Math.max(bonus[index], Math.min(value, 0.30));
        }
      }
    }
    return bonus;
  }

  function colorize(probability, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    const stops = [
      [0, 255, 255, 255],
      [25, 255, 241, 118],
      [50, 255, 183, 77],
      [75, 244, 81, 30],
      [100, 183, 28, 28]
    ];
    for (let index = 0; index < probability.length; index += 1) {
      const value = probability[index];
      const target = index * 4;
      if (value <= 0) {
        rgba[target + 3] = 0;
        continue;
      }
      let left = stops[0];
      let right = stops[1];
      for (let stop = 0; stop < stops.length - 1; stop += 1) {
        if (value >= stops[stop][0] && value <= stops[stop + 1][0]) {
          left = stops[stop];
          right = stops[stop + 1];
          break;
        }
      }
      const ratio = (value - left[0]) / Math.max(right[0] - left[0], 1);
      rgba[target] = Math.round(left[1] + (right[1] - left[1]) * ratio);
      rgba[target + 1] = Math.round(left[2] + (right[2] - left[2]) * ratio);
      rgba[target + 2] = Math.round(left[3] + (right[3] - left[3]) * ratio);
      rgba[target + 3] = value >= 75 ? 215 : 192;
    }
    return rgba;
  }

  function rolling(daily, variable, targetDate, days, operation) {
    const values = daily[variable];
    if (!Array.isArray(values)) return NaN;
    const start = addDays(targetDate, -(days - 1));
    const selected = [];
    for (let index = 0; index < daily.time.length; index += 1) {
      const day = daily.time[index];
      const value = Number(values[index]);
      if (day >= start && day <= targetDate && Number.isFinite(value)) selected.push(value);
    }
    if (!selected.length) return NaN;
    if (operation === "sum") return selected.reduce((a, b) => a + b, 0);
    if (operation === "max") return Math.max(...selected);
    return selected.reduce((a, b) => a + b, 0) / selected.length;
  }

  function preferredRange(value, hardMin, hardMax, preferredMin, preferredMax) {
    if (!Number.isFinite(value)) return NaN;
    if (hardMin != null && value < hardMin) return 0;
    if (hardMax != null && value > hardMax) return 0;
    if (preferredMin != null && value < preferredMin) {
      if (hardMin == null || preferredMin === hardMin) return 1;
      return clamp((value - hardMin) / (preferredMin - hardMin), 0, 1);
    }
    if (preferredMax != null && value > preferredMax) {
      if (hardMax == null || preferredMax === hardMax) return 1;
      return clamp((hardMax - value) / (hardMax - preferredMax), 0, 1);
    }
    return 1;
  }

  function minimumScore(value, hardMin, preferredMin) {
    if (!Number.isFinite(value)) return NaN;
    if (value < hardMin) return 0;
    if (value < preferredMin) return clamp((value - hardMin) / (preferredMin - hardMin), 0, 1);
    return 1;
  }

  function windScore(gusts) {
    if (!Number.isFinite(gusts)) return NaN;
    const penalty = clamp((gusts - 45) / 5, 0, 1);
    return clamp(1 - penalty * 0.45, 0.55, 1);
  }

  function bilinear(samples, key, gx, gy, n) {
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(n - 1, x0 + 1);
    const y1 = Math.min(n - 1, y0 + 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const q00 = Number(samples[y0 * n + x0][key]);
    const q10 = Number(samples[y0 * n + x1][key]);
    const q01 = Number(samples[y1 * n + x0][key]);
    const q11 = Number(samples[y1 * n + x1][key]);
    const valid = [q00, q10, q01, q11].filter(Number.isFinite);
    if (!valid.length) return 0;
    const fallback = valid.reduce((a, b) => a + b, 0) / valid.length;
    const a = (Number.isFinite(q00) ? q00 : fallback) * (1 - tx) + (Number.isFinite(q10) ? q10 : fallback) * tx;
    const b = (Number.isFinite(q01) ? q01 : fallback) * (1 - tx) + (Number.isFinite(q11) ? q11 : fallback) * tx;
    return a * (1 - ty) + b * ty;
  }

  function triangular(days, start, peak, end) {
    if (days < start || days > end) return 0;
    if (days === peak) return 1;
    if (days < peak) return (days - start) / Math.max(peak - start, 1);
    return (end - days) / Math.max(end - peak, 1);
  }

  function averageFinite(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return 0;
    return finite.reduce((a, b) => a + b, 0) / finite.length;
  }

  function isoDate(year, month, day) {
    return year.toString().padStart(4, "0") + "-" + Math.round(month).toString().padStart(2, "0")
      + "-" + Math.round(day).toString().padStart(2, "0");
  }

  function localTodayIso() {
    const now = new Date();
    return now.getFullYear().toString().padStart(4, "0") + "-"
      + (now.getMonth() + 1).toString().padStart(2, "0") + "-"
      + now.getDate().toString().padStart(2, "0");
  }

  function addDays(iso, days) {
    const date = new Date(iso + "T12:00:00");
    date.setDate(date.getDate() + days);
    return date.getFullYear().toString().padStart(4, "0") + "-"
      + (date.getMonth() + 1).toString().padStart(2, "0") + "-"
      + date.getDate().toString().padStart(2, "0");
  }

  function daysBetween(start, end) {
    const first = new Date(start + "T12:00:00");
    const second = new Date(end + "T12:00:00");
    return Math.round((second - first) / 86400000);
  }

  function clamp(value, low, high) {
    return Math.min(Math.max(value, low), high);
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  window.FungiModel = {
    DAY_KEYS,
    buildWeatherRequest,
    calculate,
    bytesToBase64,
    base64ToBytes,
    localTodayIso
  };
}());
