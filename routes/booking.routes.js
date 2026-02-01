const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("../db/database");
const auth = require("../middleware/auth.middleware");
const { calculatePrice } = require("../services/price.service");

const router = express.Router();

router.post("/", auth, (req, res) => {
  const { pickup, dropoff, distance, pickup_datetime } = req.body || {};

  if (!pickup || !dropoff || distance === undefined) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  const dist = Number(distance);
  if (!Number.isFinite(dist) || dist <= 0) {
    return res.status(400).json({ error: "Distance invalide" });
  }

  const when = pickup_datetime || new Date().toISOString();
  const price = calculatePrice(dist, when);

  const id = uuid();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO bookings (id, user_id, pickup, dropoff, distance, price, created_at, pickup_datetime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, pickup, dropoff, dist, price, createdAt, when);

  return res.json({
    id,
    pickup,
    dropoff,
    distance: dist,
    price,
    created_at: createdAt,
    pickup_datetime: when
  });
});

module.exports = router;
