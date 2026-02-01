const express = require("express");
const { calculatePrice } = require("../services/price.service");
const { geocodeOne, getDrivingDistanceKm } = require("../services/ors.service");

const router = express.Router();

/**
 * Public estimation endpoint (no login required)
 * POST /api/estimate
 *
 * Option A (recommended): provide pickup_text + dropoff_text, backend computes distance via ORS.
 *   Body:
 *     - pickup_text (string) REQUIRED
 *     - dropoff_text (string) REQUIRED
 *     - pickup_datetime (ISO string) optional (defaults to now)
 *
 * Option B (fallback): provide distance directly (km)
 *   Body:
 *     - distance (number, km) REQUIRED
 *     - pickup_datetime (ISO string) optional
 */
router.post("/", async (req, res) => {
  try {
    const { pickup_text, dropoff_text, distance, pickup_datetime } = req.body || {};
    const when = pickup_datetime || new Date().toISOString();

    let distKm = null;
    let pickup = null;
    let dropoff = null;

    if (pickup_text && dropoff_text) {
      const p = await geocodeOne(pickup_text);
      const d = await geocodeOne(dropoff_text);
      pickup = p.label;
      dropoff = d.label;
      distKm = await getDrivingDistanceKm(p.coordinates, d.coordinates);
    } else {
      // fallback mode
      if (distance === undefined) return res.status(400).json({ error: "Champs manquants" });
      const dist = Number(distance);
      if (!Number.isFinite(dist) || dist <= 0) return res.status(400).json({ error: "Distance invalide" });
      distKm = dist;
    }

    const price = calculatePrice(distKm, when);

    return res.json({
      pickup,
      dropoff,
      distance: +distKm.toFixed(3),
      price,
      pickup_datetime: when
    });
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Erreur serveur" });
  }
});

module.exports = router;
