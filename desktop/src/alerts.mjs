export const MAX_ALERT_COUNT = 9999;

export function sanitizeAlertCount(value) {
  if (!Number.isInteger(value) || value < 0) return null;
  return Math.min(value, MAX_ALERT_COUNT);
}

// Al primo conteggio dopo l'avvio basta il badge: notificare a ogni apertura dell'app sarebbe rumore.
export function shouldNotify(previous, next) {
  return previous !== null && next > previous;
}
