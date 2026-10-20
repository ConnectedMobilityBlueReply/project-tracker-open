export type TaskGroupKey = 'overdue' | 'thisWeek' | 'later' | 'noDate' | 'closed';

export const TASK_GROUP_ORDER: readonly TaskGroupKey[] = ['overdue', 'thisWeek', 'later', 'noDate', 'closed'];

export const TASK_GROUP_LABELS: Record<TaskGroupKey, string> = {
  overdue: 'Scaduti',
  thisWeek: 'Questa settimana',
  later: 'Prossime settimane',
  noDate: 'Senza scadenza',
  closed: 'Chiusi',
};

export interface TaskGroup<T> {
  key: TaskGroupKey;
  label: string;
  items: T[];
}

const DAY_MS = 86_400_000;

/** Date ISO a mezzanotte UTC: i conti in giorni non risentono dell'ora legale. */
function utcDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Domenica della settimana lun–dom che contiene `todayIso`. */
export function weekEndIso(todayIso: string): string {
  const day = new Date(utcDay(todayIso)).getUTCDay(); // 0 = domenica
  return isoOf(utcDay(todayIso) + ((7 - day) % 7) * DAY_MS);
}

function groupOf(item: { status: string; planned_end?: string | null }, todayIso: string, weekEnd: string): TaskGroupKey {
  if (item.status === 'chiuso') return 'closed';
  const end = item.planned_end?.slice(0, 10);
  if (!end) return 'noDate';
  if (end < todayIso) return 'overdue';
  if (end <= weekEnd) return 'thisWeek';
  return 'later';
}

export type TaskSortBy = 'due' | 'project';

export function groupTasks<T extends { status: string; planned_end?: string | null; project_name?: string }>(
  items: readonly T[], todayIso: string, sortBy: TaskSortBy = 'due',
): TaskGroup<T>[] {
  const weekEnd = weekEndIso(todayIso);
  const buckets = new Map<TaskGroupKey, T[]>(TASK_GROUP_ORDER.map(key => [key, []]));
  for (const item of items) buckets.get(groupOf(item, todayIso, weekEnd))!.push(item);
  const byEnd = (a: T, b: T) => (a.planned_end ?? '').localeCompare(b.planned_end ?? '');
  const byProject = (a: T, b: T) =>
    (a.project_name ?? '').localeCompare(b.project_name ?? '', 'it') || byEnd(a, b);
  const compare = sortBy === 'project' ? byProject : byEnd;
  return TASK_GROUP_ORDER.map(key => ({
    key,
    label: TASK_GROUP_LABELS[key],
    items: [...buckets.get(key)!].sort(compare),
  }));
}

export function relativeDue(endIso: string, todayIso: string): { label: string; overdue: boolean } {
  const days = Math.round((utcDay(endIso) - utcDay(todayIso)) / DAY_MS);
  if (days === 0) return { label: 'oggi', overdue: false };
  if (days === 1) return { label: 'domani', overdue: false };
  if (days > 1) return { label: `tra ${days} gg`, overdue: false };
  if (days === -1) return { label: 'ieri', overdue: true };
  return { label: `${-days} gg fa`, overdue: true };
}
