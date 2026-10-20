import type { TaskType, WeekGroup } from '../types';

export const isTaskCompleted = (status: string) => status === 'completed';

export const isWbsClosed = (status: string | null) => status === 'chiuso';

export function shouldShowTimelineRow({
  taskStatus,
  wbsStatus,
  hours,
  showCompleted,
}: {
  taskStatus: string;
  wbsStatus: string | null;
  hours: number;
  showCompleted: boolean;
}): boolean {
  if (showCompleted || hours > 0) return true;
  return !isTaskCompleted(taskStatus) && !isWbsClosed(wbsStatus);
}

export function timelineActivityBucket(hours: number, plannedDays: number, lastEntryWeek: string | null): 0 | 1 | 2 | 3 {
  if (hours > 0) return 0;
  if (plannedDays > 0) return 1;
  if (lastEntryWeek) return 2;
  return 3;
}

export type WeekTask = WeekGroup['tasks'][number];
export type WeeklySaveState = 'saving' | 'saved' | 'error';

export interface TaskGroup {
  projectId: number;
  projectName: string;
  taskId: number;
  taskType: TaskType;
  taskStatus: string;
  isExtra: boolean;
  lastEntryWeek: string | null;
  plannedDays: number;
  rows: WeekTask[];
}

export interface AddCandidate {
  key: string;
  projectId: number;
  projectName: string;
  taskId: number;
  taskType: TaskType;
  taskStatus: string;
  wbsItemId: number | null;
  wbsItemName: string | null;
  wbsStatus: string | null;
}
