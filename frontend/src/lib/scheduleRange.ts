import { addDaysIso } from './capacity.ts';
import { mondayOfIso } from './scheduleModel.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

const withoutYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const withYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Periodo leggibile ("12 ott – 22 nov"); `toExclusive` è l'estremo escluso, mostrato come ultimo giorno incluso. */
export function formatRange(from: string, toExclusive: string): string {
  const last = addDaysIso(toExclusive, -1);
  const sameYear = from.slice(0, 4) === last.slice(0, 4);
  const format = sameYear ? withoutYear : withYear;
  return `${format.format(new Date(from))} – ${format.format(new Date(last))}`;
}

/** "Oggi": stessa ampiezza del periodo, ripartendo dal lunedì della settimana corrente. */
export function rangeFromToday(from: string, to: string, today: string): { from: string; to: string } {
  const spanDays = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
  const start = mondayOfIso(today);
  return { from: start, to: addDaysIso(start, spanDays) };
}
