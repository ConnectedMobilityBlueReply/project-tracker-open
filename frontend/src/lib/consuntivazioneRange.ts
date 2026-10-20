import { addWeeks, eachWeekOfInterval, format, subWeeks } from 'date-fns';

/**
 * Intervallo di date e spostamento avanti/indietro per la griglia di
 * Consuntivazione. Funzioni pure, separate dalla pagina per poterle testare
 * con `node --test` — stesso motivo per cui `scheduleModel.ts` esiste accanto
 * a `Schedule.tsx`.
 */

/** I lunedì delle settimane comprese tra `from` e `to`, estremi inclusi. */
export function weeksInRange(from: string, to: string): string[] {
  return eachWeekOfInterval(
    { start: new Date(from), end: new Date(to) },
    { weekStartsOn: 1 },
  ).map(week => format(week, 'yyyy-MM-dd'));
}

/**
 * Sposta l'intervallo `[from, to]` di `weekCount` settimane, avanti o
 * indietro: la stessa ampiezza dell'intervallo corrente, cosi' le frecce
 * scorrono senza sovrapposizioni ne' buchi.
 */
export function shiftRange(
  from: string, to: string, weekCount: number, direction: -1 | 1,
): { from: string; to: string } {
  const shift = direction === 1 ? addWeeks : subWeeks;
  return {
    from: format(shift(new Date(from), weekCount), 'yyyy-MM-dd'),
    to: format(shift(new Date(to), weekCount), 'yyyy-MM-dd'),
  };
}
