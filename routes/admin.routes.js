const express = require("express");
const db = require("../db/database");
const auth = require("../middleware/auth.middleware");
const { notifyStatusChanged } = require("../services/mail.service");

const router = express.Router();

const ALLOWED_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

/**
 * GET /api/admin/bookings
 * Optional: ?status=pending|confirmed|completed|cancelled
 */
router.get("/bookings", auth, (req, res) => {
  try {
    const { status } = req.query;

    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }
      const bookings = db.prepare(`
        SELECT *
        FROM bookings
        WHERE status = ?
        ORDER BY created_at DESC
      `).all(status);

      return res.json(bookings);
    }

    const bookings = db.prepare(`
      SELECT *
      FROM bookings
      ORDER BY created_at DESC
    `).all();

    return res.json(bookings);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * PATCH /api/admin/bookings/:id/status
 * Body: { "status": "pending|confirmed|completed|cancelled" }
 */
router.patch("/bookings/:id/status", auth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    const existing = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
    if (!existing) {
      return res.status(404).json({ error: "Réservation introuvable" });
    }

    const oldStatus = existing.status || "pending";

    db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, id);

    const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);

    // Email notifications (non-blocking)
    notifyStatusChanged(updated, oldStatus, status).catch((err) => {
      console.error("Email error (status changed):", err.message);
    });

    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
