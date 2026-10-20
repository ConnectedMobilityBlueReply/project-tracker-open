import type {
  ScheduleAllocation,
  ScheduleData,
  ScheduleOtherTeamLoad,
  SchedulePerson,
  TimeOffEntry,
  UnplannedAssignment,
} from '../types';
import { addDaysIso, availableDays, utilization, RATIO_EPSILON } from './capacity.ts';

/**
 * Colonne, filtri, ordinamento e raggruppamento della griglia. Funzioni pure,
 * separate dai componenti per poterle testare con `node --test`.
 */

/**
 * Il lunedì della settimana che contiene `iso`. Settimana lun-dom: la domenica
 * appartiene alla settimana iniziata sei giorni prima, come in `weekdaysOf`.
 */
export function mondayOfIso(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDaysIso(iso, -((weekday + 6) % 7));
}

/**
 * I lunedì delle settimane che coprono l'intervallo, da quella che contiene
 * `from` (compresa) fino a `to` (escluso).
 *
 * `from` viene agganciato al suo lunedì: il primo elemento può quindi precedere
 * `from`. È voluto — la griglia mostra settimane intere, e senza l'aggancio il
 * giorno richiesto non comparirebbe in nessuna colonna. Soprattutto, `weekdaysOf()`
 * a valle assume il lunedì e non lo verifica: un elemento non-lunedì qui rende
 * sbagliato ogni numero di capacità della griglia, in silenzio.
 */
export function weekStartsBetween(from: string, to: string): string[] {
  const weeks: string[] = [];
  for (let week = mondayOfIso(from); week < to; week = addDaysIso(week, 7)) {
    weeks.push(week);
  }
  return weeks;
}

/**
 * I lunedì delle settimane che coprono il mese di `iso`, prima settimana
 * inclusa anche quando comincia nel mese precedente.
 *
 * È l'asse temporale della vista per progetto: la stessa convenzione della
 * vecchia Pianificazione, dove il mese si legge per settimane intere.
 */
export function monthWeeksOf(iso: string): string[] {
  const [year, month] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const weeks: string[] = [];
  for (let week = mondayOfIso(`${iso.slice(0, 7)}-01`); week <= lastDay; week = addDaysIso(week, 7)) {
    weeks.push(week);
  }
  return weeks;
}

/**
 * Zoom "mesi": una colonna somma le settimane il cui lunedì cade nel mese.
 * Una settimana a cavallo appartiene interamente al mese del suo lunedì —
 * stessa convenzione dell'endpoint /dashboard, e la somma delle colonne resta
 * uguale al totale del range senza doppi conteggi.
 */
export function monthColumns(weekStarts: string[]): { key: string; weeks: string[] }[] {
  const columns: { key: string; weeks: string[] }[] = [];
  for (const week of weekStarts) {
    const key = week.slice(0, 7);
    const last = columns[columns.length - 1];
    if (last && last.key === key) {
      last.weeks.push(week);
    } else {
      columns.push({ key, weeks: [week] });
    }
  }
  return columns;
}

export function allocationsByPerson(
  allocations: ScheduleAllocation[],
): Map<number, ScheduleAllocation[]> {
  const byPerson = new Map<number, ScheduleAllocation[]>();
  for (const allocation of allocations) {
    const current = byPerson.get(allocation.person_id);
    if (current) {
      current.push(allocation);
    } else {
      byPerson.set(allocation.person_id, [allocation]);
    }
  }
  return byPerson;
}

export function allocatedDays(
  allocations: ScheduleAllocation[],
  personId: number,
  weeks: string[],
): number {
  const inRange = new Set(weeks);
  return allocations
    .filter(a => a.person_id === personId && inRange.has(a.week_start))
    .reduce((total, a) => total + a.man_days, 0);
}

/** Giorni allocati a una persona su progetti di altri team (solo aggregato dal backend). */
export function otherTeamDays(
  load: readonly ScheduleOtherTeamLoad[],
  personId: number,
  weeks: readonly string[],
): number {
  const inRange = new Set(weeks);
  return load
    .filter(entry => entry.person_id === personId && inRange.has(entry.week_start))
    .reduce((total, entry) => total + entry.man_days, 0);
}

/** Giorni disponibili su più settimane, al netto delle assenze e del lavoro in altri team. */
export function netAvailableDays(
  person: SchedulePerson,
  weeks: readonly string[],
  timeOff: TimeOffEntry[],
  otherTeamLoad: readonly ScheduleOtherTeamLoad[] = [],
): number {
  const gross = weeks.reduce((total, week) => total + availableDays(person, week, timeOff), 0);
  return Math.max(0, gross - otherTeamDays(otherTeamLoad, person.id, weeks));
}

export interface ScheduleFilters {
  projectIds: number[];
  personIds: number[];
  teamIds: number[];
  hideEmpty: boolean;
}

export const EMPTY_FILTERS: ScheduleFilters = {
  projectIds: [],
  personIds: [],
  teamIds: [],
  hideEmpty: false,
};

/** Un filtro vuoto non restringe: `[]` significa "tutti", non "nessuno". */
const matches = (selected: number[], value: number) =>
  selected.length === 0 || selected.includes(value);

export function filterSchedule(
  data: ScheduleData,
  filters: ScheduleFilters,
  weeks: string[],
): { persons: SchedulePerson[]; allocations: ScheduleAllocation[]; unplanned: UnplannedAssignment[] } {
  const allocations = data.allocations.filter(a => matches(filters.projectIds, a.project_id));
  const unplanned = (data.unplanned_assignments ?? []).filter(a => matches(filters.projectIds, a.project_id));

  const withWork = new Set(
    allocations.filter(a => weeks.includes(a.week_start)).map(a => a.person_id),
  );
  // Chi è assegnato al progetto ci "lavora" anche prima delle ore: il filtro per progetto non lo nasconde.
  const assigned = new Set([...withWork, ...unplanned.map(a => a.person_id)]);

  const persons = data.persons.filter(person => {
    if (!matches(filters.personIds, person.id)) return false;
    if (!matches(filters.teamIds, person.team_id)) return false;
    // Un filtro per progetto è una domanda su chi ci lavora: chi non ci lavora esce.
    if (filters.projectIds.length > 0 && !assigned.has(person.id)) return false;
    if (filters.hideEmpty && !withWork.has(person.id)) return false;
    return true;
  });

  const visible = new Set(persons.map(person => person.id));
  return {
    persons,
    allocations: allocations.filter(a => visible.has(a.person_id)),
    unplanned: unplanned.filter(a => visible.has(a.person_id)),
  };
}

export type SortKey = 'name' | 'unscheduled' | 'utilization';

export interface SortOptions {
  key: SortKey;
  descending: boolean;
  allocations: ScheduleAllocation[];
  timeOff: TimeOffEntry[];
  weeks: string[];
  otherTeamLoad?: readonly ScheduleOtherTeamLoad[];
}

function rangeUtilization(
  person: SchedulePerson,
  options: SortOptions,
): number {
  const available = netAvailableDays(person, options.weeks, options.timeOff, options.otherTeamLoad);
  const allocated = allocatedDays(options.allocations, person.id, options.weeks);
  const ratio = utilization(allocated, available);
  if (ratio !== null) return ratio;
  // Nessuna capacità nel range. Stessa distinzione di `utilizationLevel`: con del
  // lavoro pianificato è un conflitto e va all'estremo più carico; senza, la
  // persona è libera e vale come chiunque non abbia nulla da fare.
  return allocated > 0 ? Number.POSITIVE_INFINITY : 0;
}

/**
 * Ritorna un array nuovo: la lista in ingresso non viene mutata.
 *
 * A pari merito l'ordine è alfabetico **in entrambi i versi**: il pareggio serve a
 * rendere l'ordine deterministico, non a ribaltarsi con `descending`.
 */
export function sortPersons(
  persons: SchedulePerson[],
  options: SortOptions,
): SchedulePerson[] {
  const direction = options.descending ? -1 : 1;
  const sorted = [...persons];

  const metric = options.key === 'unscheduled'
    ? (person: SchedulePerson) => allocatedDays(options.allocations, person.id, options.weeks)
    : (person: SchedulePerson) => rangeUtilization(person, options);

  sorted.sort((left, right) => {
    if (options.key === 'name') {
      return direction * left.name.localeCompare(right.name, 'it');
    }
    const difference = metric(left) - metric(right);
    // `difference` è NaN quando entrambi valgono Infinity, cioè due conflitti:
    // `Math.abs(NaN) > eps` è false, quindi si scende al pareggio per nome e il
    // comparatore non restituisce mai NaN — che renderebbe l'ordine dipendente
    // dal motore JS.
    if (Math.abs(difference) > RATIO_EPSILON) return direction * difference;
    return left.name.localeCompare(right.name, 'it');
  });

  return sorted;
}

/**
 * Palette fissa. Quando `projects.color` è null il colore è derivato da
 * `project_id`: la griglia è leggibile senza configurare nulla, e chi vuole
 * può fissare il colore di un progetto.
 */
const PALETTE = Array.from(
  { length: 10 },
  (_, i) => `var(--schedule-project-${i + 1})`
);

export function projectColor(projectId: number, explicit: string | null): string {
  if (explicit) return explicit;
  return PALETTE[Math.abs(projectId) % PALETTE.length];
}
