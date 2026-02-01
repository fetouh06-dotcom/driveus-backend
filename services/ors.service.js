const axios = require("axios");

const ORS_BASE = "https://api.openrouteservice.org";
const ORS_TZ = "Europe/Paris";

function requireApiKey() {
  const key = process.env.OPENROUTE_API_KEY;
  if (!key) {
    const err = new Error("OPENROUTE_API_KEY manquant");
    err.status = 500;
    throw err;
  }
  return key;
}

/**
 * Geocode an address/place string to [lon, lat] using ORS Pelias geocoder.
 * Returns { coordinates:[lon,lat], label:string }
 */
async function geocodeOne(text) {
  const apiKey = requireApiKey();

  const res = await axios.get(`${ORS_BASE}/geocode/search`, {
    params: {
      api_key: apiKey,
      text,
      // Optional: bias results toward France/Paris-ish. Uncomment if you want.
      // "focus.point.lat": 48.8566,
      // "focus.point.lon": 2.3522,
      size: 1
    },
    timeout: 15000
  });

  const feature = res.data?.features?.[0];
  if (!feature) {
    const err = new Error(`Adresse introuvable: ${text}`);
    err.status = 400;
    throw err;
  }
  const coords = feature.geometry?.coordinates; // [lon, lat]
  if (!Array.isArray(coords) || coords.length !== 2) {
    const err = new Error(`Geocoding invalide pour: ${text}`);
    err.status = 400;
    throw err;
  }
  return {
    coordinates: coords,
    label: feature.properties?.label || text
  };
}

/**
 * Get driving distance (km) using ORS directions endpoint.
 */
async function getDrivingDistanceKm(fromLonLat, toLonLat) {
  const apiKey = requireApiKey();

  const res = await axios.post(
    `${ORS_BASE}/v2/directions/driving-car`,
    { coordinates: [fromLonLat, toLonLat] },
    {
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      timeout: 20000
    }
  );

  const meters = res.data?.features?.[0]?.properties?.summary?.distance;
  if (typeof meters !== "number") {
    const err = new Error("Impossible de calculer la distance (ORS)");
    err.status = 502;
    throw err;
  }
  return meters / 1000;
}

module.exports = { geocodeOne, getDrivingDistanceKm, ORS_TZ };
