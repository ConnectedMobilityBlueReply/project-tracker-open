/**
 * Festività nazionali italiane. Nessuna tabella in database: le patronali
 * variano per sede e le sedi non sono modellate in `persons`.
 *
 * Le date sono stringhe ISO `YYYY-MM-DD`, lo stesso formato con cui il
 * backend serializza `week_start`: nessuna conversione, nessun fuso orario.
 */

/** Giorni fissi, come `MM-DD`. */
const FIXED = [
  '01-01', // Capodanno
  '01-06', // Epifania
  '04-25', // Liberazione
  '05-01', // Festa del lavoro
  '06-02', // Repubblica
  '08-15', // Ferragosto
  '11-01', // Ognissanti
  '12-08', // Immacolata
  '12-25', // Natale
  '12-26', // Santo Stefano
];

/**
 * Domenica di Pasqua con l'algoritmo di Meeus/Jones/Butcher, valido per
 * tutto il calendario gregoriano.
 */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Lunedì dell'Angelo: Pasqua + 1 giorno. */
export function easterMonday(year: number): string {
  const { month, day } = easterSunday(year);
  const monday = new Date(Date.UTC(year, month - 1, day + 1));
  return monday.toISOString().slice(0, 10);
}

const cache = new Map<number, readonly string[]>();

/**
 * Le 11 festività dell'anno, ordinate.
 *
 * L'array è memoizzato e condiviso fra tutti i chiamanti, quindi è congelato:
 * mutarlo corromperebbe la cache per chiunque altro. `Object.freeze` rende il
 * tentativo un TypeError invece di un danno silenzioso.
 */
export function italianHolidays(year: number): readonly string[] {
  const cached = cache.get(year);
  if (cached) return cached;
  const dates = Object.freeze([...FIXED.map(md => `${year}-${md}`), easterMonday(year)].sort());
  cache.set(year, dates);
  return dates;
}

/** `iso` è una data `YYYY-MM-DD`. */
export function isHoliday(iso: string): boolean {
  const year = Number(iso.slice(0, 4));
  return italianHolidays(year).includes(iso);
}
