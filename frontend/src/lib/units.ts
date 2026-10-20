export const HOURS_PER_DAY = 8;

// Quattro decimali, non tre: la granularita' minima inseribile in timeline e'
// la mezz'ora, che vale 0.0625 giornate. Con tre decimali diventava 0.063 e
// risaliva come 0.504h. Dividere per 8 e' esatto in binario, quindi qui non
// c'e' sporcizia da arrotondare: il round serve solo a tagliare la coda che
// nasce quando il chiamante passa un decimale gia' impreciso.
export function hoursToDays(hours: number): number {
  return Math.round((hours / HOURS_PER_DAY) * 10000) / 10000;
}

export function daysToHours(days: number): number {
  return days * HOURS_PER_DAY;
}

export function formatDays(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** Ore -> "1,5 gg/u" (giorni/uomo, virgola italiana). */
export function formatGgU(hours: number): string {
  return `${formatDays(hoursToDays(hours)).replace('.', ',')} gg/u`;
}
