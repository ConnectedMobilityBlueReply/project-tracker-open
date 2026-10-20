import type { AppRole, WbsPlanningItem, WbsStatus } from '../types.ts';
import { roleAtLeast } from '../auth/routeAccess.ts';
import { addDaysIso } from './capacity.ts';
import { mondayOfIso, weekStartsBetween } from './scheduleModel.ts';

/**
 * Board Planning: raggruppamenti, colonne, permessi di UI e geometria del Gantt.
 * Funzioni pure su date `yyyy-MM-dd` (confronto lessicografico), testate con `node --test`.
 * I permessi qui sono comodità di UI: l'autorità resta il backend.
 */

export type PeriodGroup = 'overdue' | 'this_month' | 'next_month' | 'later' | 'no_date' | 'closed';

const PERIOD_GROUP_ORDER: readonly PeriodGroup[] = ['overdue', 'this_month', 'next_month', 'later', 'no_date', 'closed'];

export const PERIOD_GROUP_LABELS: Record<PeriodGroup, string> = {
  overdue: 'In ritardo',
  this_month: 'Questo mese',
  next_month: 'Prossimo mese',
  later: 'Più avanti',
  no_date: 'Senza data',
  closed: 'Chiuse',
};

export interface PlanningGroup {
  key: PeriodGroup;
  items: WbsPlanningItem[];
}

type PlanningUser = { personId: number; appRole: AppRole } | null;

/** Oggi sul calendario locale: `toISOString()` darebbe la data UTC, sbagliata a notte fonda. */
export function localTodayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function periodGroupOf(item: Pick<WbsPlanningItem, 'status' | 'planned_end'>, today: string): PeriodGroup {
  if (item.status === 'chiuso') return 'closed';
  if (!item.planned_end) return 'no_date';
  if (item.planned_end < today) return 'overdue';
  const month = item.planned_end.slice(0, 7);
  const thisMonth = today.slice(0, 7);
  if (month === thisMonth) return 'this_month';
  if (month === nextMonthKey(thisMonth)) return 'next_month';
  return 'later';
}

export function isOverdue(item: Pick<WbsPlanningItem, 'status' | 'planned_end'>, today: string): boolean {
  return periodGroupOf(item, today) === 'overdue';
}

/** Gruppi in ordine fisso, vuoti omessi; dentro il gruppo resta l'ordine del backend. */
export function groupByPeriod(items: readonly WbsPlanningItem[], today: string): PlanningGroup[] {
  return PERIOD_GROUP_ORDER
    .map(key => ({ key, items: items.filter(item => periodGroupOf(item, today) === key) }))
    .filter(group => group.items.length > 0);
}

export const KANBAN_STATUSES = ['aperto', 'in_corso', 'chiuso'] as const satisfies readonly WbsStatus[];

function compareByDue(a: WbsPlanningItem, b: WbsPlanningItem): number {
  const aEnd = a.planned_end || null;
  const bEnd = b.planned_end || null;
  if (aEnd === bEnd) return a.id - b.id;
  if (aEnd == null) return 1;
  if (bEnd == null) return -1;
  return aEnd < bEnd ? -1 : 1;
}

export function kanbanColumns(items: readonly WbsPlanningItem[]): Record<WbsStatus, WbsPlanningItem[]> {
  const byDue = [...items].sort(compareByDue);
  return {
    aperto: byDue.filter(item => item.status === 'aperto'),
    in_corso: byDue.filter(item => item.status === 'in_corso'),
    chiuso: byDue.filter(item => item.status === 'chiuso'),
  };
}

export function canEditProgress(user: PlanningUser, item: Pick<WbsPlanningItem, 'assignee_person_id'>): boolean {
  if (user == null) return false;
  return roleAtLeast(user.appRole, 'pm') || item.assignee_person_id === user.personId;
}

export function canEditPriority(user: PlanningUser): boolean {
  return user != null && roleAtLeast(user.appRole, 'pm');
}

/** Id da query string: solo interi positivi, tutto il resto è "nessun filtro". */
export function positiveIntOrNull(raw: string | null): number | null {
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value > 0 ? value : null;
}

export interface PlanningFilters {
  projectId: number | null;
  personId: number | null;
}

export function filterPlanning(items: readonly WbsPlanningItem[], filters: PlanningFilters): WbsPlanningItem[] {
  return items.filter(item =>
    (filters.projectId == null || item.project_id === filters.projectId)
    && (filters.personId == null || item.assignee_person_id === filters.personId));
}

export interface Option {
  id: number;
  name: string;
}

const byName = (a: Option, b: Option) => a.name.localeCompare(b.name, 'it');

export function projectOptions(items: readonly WbsPlanningItem[]): Option[] {
  const unique = new Map(items.map(item => [item.project_id, item.project_name]));
  return [...unique].map(([id, name]) => ({ id, name })).sort(byName);
}

/** Owner presenti nelle WBS, più `self` (il member deve poter scegliere "io" anche senza WBS). */
export function personOptions(items: readonly WbsPlanningItem[], self?: Option): Option[] {
  const unique = new Map<number, string>();
  for (const item of items) {
    if (item.assignee_person_id != null) unique.set(item.assignee_person_id, item.assignee_person_name ?? '—');
  }
  if (self) unique.set(self.id, self.name);
  return [...unique].map(([id, name]) => ({ id, name })).sort(byName);
}

export interface ProjectGroup {
  projectId: number;
  projectName: string;
  projectColor: string | null;
  items: WbsPlanningItem[];
}

export function groupByProject(items: readonly WbsPlanningItem[]): ProjectGroup[] {
  const groups = new Map<number, ProjectGroup>();
  for (const item of items) {
    const group = groups.get(item.project_id);
    if (group) {
      groups.set(item.project_id, { ...group, items: [...group.items, item] });
    } else {
      groups.set(item.project_id, {
        projectId: item.project_id, projectName: item.project_name, projectColor: item.project_color, items: [item],
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.projectName.localeCompare(b.projectName, 'it'));
}

/** Due anni di settimane: oltre, il Gantt diventa illeggibile e pesante da disegnare. */
export const MAX_GANTT_WEEKS = 104;

export function dueDateFormat(iso: string, currentYear: number): 'd MMM' | 'd MMM yyyy' {
  return Number(iso.slice(0, 4)) === currentYear ? 'd MMM' : 'd MMM yyyy';
}

function datesOf(item: WbsPlanningItem): string[] {
  return [item.planned_start, item.planned_end].filter((date): date is string => !!date);
}

export interface GanttWindow {
  weeks: string[];
  undated: number;
  outside: number;
}

export function ganttWindow(items: readonly WbsPlanningItem[], today: string): GanttWindow {
  const dates = items.flatMap(datesOf);
  const undated = items.filter(item => datesOf(item).length === 0).length;
  if (dates.length === 0) return { weeks: [], undated, outside: 0 };
  const firstDate = dates.reduce((min, date) => (date < min ? date : min));
  const lastDate = dates.reduce((max, date) => (date > max ? date : max));
  const oldestVisibleWeek = mondayOfIso(addDaysIso(today, -26 * 7));
  const firstWeek = mondayOfIso(firstDate);
  const start = firstWeek > oldestVisibleWeek ? firstWeek : oldestVisibleWeek;
  const end = mondayOfIso(lastDate);
  const weeks = weekStartsBetween(start, addDaysIso(end, 1)).slice(0, MAX_GANTT_WEEKS);
  const outside = items.filter(item => datesOf(item).length > 0 && ganttSpan(item, weeks) == null).length;
  return { weeks, undated, outside };
}

/** Settimane occupate dalla WBS dentro `weeks`; date invertite tollerate, fuori finestra → null. */
export function ganttSpan(item: WbsPlanningItem, weeks: readonly string[]): { startIndex: number; length: number } | null {
  const dates = datesOf(item).map(mondayOfIso).sort();
  if (dates.length === 0 || weeks.length === 0) return null;
  const from = dates[0];
  const to = dates[dates.length - 1];
  const firstWeek = weeks[0];
  const lastWeek = weeks[weeks.length - 1];
  if (to < firstWeek || from > lastWeek) return null;
  const startIndex = from < firstWeek ? 0 : weeks.indexOf(from);
  const endIndex = to > lastWeek ? weeks.length - 1 : weeks.indexOf(to);
  return { startIndex, length: endIndex - startIndex + 1 };
}

export function withoutKey<T>(record: Record<number, T>, key: number): Record<number, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => Number(k) !== key));
}

/** Vecchi link (/schedule, /pianificazione, /allocazioni): il PM ritrova la griglia con i suoi parametri. */
export function legacyScheduleTarget(role: AppRole, search: string): string {
  return roleAtLeast(role, 'pm') ? `/planning/capacita${search}` : '/planning/table';
}
