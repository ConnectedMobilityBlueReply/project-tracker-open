import type { BuInvestmentRow, BuPerson, BuWeek } from '../types';
import { formatDays, round2, weekAllocated, weekAvailable } from './buModel.ts';
import { RATIO_EPSILON } from './capacity.ts';

/**
 * Modello puro della dashboard planning BU (funzioni pure, testabili con `node --test`).
 * Capacità e allocazioni passano da `buModel.ts`, quindi la dashboard non può
 * contraddire la vista BU né la Schedule.
 */

export interface FreeWeek {
  week_start: string;
  free_days: number;
}

export interface FreeEntry {
  person: BuPerson;
  weeks: FreeWeek[];
  total_free_days: number;
}

export interface OverEntry {
  person: BuPerson;
  worst_week: string;
  excess_days: number;
}

export interface UncoveredEntry {
  person: BuPerson;
  allocated_until: string;
}

export interface InvestmentPerson {
  person_id: number;
  person_name: string;
  done_lifetime: number;
  todo_lifetime: number;
  done_period: number;
  todo_period: number;
  /** Fatti / (fatti + da fare) sulla vita dei progetti; null senza giorni. */
  progress: number | null;
  projects: BuInvestmentRow[];
}

export interface DashboardCounts {
  free: number;
  over: number;
  uncovered: number;
  investmentTodoDays: number;
}

type InvestmentDaysKey = 'done_days_lifetime' | 'todo_days_lifetime' | 'done_days_period' | 'todo_days_period';

/** Sotto la tolleranza il margine è rumore di calcolo, non giorni liberi. */
function freeDaysOf(person: BuPerson, week: BuWeek): number {
  const gap = weekAvailable(person, week.week_start) - weekAllocated(week);
  return gap > RATIO_EPSILON ? round2(gap) : 0;
}

/** Giorni allocati oltre la capacità, grezzi: la soglia si applica prima dell'arrotondamento. Senza capacità tutto il lavoro è eccedenza. */
function excessDaysOf(person: BuPerson, week: BuWeek): number {
  const excess = weekAllocated(week) - weekAvailable(person, week.week_start);
  return excess > RATIO_EPSILON ? excess : 0;
}

function sumOf(values: readonly number[]): number {
  return round2(values.reduce((total, value) => total + value, 0));
}

function sumDays(rows: readonly BuInvestmentRow[], key: InvestmentDaysKey): number {
  return sumOf(rows.map(row => row[key]));
}

/** Persone con almeno un giorno libero nelle settimane dell'orizzonte, dalla più libera. */
export function freeEntries(people: readonly BuPerson[]): FreeEntry[] {
  return people
    .map(person => {
      const weeks = person.weeks.map(week => ({ week_start: week.week_start, free_days: freeDaysOf(person, week) }));
      return { person, weeks, total_free_days: sumOf(weeks.map(week => week.free_days)) };
    })
    .filter(entry => entry.total_free_days > 0)
    .sort((a, b) => b.total_free_days - a.total_free_days || a.person.name.localeCompare(b.person.name, 'it'));
}

/** Persone sovrallocate in almeno una settimana, con la settimana peggiore. */
export function overallocatedEntries(people: readonly BuPerson[]): OverEntry[] {
  return people
    .flatMap(person => {
      const worst = person.weeks.reduce(
        (best, week) => {
          const excess = excessDaysOf(person, week);
          return excess > best.excess_days ? { week_start: week.week_start, excess_days: excess } : best;
        },
        { week_start: '', excess_days: 0 },
      );
      return worst.excess_days > 0
        ? [{ person, worst_week: worst.week_start, excess_days: round2(worst.excess_days) }]
        : [];
    })
    .sort((a, b) => b.excess_days - a.excess_days || a.person.name.localeCompare(b.person.name, 'it'));
}

/**
 * Persone che lavorano nella settimana corrente (prima settimana dell'orizzonte) e la cui
 * ultima allocazione (`MAX(week_start)`) cade prima dell'ultima settimana.
 */
export function uncoveredEntries(people: readonly BuPerson[]): UncoveredEntry[] {
  return people
    .flatMap(person => {
      const first = person.weeks[0];
      const last = person.weeks[person.weeks.length - 1];
      const allocatedUntil = person.allocated_until;
      if (!first || !last || allocatedUntil == null) return [];
      const workingNow = weekAllocated(first) > RATIO_EPSILON;
      return workingNow && allocatedUntil < last.week_start ? [{ person, allocated_until: allocatedUntil }] : [];
    })
    .sort((a, b) => a.allocated_until.localeCompare(b.allocated_until) || a.person.name.localeCompare(b.person.name, 'it'));
}

/** Righe per progetto raggruppate per persona, ordinate per nome. */
export function investmentByPerson(rows: readonly BuInvestmentRow[]): InvestmentPerson[] {
  const byPerson = new Map<number, BuInvestmentRow[]>();
  for (const row of rows) {
    byPerson.set(row.person_id, [...(byPerson.get(row.person_id) ?? []), row]);
  }
  return [...byPerson.values()]
    .map(projects => {
      const done = sumDays(projects, 'done_days_lifetime');
      const todo = sumDays(projects, 'todo_days_lifetime');
      return {
        person_id: projects[0].person_id,
        person_name: projects[0].person_name,
        done_lifetime: done,
        todo_lifetime: todo,
        done_period: sumDays(projects, 'done_days_period'),
        todo_period: sumDays(projects, 'todo_days_period'),
        progress: done + todo === 0 ? null : done / (done + todo),
        projects,
      };
    })
    .sort((a, b) => a.person_name.localeCompare(b.person_name, 'it'));
}

export function dashboardCounts(
  free: readonly FreeEntry[],
  over: readonly OverEntry[],
  uncovered: readonly UncoveredEntry[],
  investment: readonly BuInvestmentRow[],
): DashboardCounts {
  return {
    free: free.length,
    over: over.length,
    uncovered: uncovered.length,
    investmentTodoDays: sumDays(investment, 'todo_days_lifetime'),
  };
}

/** Eccesso per la lista Sovrallocati: sotto la prima cifra decimale resta "<0,01 gg", non "+0 gg". */
export function formatExcessDays(days: number): string {
  const rounded = round2(days);
  return rounded === 0 ? '<0,01 gg' : `+${formatDays(rounded)} gg`;
}

/** Periodo di default: dal 1 gennaio al 31 dicembre dell'anno di `date`, ora locale. */
export function yearPeriod(date: Date): { from: string; to: string } {
  const year = date.getFullYear();
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Limite di periodo accettato per Investimento ed Efficienza, estremi inclusi (come il backend). */
export const MAX_PERIOD_DAYS = 366;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
/** Stessi limiti di `BuPeriod` nel backend: anni fuori range sono "Data non valida.". */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/** Giorno ISO come istante UTC, o null se non è una data di calendario esistente nel range supportato. */
function utcDayOf(iso: string): number | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : null;
}

/** Messaggio italiano se il periodo non è utilizzabile, altrimenti null. Conteggio in UTC: nessuno scarto di fuso. */
export function validatePeriod(from: string, to: string): string | null {
  if (!from || !to) return 'Seleziona entrambe le date.';
  const start = utcDayOf(from);
  const end = utcDayOf(to);
  if (start == null || end == null) return 'Data non valida.';
  if (start > end) return 'La data di inizio deve precedere la data di fine.';
  const days = (end - start) / DAY_MS + 1;
  return days > MAX_PERIOD_DAYS ? `Il periodo non può superare ${MAX_PERIOD_DAYS} giorni.` : null;
}
