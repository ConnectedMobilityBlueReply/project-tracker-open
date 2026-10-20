import type { BuPerson, BuProjectAllocation, BuWeek, SchedulePerson, TimeOffEntry } from '../types';
import { addDaysIso, availableDays, utilization, utilizationLevel, type UtilizationLevel } from './capacity.ts';

/**
 * Calcoli della vista Business Unit, funzioni pure (testabili con `node --test`).
 * Capacità e livelli passano da `capacity.ts`, le stesse funzioni della Schedule del
 * team: le due viste non possono contraddirsi.
 */

export const HORIZONS = [4, 12, 26] as const;
export type Horizon = typeof HORIZONS[number];
export const DEFAULT_HORIZON: Horizon = 12;

export type Engagement = 'all' | 'tm' | 'turnkey';

/** Lunedì della settimana di `date` (ora locale), come `YYYY-MM-DD`. */
export function mondayOf(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const sinceMonday = (utc.getUTCDay() + 6) % 7;
  return addDaysIso(utc.toISOString().slice(0, 10), -sinceMonday);
}

export function weekAllocated(week: BuWeek): number {
  return week.tm_days + week.turnkey_days + week.other_days;
}

function asSchedulePerson(person: BuPerson): SchedulePerson {
  return {
    id: person.person_id,
    name: person.name,
    job_title: person.job_title,
    team_id: person.teams[0]?.id ?? 0,
    weekly_capacity_days: person.weekly_capacity_days,
  };
}

/** Il backend manda solo l'intervallo: tipo e note non ci sono, e per la capacità non servono. */
function asTimeOff(person: BuPerson): TimeOffEntry[] {
  return person.time_off.map((entry, index) => ({
    id: index,
    person_id: person.person_id,
    start_date: entry.start_date,
    end_date: entry.end_date,
    type: 'assenza',
    tentative: false,
    notes: null,
  }));
}

export function weekAvailable(person: BuPerson, weekStart: string): number {
  return availableDays(asSchedulePerson(person), weekStart, asTimeOff(person));
}

export function weekLevel(person: BuPerson, week: BuWeek): UtilizationLevel {
  return utilizationLevel(weekAllocated(week), weekAvailable(person, week.week_start));
}

/** Vero se un'assenza si sovrappone alla settimana lun-dom che inizia a `weekStart`. Date ISO: il confronto di stringhe è di data. */
export function weekHasTimeOff(person: BuPerson, weekStart: string): boolean {
  const weekEnd = addDaysIso(weekStart, 6);
  return person.time_off.some(entry => entry.start_date <= weekEnd && entry.end_date >= weekStart);
}

export interface BuSummary {
  tmDays: number;
  turnkeyDays: number;
  otherDays: number;
  allocatedDays: number;
  availableDays: number;
  uncoveredDays: number;
  /** Allocati / disponibili sull'intero orizzonte; null senza capacità. */
  utilization: number | null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * I giorni scoperti si sommano per settimana: una settimana sovrallocata non
 * compensa una libera. Senza capacità (assenza o part-time a 0) non c'è scoperto.
 */
export function summarize(person: BuPerson): BuSummary {
  let tm = 0;
  let turnkey = 0;
  let other = 0;
  let available = 0;
  let uncovered = 0;
  for (const week of person.weeks) {
    const free = weekAvailable(person, week.week_start);
    tm += week.tm_days;
    turnkey += week.turnkey_days;
    other += week.other_days;
    available += free;
    uncovered += Math.max(0, free - weekAllocated(week));
  }
  const allocated = tm + turnkey + other;
  return {
    tmDays: round2(tm),
    turnkeyDays: round2(turnkey),
    otherDays: round2(other),
    allocatedDays: round2(allocated),
    availableDays: round2(available),
    uncoveredDays: round2(uncovered),
    utilization: utilization(allocated, available),
  };
}

export interface SegmentPercents {
  tm: number;
  turnkey: number;
  other: number;
}

/** Larghezze della barra di una cella: scalate sul maggiore tra allocato e disponibile. */
export function segmentPercents(week: BuWeek, available: number): SegmentPercents {
  const scale = Math.max(weekAllocated(week), available);
  if (scale === 0) return { tm: 0, turnkey: 0, other: 0 };
  return {
    tm: (week.tm_days / scale) * 100,
    turnkey: (week.turnkey_days / scale) * 100,
    other: (week.other_days / scale) * 100,
  };
}

export function filterByEngagement(people: readonly BuPerson[], engagement: Engagement): BuPerson[] {
  if (engagement === 'all') return [...people];
  const key = engagement === 'tm' ? 'tm_days' : 'turnkey_days';
  return people.filter(person => person.weeks.some(week => week[key] > 0));
}

export function allocatedUntilLabel(allocatedUntil: string | null, from: string, weeks: number): string {
  if (allocatedUntil == null) return 'Nessuna allocazione';
  const horizonEnd = addDaysIso(from, weeks * 7);
  if (allocatedUntil >= horizonEnd) return `oltre ${weeks} sett.`;
  return `sett. del ${formatIsoDate(allocatedUntil)}`;
}

export function projectKindLabel(project: BuProjectAllocation): string {
  if (project.is_virtual) return 'Altro';
  return project.billing_type === 'tm' ? 'T&M' : 'Turn Key';
}

export function projectTotal(project: BuProjectAllocation): number {
  return round2(project.weeks.reduce((sum, week) => sum + week.man_days, 0));
}

export interface TeamProjects {
  team_id: number;
  team_name: string;
  projects: BuProjectAllocation[];
}

/** Raggruppa per team nell'ordine di arrivo (il backend ordina per team e progetto). */
export function groupByTeam(projects: readonly BuProjectAllocation[]): TeamProjects[] {
  const groups = new Map<number, TeamProjects>();
  for (const project of projects) {
    const group = groups.get(project.team_id)
      ?? { team_id: project.team_id, team_name: project.team_name, projects: [] };
    group.projects.push(project);
    groups.set(project.team_id, group);
  }
  return [...groups.values()];
}

const DAYS_FORMAT = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

export function formatDays(value: number): string {
  return DAYS_FORMAT.format(value);
}

export function formatPct(ratio: number | null): string {
  return ratio == null ? '—' : `${Math.round(ratio * 100)}%`;
}

export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function formatIsoShort(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}
