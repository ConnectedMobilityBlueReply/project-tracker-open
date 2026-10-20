/**
 * Ore lavorabili settimanali secondo il calendario civile italiano.
 *
 * Il database memorizza `man_days`; la Consuntivazione lavora in ore e converte
 * al confine UI con la convenzione storica del progetto: 8 ore = 1 giorno/uomo
 * (vedi la migrazione `UPDATE time_entries SET man_days = hours / 8` in schema.sql).
 */

// Unica definizione in units.ts: tre pagine convertono ore↔giorni e due
// costanti separate divergerebbero senza che nessun test se ne accorga.
import { HOURS_PER_DAY } from './units.ts';

export { HOURS_PER_DAY };
export const FULL_WEEK_HOURS = 40;

export interface Holiday {
  /** Data in formato ISO `yyyy-MM-dd`. */
  date: string;
  name: string;
}

/** Festività nazionali a data fissa: `MM-dd` → nome. */
const FIXED_HOLIDAYS: ReadonlyArray<readonly [string, string]> = [
  ['01-01', 'Capodanno'],
  ['01-06', 'Epifania'],
  ['04-25', 'Liberazione'],
  ['05-01', 'Festa del Lavoro'],
  ['06-02', 'Festa della Repubblica'],
  ['08-15', 'Ferragosto'],
  ['11-01', 'Ognissanti'],
  ['12-08', 'Immacolata'],
  ['12-25', 'Natale'],
  ['12-26', 'Santo Stefano'],
];

const pad = (value: number): string => String(value).padStart(2, '0');

const addDaysIso = (iso: string, days: number): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Domenica di Pasqua con l'algoritmo di Meeus/Jones/Butcher (calendario gregoriano). */
function easterSunday(year: number): string {
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
  return `${year}-${pad(month)}-${pad(day)}`;
}

const holidaysByYear = new Map<number, Holiday[]>();

/** Festività nazionali italiane dell'anno, ordinate per data. Esclude i patroni locali. */
export function italianHolidays(year: number): Holiday[] {
  const cached = holidaysByYear.get(year);
  if (cached) return cached;

  const holidays: Holiday[] = [
    ...FIXED_HOLIDAYS.map(([monthDay, name]) => ({ date: `${year}-${monthDay}`, name })),
    { date: addDaysIso(easterSunday(year), 1), name: 'Lunedì dell\'Angelo' },
  ].sort((a, b) => a.date.localeCompare(b.date));

  holidaysByYear.set(year, holidays);
  return holidays;
}

/**
 * Festività che cadono da lunedì a venerdì nella settimana indicata.
 * `weekStart` è il lunedì in formato ISO `yyyy-MM-dd`.
 */
export function weekHolidays(weekStart: string): Holiday[] {
  const found: Holiday[] = [];
  for (let offset = 0; offset < 5; offset++) {
    const date = addDaysIso(weekStart, offset);
    const match = italianHolidays(Number(date.slice(0, 4))).find(h => h.date === date);
    if (match) found.push(match);
  }
  return found;
}

/** Ore lavorabili della settimana: 40 meno 8 per ogni festivo infrasettimanale. */
export function weeklyCapacityHours(weekStart: string): number {
  return FULL_WEEK_HOURS - weekHolidays(weekStart).length * HOURS_PER_DAY;
}

export const daysToHours = (days: number): number =>
  Math.round(days * HOURS_PER_DAY * 100) / 100;

/** `man_days` è NUMERIC(10,3): 1 ora = 0.125 giorni è esatto, quindi 3 decimali bastano. */
export const hoursToDays = (hours: number): number =>
  Math.round((hours / HOURS_PER_DAY) * 1000) / 1000;

export function isWithinHoursLimit(value: unknown, capacityHours: number): boolean {
  if (typeof value === 'string' && value.trim() === '') return false;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= capacityHours;
}
