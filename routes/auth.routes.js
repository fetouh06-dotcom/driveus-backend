const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const db = require("../db/database");

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Champs manquants" });

  const hash = await bcrypt.hash(password, 10);
  try {
    db.prepare("INSERT INTO users (id, email, password) VALUES (?, ?, ?)").run(uuid(), email, hash);
    return res.json({ success: true });
  } catch {
    return res.status(400).json({ error: "Email déjà utilisé" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Champs manquants" });

  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user) return res.status(401).json({ error: "Identifiants invalides" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Identifiants invalides" });

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
  return res.json({ token });
});

module.exports = router;
