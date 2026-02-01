require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const db = require("./db/database");
const authRoutes = require("./routes/auth.routes");
const bookingRoutes = require("./routes/booking.routes");
const estimateRoutes = require("./routes/estimate.routes");
const publicBookingRoutes = require("./routes/publicBooking.routes");

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

  // Migrations "safe" si DB existante
  try { db.prepare("ALTER TABLE bookings ADD COLUMN pickup_datetime TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_name TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_phone TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_email TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN notes TEXT").run(); } catch (e) {}
}

initDb();

app.get("/", (req, res) => {
  res.json({ status: "DriveUs backend running 🚗" });
});

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes); // routes protégées (avec token)
app.use("/api/bookings/public", publicBookingRoutes); // ✅ réservation publique (sans login)
app.use("/api/estimate", estimateRoutes); // ✅ estimation publique (sans login)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
