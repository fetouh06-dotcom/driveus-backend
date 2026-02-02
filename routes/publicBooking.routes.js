const express = require("express");
const { v4: uuid } = require("uuid");

const db = require("../db/database");
const { calculatePrice } = require("../services/price.service");
const { geocodeOne, getDrivingDistanceKm } = require("../services/ors.service");
const { notifyBookingCreated } = require("../services/mail.service");

const router = express.Router();

/**
 * Public booking endpoint (no login required)
 * POST /api/bookings/public
 */
router.post("/", async (req, res) => {
  try {
    const {
      pickup_text,
      dropoff_text,
      pickup_datetime,
      customer_name,
      customer_phone,
      customer_email,
      notes
    } = req.body || {};

    if (!pickup_text || !dropoff_text) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    const when = pickup_datetime || new Date().toISOString();

    const p = await geocodeOne(pickup_text);
    const d = await geocodeOne(dropoff_text);

    const distKm = await getDrivingDistanceKm(p.coordinates, d.coordinates);
    const price = calculatePrice(distKm, when);

    const id = uuid();
    const createdAt = new Date().toISOString();

    // Safe schema updates for existing DBs
    try { db.prepare("ALTER TABLE bookings ADD COLUMN pickup_datetime TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_name TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_phone TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_email TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE bookings ADD COLUMN notes TEXT").run(); } catch (e) {}
    try { db.prepare("ALTER TABLE bookings ADD COLUMN status TEXT").run(); } catch (e) {}

    const status = "pending";

    db.prepare(`
      INSERT INTO bookings
        (id, user_id, pickup, dropoff, distance, price, created_at, pickup_datetime, customer_name, customer_phone, customer_email, notes, status)
      VALUES
        (?,  NULL,   ?,      ?,       ?,       ?,     ?,         ?,              ?,             ?,             ?,             ?,     ?)
    `).run(
      id,
      p.label,
      d.label,
      distKm,
      price,
      createdAt,
      when,
      customer_name || null,
      customer_phone || null,
      customer_email || null,
      notes || null,
      status
    );

    const booking = {
      id,
      user_id: null,
      pickup: p.label,
      dropoff: d.label,
      distance: distKm,
      price,
      created_at: createdAt,
      pickup_datetime: when,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      customer_email: customer_email || null,
      notes: notes || null,
      status
    };

    // Email notifications (non-blocking)
    notifyBookingCreated(booking).catch((err) => {
      console.error("Email error (booking created):", err.message);
    });

    return res.json({
      id,
      pickup: booking.pickup,
      dropoff: booking.dropoff,
      distance: +distKm.toFixed(3),
      price,
      pickup_datetime: when,
      created_at: createdAt,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      customer_email: booking.customer_email,
      notes: booking.notes,
      status
    });
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Erreur serveur" });
  }
});

module.exports = router;
