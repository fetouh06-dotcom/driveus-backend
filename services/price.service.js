/**
 * Tarifs DriveUs (Europe/Paris)
 * - 3€/km
 * - minimum 25€
 * - majoration +20% la nuit (20h -> 7h) OU le dimanche (toute la journée)
 */
const PARIS_TZ = "Europe/Paris";

function getParisParts(date) {
  const dtf = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23"
  });

  const parts = dtf.formatToParts(date);
  const weekday = (parts.find(p => p.type === "weekday")?.value || "").toLowerCase();
  const hourStr = parts.find(p => p.type === "hour")?.value;
  const hour = Number(hourStr);
  return { weekday, hour };
}

function isNightInParis(date) {
  const { hour } = getParisParts(date);
  return hour >= 20 || hour < 7;
}

function isSundayInParis(date) {
  const { weekday } = getParisParts(date);
  return weekday === "dimanche";
}

exports.calculatePrice = (km, pickupDateISO) => {
  const MIN = 25;
  const PER_KM = 3;

  const distance = Number(km);
  if (!Number.isFinite(distance) || distance <= 0) return MIN;

  const date = pickupDateISO ? new Date(pickupDateISO) : new Date();
  if (Number.isNaN(date.getTime())) {
    return Math.max(MIN, +(distance * PER_KM).toFixed(2));
  }

  const base = distance * PER_KM;
  const surchargeFactor = (isSundayInParis(date) || isNightInParis(date)) ? 1.2 : 1.0;

  const price = base * surchargeFactor;
  return Math.max(MIN, +price.toFixed(2));
};
