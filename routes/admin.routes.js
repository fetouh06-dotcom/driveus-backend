const express = require("express");
const db = require("../db/database");
const auth = require("../middleware/auth.middleware");

const router = express.Router();

const ALLOWED_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

/**
 * GET /api/admin/bookings
 * Protected by JWT
 */
router.get("/bookings", auth, (req, res) => {
  try {
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

    const row = db.prepare("SELECT id FROM bookings WHERE id = ?").get(id);
    if (!row) {
      return res.status(404).json({ error: "Réservation introuvable" });
    }

    db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, id);

    const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
