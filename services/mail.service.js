const axios = require("axios");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquant`);
  return v;
}

function getFromRaw() {
  // Ex: DriveUs <ecodrive06@gmail.com>
  return process.env.SMTP_FROM || "DriveUs <ecodrive06@gmail.com>";
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL || "ecodrive06@gmail.com";
}

function parseFrom(fromRaw) {
  // parse simple : "Name <email>"
  let name = "DriveUs";
  let email = "ecodrive06@gmail.com";

  const m = fromRaw.match(/^(.*)<([^>]+)>$/);
  if (m) {
    name = (m[1] || "").trim().replace(/^"|"$/g, "") || name;
    email = (m[2] || "").trim() || email;
  } else if (fromRaw.includes("@")) {
    email = fromRaw.trim();
  }
  return { name, email };
}

function formatBookingLines(b) {
  return [
    `ID: ${b.id}`,
    `Statut: ${b.status || "pending"}`,
    `Départ: ${b.pickup}`,
    `Arrivée: ${b.dropoff}`,
    `Distance: ${Number(b.distance).toFixed(3)} km`,
    `Prix: ${Number(b.price).toFixed(2)} €`,
    `Date/heure: ${b.pickup_datetime}`,
    `Créée le: ${b.created_at}`,
    b.customer_name ? `Client: ${b.customer_name}` : null,
    b.customer_phone ? `Téléphone: ${b.customer_phone}` : null,
    b.customer_email ? `Email: ${b.customer_email}` : null,
    b.notes ? `Notes: ${b.notes}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Envoi email via Brevo API (HTTPS)
 * Nécessite: BREVO_API_KEY dans Render
 */
async function sendBrevoEmail({ to, subject, text }) {
  const apiKey = requireEnv("BREVO_API_KEY");

  const fromRaw = getFromRaw();
  const sender = parseFrom(fromRaw);

  const payload = {
    sender,
    to: [{ email: to }],
    subject,
    textContent: text
  };

  await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json"
    },
    timeout: 20000
  });
}

async function notifyBookingCreated(booking) {
  const admin = getAdminEmail();

  // 1) Email admin
  const subjectAdmin = `🚗 Nouvelle réservation (pending) - ${booking.pickup} → ${booking.dropoff}`;
  const textAdmin =
    `Nouvelle réservation créée (sans compte).\n\n` +
    `${formatBookingLines(booking)}\n`;

  await sendBrevoEmail({ to: admin, subject: subjectAdmin, text: textAdmin });

  // 2) Email client (si email fourni)
  if (booking.customer_email) {
    const subjectCustomer = `Votre demande DriveUs est reçue ✅`;
    const textCustomer =
      `Bonjour${booking.customer_name ? " " + booking.customer_name : ""},\n\n` +
      `Nous avons bien reçu votre demande de réservation.\n` +
      `Statut actuel : pending (en attente de confirmation).\n\n` +
      `${formatBookingLines(booking)}\n\n` +
      `Vous recevrez un email dès que la course sera confirmée.\n\n` +
      `DriveUs`;

    await sendBrevoEmail({
      to: booking.customer_email,
      subject: subjectCustomer,
      text: textCustomer
    });
  }
}

async function notifyStatusChanged(booking, oldStatus, newStatus) {
  const admin = getAdminEmail();

  // 1) Email admin
  const subjectAdmin = `📌 Statut modifié: ${oldStatus} → ${newStatus} (${booking.id})`;
  const textAdmin =
    `Statut modifié par l'admin.\n\n` +
    `Ancien: ${oldStatus}\n` +
    `Nouveau: ${newStatus}\n\n` +
    `${formatBookingLines(booking)}\n`;

  await sendBrevoEmail({ to: admin, subject: subjectAdmin, text: textAdmin });

  // 2) Email client
  if (booking.customer_email) {
    const subjectCustomer = `Mise à jour de votre réservation DriveUs: ${newStatus}`;
    const textCustomer =
      `Bonjour${booking.customer_name ? " " + booking.customer_name : ""},\n\n` +
      `Le statut de votre réservation a été mis à jour : ${oldStatus} → ${newStatus}.\n\n` +
      `${formatBookingLines(booking)}\n\n` +
      `DriveUs`;

    await sendBrevoEmail({
      to: booking.customer_email,
      subject: subjectCustomer,
      text: textCustomer
    });
  }
}

module.exports = {
  notifyBookingCreated,
  notifyStatusChanged
};
