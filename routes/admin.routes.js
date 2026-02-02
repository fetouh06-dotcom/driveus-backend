const express = require("express");
const db = require("../db/database");
const auth = require("../middleware/auth.middleware");

const router = express.Router();

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

module.exports = router;
