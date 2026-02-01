require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const db = require("./db/database");
const authRoutes = require("./routes/auth.routes");
const bookingRoutes = require("./routes/booking.routes");
const estimateRoutes = require("./routes/estimate.routes"); // ✅ ajout estimation

const app = express();

app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(compression());
app.use(morgan("dev"));

/**
 * Initialisation base de données
 */
function initDb() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      pickup TEXT,
      dropoff TEXT,
      distance REAL,
      price REAL,
      created_at TEXT,
      pickup_datetime TEXT
    )
  `).run();

  // Sécurité si ancienne DB sans pickup_datetime
  try {
    db.prepare("ALTER TABLE bookings ADD COLUMN pickup_datetime TEXT").run();
  } catch (e) {}
}

initDb();

app.get("/", (req, res) => {
  res.json({ status: "DriveUs backend running 🚗" });
});

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/estimate", estimateRoutes); // ✅ route publique estimation

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
