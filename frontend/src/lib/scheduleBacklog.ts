import type {
  BacklogItem,
  ScheduleAllocation,
  ScheduleOtherTeamLoad,
  SchedulePerson,
  TimeOffEntry,
} from '../types';
import { utilizationLevel } from './capacity.ts';
import type { UtilizationLevel } from './capacity.ts';
import { allocatedDays, netAvailableDays } from './scheduleModel.ts';

const EPSILON = 1e-6;

/** Due decimali: i giorni sono multipli di 0,25 e le somme float non devono lasciare residui fantasma. */
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Chiave della riga per persona: deve coincidere con `personRows`. */
export const rowKeyForPerson = (personId: number): string => `person-${personId}`;

/** Giorni liberi di una persona in una settimana, mai negativi. */
export function freeDays(
  person: SchedulePerson,
  week: string,
  allocations: readonly ScheduleAllocation[],
  timeOff: TimeOffEntry[],
  otherTeamLoad: readonly ScheduleOtherTeamLoad[] = [],
): number {
  const available = netAvailableDays(person, [week], timeOff, otherTeamLoad);
  const allocated = allocatedDays([...allocations], person.id, [week]);
  return Math.max(0, round2(available - allocated));
}

export interface WeekAssignment {
  /** Giorni aggiunti dal click: scalano dal residuo del backlog. */
  addedDays: number;
  /** `man_days` da inviare all'upsert: esistenti + aggiunti, perché l'upsert sostituisce la settimana. */
  manDays: number;
}

/** `null` se in quella settimana non c'è nulla da assegnare. */
export function planAssignment(
  item: Pick<BacklogItem, 'task_allocation_id' | 'remaining_days'>,
  week: string,
  allocations: readonly ScheduleAllocation[],
  free: number,
): WeekAssignment | null {
  const addedDays = round2(Math.min(free, item.remaining_days));
  if (addedDays <= EPSILON) return null;
  const existing = allocations.find(a =>
    a.task_allocation_id === item.task_allocation_id && a.week_start === week)?.man_days ?? 0;
  return { addedDays, manDays: round2(existing + addedDays) };
}

/** Allocazioni dopo un'assegnazione ottimistica: sostituisce la settimana esistente o aggiunge una card provvisoria. */
export function applyAssignment(
  allocations: readonly ScheduleAllocation[],
  item: BacklogItem,
  week: string,
  assignment: WeekAssignment,
  placeholderId: number,
): ScheduleAllocation[] {
  const matches = (a: ScheduleAllocation) =>
    a.task_allocation_id === item.task_allocation_id && a.week_start === week;
  if (allocations.some(matches)) {
    return allocations.map(a => (matches(a) ? { ...a, man_days: assignment.manDays } : a));
  }
  return [...allocations, {
    id: placeholderId, // provvisorio: il ricaricamento porta quello vero
    task_allocation_id: item.task_allocation_id,
    task_id: item.task_id,
    task_type: item.task_type,
    project_id: item.project_id,
    project_name: item.project_name,
    basket: null,
    color: item.project_color,
    person_id: item.person_id,
    week_start: week,
    man_days: assignment.manDays,
    tentative: false,
  }];
}

/** Backlog dopo un'assegnazione ottimistica: scala il residuo, l'item sparisce a zero. */
export function applyToBacklog(
  items: readonly BacklogItem[],
  taskAllocationId: number,
  addedDays: number,
): BacklogItem[] {
  return items
    .map(entry => (entry.task_allocation_id === taskAllocationId
      ? {
          ...entry,
          allocated_days: round2(entry.allocated_days + addedDays),
          remaining_days: round2(entry.remaining_days - addedDays),
        }
      : entry))
    .filter(entry => entry.remaining_days > EPSILON);
}

/** Vero se almeno una delle settimane date ha spazio per l'item. */
export function hasAssignableWeek(
  item: BacklogItem,
  person: SchedulePerson,
  weeks: readonly string[],
  allocations: readonly ScheduleAllocation[],
  timeOff: TimeOffEntry[],
  otherTeamLoad: readonly ScheduleOtherTeamLoad[] = [],
): boolean {
  return weeks.some(week =>
    planAssignment(item, week, allocations, freeDays(person, week, allocations, timeOff, otherTeamLoad)) !== null);
}

export interface TeamColumnTotal {
  key: string;
  allocated: number;
  available: number;
  level: UtilizationLevel;
}

/** Riga "Team": allocato e disponibile sommati sulle persone visibili, per colonna. */
export function teamTotals(
  persons: readonly SchedulePerson[],
  allocations: readonly ScheduleAllocation[],
  timeOff: TimeOffEntry[],
  otherTeamLoad: readonly ScheduleOtherTeamLoad[],
  columns: readonly { key: string; weeks: string[] }[],
): TeamColumnTotal[] {
  return columns.map(column => {
    const allocated = round2(persons.reduce(
      (total, person) => total + allocatedDays([...allocations], person.id, column.weeks), 0));
    const available = round2(persons.reduce(
      (total, person) => total + netAvailableDays(person, column.weeks, timeOff, otherTeamLoad), 0));
    return { key: column.key, allocated, available, level: utilizationLevel(allocated, available) };
  });
}

export type AssignmentHint = 'ready' | 'months' | 'person-hidden' | 'row-collapsed' | 'no-free-week';

/** Perché (o se) l'item selezionato si può assegnare adesso: la UI lo traduce in un messaggio. */
export function assignmentHint(args: {
  item: BacklogItem;
  zoom: 'weeks' | 'months';
  /** Riga della persona nella griglia corrente; `undefined` se i filtri la nascondono. */
  personRow: { person: SchedulePerson } | undefined;
  /** Riga aperta: il bottone "+N g" esiste solo nelle righe espanse. */
  expanded: boolean;
  weeks: readonly string[];
  allocations: readonly ScheduleAllocation[];
  timeOff: TimeOffEntry[];
  otherTeamLoad: readonly ScheduleOtherTeamLoad[];
}): AssignmentHint {
  if (args.zoom === 'months') return 'months';
  if (!args.personRow) return 'person-hidden';
  if (!args.expanded) return 'row-collapsed';
  return hasAssignableWeek(args.item, args.personRow.person, args.weeks, args.allocations, args.timeOff, args.otherTeamLoad)
    ? 'ready'
    : 'no-free-week';
}
