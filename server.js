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
const adminRoutes = require("./routes/admin.routes");

// ✅ Stripe routes
const paymentRoutes = require("./routes/payments.routes");

const app = express();

app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(compression());
app.use(morgan("dev"));

// ✅ IMPORTANT : Stripe webhook doit recevoir le RAW body
// Donc on monte /api/payments AVANT express.json()
app.use("/api/payments", paymentRoutes);

// JSON parser pour le reste des routes
app.use(express.json({ limit: "1mb" }));

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
      pickup_datetime TEXT,
      status TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      notes TEXT,

      -- ✅ Stripe acompte
      deposit_amount REAL,
      deposit_paid INTEGER,
      payment_status TEXT,
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT
    )
  `).run();

  // Migrations "safe" (si DB existante)
  try { db.prepare("ALTER TABLE bookings ADD COLUMN pickup_datetime TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_name TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_phone TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN customer_email TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN notes TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN status TEXT").run(); } catch (e) {}

  // ✅ Stripe columns
  try { db.prepare("ALTER TABLE bookings ADD COLUMN deposit_amount REAL").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN deposit_paid INTEGER").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN payment_status TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN stripe_session_id TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE bookings ADD COLUMN stripe_payment_intent_id TEXT").run(); } catch (e) {}

  // Backfill status for existing rows
  try { db.prepare("UPDATE bookings SET status = 'pending' WHERE status IS NULL").run(); } catch (e) {}

  // Backfill paiement acompte (si besoin)
  try { db.prepare("UPDATE bookings SET deposit_amount = 10 WHERE deposit_amount IS NULL").run(); } catch (e) {}
  try { db.prepare("UPDATE bookings SET deposit_paid = 0 WHERE deposit_paid IS NULL").run(); } catch (e) {}
  try { db.prepare("UPDATE bookings SET payment_status = 'deposit_pending' WHERE payment_status IS NULL").run(); } catch (e) {}
}

initDb();

app.get("/", (req, res) => {
  res.json({ status: "DriveUs backend running 🚗" });
});

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/bookings/public", publicBookingRoutes);
app.use("/api/estimate", estimateRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
