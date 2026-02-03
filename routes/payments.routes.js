const express = require("express");
const Stripe = require("stripe");
const db = require("../db/database");

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20"
});

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquant`);
  return v;
}

// Test route
router.get("/", (req, res) => {
  res.json({ ok: true, service: "payments" });
});

/**
 * POST /api/payments/deposit-session
 */
router.post("/deposit-session", async (req, res) => {
  try {
    const { booking_id } = req.body || {};
    if (!booking_id) return res.status(400).json({ error: "booking_id manquant" });

    const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(booking_id);
    if (!booking) return res.status(404).json({ error: "Réservation introuvable" });

    const FRONTEND_URL = requireEnv("FRONTEND_URL");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: booking.customer_email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: 1000,
            product_data: {
              name: "Acompte réservation DriveUs (10€)",
              description: `Réservation ${booking.pickup} → ${booking.dropoff}`
            }
          }
        }
      ],
      metadata: { booking_id },
      success_url: `${FRONTEND_URL}/paiement/succes?booking_id=${booking_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/paiement/annule?booking_id=${booking_id}`
    });

    db.prepare(`
      UPDATE bookings
      SET stripe_session_id = ?, payment_status = 'deposit_pending'
      WHERE id = ?
    `).run(session.id, booking_id);

    return res.json({ url: session.url });
  } catch (e) {
    console.error("Stripe deposit-session error:", e.message);
    return res.status(500).json({ error: "Erreur paiement (Stripe)" });
  }
});

/**
 * POST /api/payments/webhook
 */
router.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;

  try {
    const sig = req.headers["stripe-signature"];
    const whsec = requireEnv("STRIPE_WEBHOOK_SECRET");
    event = stripe.webhooks.constructEvent(req.body, sig, whsec);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.booking_id;

    if (bookingId) {
      db.prepare(`
        UPDATE bookings
        SET deposit_paid = 1,
            payment_status = 'deposit_paid',
            status = 'confirmed',
            stripe_payment_intent_id = ?
        WHERE id = ?
      `).run(session.payment_intent || null, bookingId);
    }
  }

  return res.json({ received: true });
});

module.exports = router;
