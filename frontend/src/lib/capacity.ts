import type { SchedulePerson, TimeOffEntry } from '../types';
import { isHoliday } from './holidays.ts';

/**
 * Capacità e utilizzo, funzioni pure. Vivono qui e non nei componenti perché
 * il progetto testa con `node --test` senza jsdom: solo il codice senza React
 * è verificabile.
 *
 * Le date sono stringhe ISO `YYYY-MM-DD` e l'aritmetica passa per UTC, così
 * il cambio dell'ora legale non sposta un giorno.
 */

const WORKDAYS_PER_WEEK = 5;

/**
 * Tolleranza per i confronti di rapporto. I giorni-uomo arrivano in mezze e
 * quarti di giornata — 0.8, 0.6, 0.4 — che in binario non sono esatti: una
 * settimana piena può valere 3.0000000000000004 su 3. Senza tolleranza
 * finirebbe colorata come sovrallocata.
 * Vale anche per i confronti fra somme assolute di giorni-uomo: su un range
 * l'errore accumulato resta ordini di grandezza sotto questa soglia.
 */
export const RATIO_EPSILON = 1e-9;

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * I cinque giorni lun-ven a partire da `weekStart`.
 *
 * Precondizione: `weekStart` **è** un lunedì. È l'invariante di `week_start` nel
 * database, dove ogni settimana è identificata dal suo lunedì. Passare un altro
 * giorno non solleva: restituisce cinque giorni consecutivi a partire da quello,
 * e ogni numero di capacità a valle risulta sbagliato senza segnalarlo.
 */
export function weekdaysOf(weekStart: string): string[] {
  return Array.from({ length: WORKDAYS_PER_WEEK }, (_, index) => addDaysIso(weekStart, index));
}

/** La persona è assente in quella data? Gli estremi sono inclusi. */
export function isOff(personId: number, iso: string, timeOff: TimeOffEntry[]): boolean {
  return timeOff.some(entry =>
    entry.person_id === personId && entry.start_date <= iso && iso <= entry.end_date);
}

/**
 * Capacità reale della settimana: `weekly_capacity_days` scalato dai giorni
 * lavorativi effettivamente disponibili.
 *
 * Assunzione dichiarata: la riduzione è proporzionale. Un part-time a 3
 * giorni che prende un giorno di ferie scende a 2.4. È corretto se lavora
 * cinque mezze giornate, non se lavora tre giorni pieni — il dato per
 * distinguere i due casi non esiste in `persons`.
 */
export function availableDays(
  person: SchedulePerson,
  weekStart: string,
  timeOff: TimeOffEntry[],
): number {
  const workdays = weekdaysOf(weekStart);
  const lost = workdays.filter(day => isHoliday(day) || isOff(person.id, day, timeOff)).length;
  const ratio = (workdays.length - lost) / workdays.length;
  return Math.round(person.weekly_capacity_days * ratio * 100) / 100;
}

/**
 * `null` quando non c'è capacità: non è una divisione per zero da evitare,
 * è l'informazione che serve per distinguere assente-e-libero da
 * assente-ma-allocato.
 */
export function utilization(allocated: number, available: number): number | null {
  if (available === 0) return null;
  return allocated / available;
}

export type UtilizationLevel = 'free' | 'under' | 'full' | 'over' | 'conflict';

/** `conflict`: lavoro pianificato su chi non c'è. */
export function utilizationLevel(allocated: number, available: number): UtilizationLevel {
  if (available === 0) return allocated > 0 ? 'conflict' : 'free';
  if (allocated === 0) return 'free';
  const ratio = allocated / available;
  if (ratio > 1 + RATIO_EPSILON) return 'over';
  if (ratio > 1 - RATIO_EPSILON) return 'full';
  return 'under';
}
