import type { TmMonthStatus, TmProject } from '../types';
import type { CsvValue } from './csv';

/** Modello della pagina Time & Material: funzioni pure, testate con `node --test`. */

export const TM_STATUS_LABEL: Record<TmMonthStatus, string> = {
  aperto: 'Aperto',
  fatturato: 'Fatturato',
  rettifica: 'Rettifica',
};

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shift(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  return monthKey(new Date(year, mon - 1 + delta, 1));
}

/** Ultimi `count` mesi, corrente incluso. */
export function defaultPeriod(today: Date, count = 6): { from: string; to: string } {
  const to = monthKey(today);
  return { from: shift(to, -(count - 1)), to };
}

export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = shift(month, 1)) months.push(month);
  return months;
}

/** Stessa regola del backend: solo mesi già conclusi. 'YYYY-MM' si confronta come stringa. */
export function canCloseMonth(month: string, today: Date): boolean {
  return month < monthKey(today);
}

export function plafondPct(project: TmProject): number | null {
  if (project.plafond_days <= 0) return null;
  return Math.round((project.consumed_days / project.plafond_days) * 100);
}

const NUMBER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 3 });

export function formatDays(value: number): string {
  return `${NUMBER.format(value)} gg`;
}

export function formatDelta(value: number): string {
  if (value === 0) return formatDays(0);
  return `${value > 0 ? '+' : '−'}${formatDays(Math.abs(value))}`;
}

export const DIRECT_WORK_LABEL = 'Lavoro diretto';

/** Il breakdown contiene sempre il padre: ci sono sotto progetti se ha altre voci. */
export function hasSubprojects(project: TmProject): boolean {
  return project.breakdown.length > 1;
}

export function breakdownLabel(index: number, name: string): string {
  return index === 0 ? DIRECT_WORK_LABEL : name;
}

/**
 * Una riga per progetto e mese; con sotto progetti, a seguire una riga per voce con giornate > 0.
 * Le righe di dettaglio non hanno importi: è fatturato (e congelato) solo il totale del padre.
 */
export function toExportRows(projects: readonly TmProject[]): Record<string, CsvValue>[] {
  return projects.flatMap(project => project.months.flatMap((month, i) => [
    {
      Progetto: project.name,
      'Sotto progetto': null,
      Mese: month.month,
      Stato: TM_STATUS_LABEL[month.status],
      'Giornate consuntivate': month.live_days,
      'Giornate fatturate': month.billed_days,
      'Delta giornate': month.delta_days,
      'Tariffa (€)': project.daily_rate,
      'Importo (€)': month.amount,
    },
    ...(hasSubprojects(project) ? project.breakdown : [])
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.live_days[i] > 0)
      .map(({ entry, index }) => ({
        Progetto: project.name,
        'Sotto progetto': breakdownLabel(index, entry.name),
        Mese: month.month,
        Stato: null,
        'Giornate consuntivate': entry.live_days[i],
        'Giornate fatturate': null,
        'Delta giornate': null,
        'Tariffa (€)': null,
        'Importo (€)': null,
      })),
  ]));
}
