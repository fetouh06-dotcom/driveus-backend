const express = require("express");
const { calculatePrice } = require("../services/price.service");

const router = express.Router();

/**
 * Public estimation endpoint (no login required)
 * POST /api/estimate
 * Body:
 *  - pickup (string) [optional]
 *  - dropoff (string) [optional]
 *  - distance (number, km) REQUIRED
 *  - pickup_datetime (ISO string) optional (defaults to now)
 */
router.post("/", (req, res) => {
  const { pickup, dropoff, distance, pickup_datetime } = req.body || {};

  if (distance === undefined) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  const dist = Number(distance);
  if (!Number.isFinite(dist) || dist <= 0) {
    return res.status(400).json({ error: "Distance invalide" });
  }

  const when = pickup_datetime || new Date().toISOString();
  const price = calculatePrice(dist, when);

  return res.json({
    pickup: pickup || null,
    dropoff: dropoff || null,
    distance: dist,
    price,
    pickup_datetime: when
  });
});

module.exports = router;
