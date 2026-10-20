import type { RangeRow, SelectableProject, TaskType } from '../types';
import { TASK_LABELS } from '../types.ts';
import { implicitTaskId } from './phasesMode.ts';
import { hoursToDays } from './units.ts';

/** Stessa chiave di `TimeEntriesController.rowKey`: riga locale e riga del server coincidono. */
export function rangeRowKey(taskId: number, wbsItemId: number | null): string {
  return `${taskId}:${wbsItemId ?? 'none'}`;
}

/**
 * Riflette un salvataggio riuscito senza ricaricare la griglia. A 0 ore il backend
 * conserva la riga con man_days 0 e il suo id: `entry_id` resta quello.
 */
export function applySavedHours(
  rows: RangeRow[], rowKey: string, weekStart: string, hours: number, entryId: number | null,
): RangeRow[] {
  const nextDays = hoursToDays(hours);
  return rows.map(row => {
    if (row.key !== rowKey) return row;
    const previous = row.weeks[weekStart];
    const previousDays = previous?.man_days ?? 0;
    return {
      ...row,
      total_man_days: Math.round((row.total_man_days - previousDays + nextDays) * 10000) / 10000,
      weeks: {
        ...row.weeks,
        [weekStart]: {
          entry_id: entryId ?? previous?.entry_id ?? null,
          man_days: nextDays,
          planned_days: previous?.planned_days ?? 0,
          notes: previous?.notes ?? null,
        },
      },
    };
  });
}

export interface AddableActivity {
  key: string;
  taskId: number;
  projectId: number;
  projectName: string;
  taskType: string;
  label: string;
}

/** Attività su cui si può aprire una riga nuova: una per task, il solo GEN sui progetti senza fasi. */
export function addableActivities(projects: SelectableProject[], rows: RangeRow[]): AddableActivity[] {
  const present = new Set(rows.map(row => row.key));
  return projects.flatMap(project => {
    const implicit = implicitTaskId(project);
    const tasks = implicit != null ? project.tasks.filter(task => task.id === implicit) : project.tasks;
    return tasks.map(task => ({
      key: rangeRowKey(task.id, null),
      taskId: task.id,
      projectId: project.id,
      projectName: project.name,
      taskType: task.task_type,
      label: implicit != null
        ? project.name
        : `${project.name} — ${TASK_LABELS[task.task_type as TaskType] ?? task.task_type}`,
    }));
  }).filter(activity => !present.has(activity.key));
}

/** Riga vuota mostrata finché non si salva la prima cella; il reload successivo porta i dati veri. */
export function draftRow(activity: AddableActivity): RangeRow {
  return {
    key: activity.key,
    task_id: activity.taskId,
    wbs_item_id: null,
    wbs_item_name: null,
    project_id: activity.projectId,
    project_name: activity.projectName,
    task_type: activity.taskType,
    task_status: '',
    estimated_days: 0,
    total_man_days: 0,
    is_extra: true,
    available_wbs_items: [],
    weeks: {},
  };
}

export function mergeDraftRows(rows: RangeRow[], drafts: RangeRow[]): RangeRow[] {
  const present = new Set(rows.map(row => row.key));
  return [...rows, ...drafts.filter(draft => !present.has(draft.key))];
}
