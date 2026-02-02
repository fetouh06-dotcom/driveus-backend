const nodemailer = require("nodemailer");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquant`);
  return v;
}

function buildTransporter() {
  const host = requireEnv("SMTP_HOST");
  const port = Number(requireEnv("SMTP_PORT"));
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  // Port 465 => SSL direct
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },

    // ✅ évite les "Connection timeout" sur Render / cloud
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000
  });
}

function getFrom() {
  // Exemple: "DriveUs <no-reply@driveus.fr>"
  return process.env.SMTP_FROM || process.env.SMTP_USER;
}

function getAdminEmail() {
  // ✅ Ton email par défaut
  return process.env.ADMIN_EMAIL || "ecodrive06@gmail.com";
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

async function sendMail({ to, subject, text }) {
  const transporter = buildTransporter();
  const from = getFrom();

  await transporter.sendMail({
    from,
    to,
    subject,
    text
  });
}

async function notifyBookingCreated(booking) {
  const admin = getAdminEmail();

  // 1) Email admin
  const subjectAdmin = `🚗 Nouvelle réservation (pending) - ${booking.pickup} → ${booking.dropoff}`;
  const textAdmin =
    `Nouvelle réservation créée (sans compte).\n\n` +
    `${formatBookingLines(booking)}\n`;

  await sendMail({ to: admin, subject: subjectAdmin, text: textAdmin });

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

    await sendMail({
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

  await sendMail({ to: admin, subject: subjectAdmin, text: textAdmin });

  // 2) Email client (si email fourni)
  if (booking.customer_email) {
    const subjectCustomer = `Mise à jour de votre réservation DriveUs: ${newStatus}`;
    const textCustomer =
      `Bonjour${booking.customer_name ? " " + booking.customer_name : ""},\n\n` +
      `Le statut de votre réservation a été mis à jour : ${oldStatus} → ${newStatus}.\n\n` +
      `${formatBookingLines(booking)}\n\n` +
      `DriveUs`;

    await sendMail({
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
