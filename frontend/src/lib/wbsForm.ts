import type { WbsItem, WbsStatus } from '../types';

export interface WbsFormState {
  name: string;
  estimated_days: string;
  completion_pct: string;
  status: WbsStatus;
  planned_start: string;
  planned_end: string;
  assignee_person_id: string;
  description: string;
}

export type WbsField = keyof WbsFormState | 'task';
export type WbsFieldErrors = Partial<Record<WbsField, string>>;

export const EMPTY_WBS_FORM: WbsFormState = {
  name: '', estimated_days: '', completion_pct: '0',
  status: 'aperto', planned_start: '', planned_end: '',
  assignee_person_id: '', description: '',
};

export function wbsToForm(item: WbsItem): WbsFormState {
  return {
    name: item.name,
    estimated_days: String(item.estimated_days),
    completion_pct: String(item.completion_pct),
    status: item.status,
    planned_start: item.planned_start ?? '',
    planned_end: item.planned_end ?? '',
    assignee_person_id: item.assignee_person_id ? String(item.assignee_person_id) : '',
    description: item.description ?? '',
  };
}

interface ValidationContext {
  /** true = modifica di un componente esistente (il task non si sceglie). */
  editing: boolean;
  taskId: number | null;
}

/** Solo UX: il backend rivalida. */
export function validateWbsForm(form: WbsFormState, { editing, taskId }: ValidationContext): WbsFieldErrors {
  const errors: WbsFieldErrors = {};
  const estimatedDays = Number(form.estimated_days);
  const completionPct = Number(form.completion_pct);

  if (!form.name.trim()) errors.name = 'Il nome è obbligatorio';
  if (!form.estimated_days.trim()) errors.estimated_days = 'Inserisci i giorni stimati';
  else if (!Number.isFinite(estimatedDays) || estimatedDays < 0) errors.estimated_days = 'I giorni stimati devono essere un numero ≥ 0';
  if (!form.completion_pct.trim()) errors.completion_pct = 'Inserisci la percentuale di completamento';
  else if (!Number.isInteger(completionPct) || completionPct < 0 || completionPct > 100) errors.completion_pct = 'Inserisci un numero intero tra 0 e 100';
  if (form.planned_start && form.planned_end && form.planned_end < form.planned_start) {
    errors.planned_end = 'La data di fine non può precedere la data di inizio';
  }
  if (!editing && taskId == null) errors.task = 'Seleziona il task di appartenenza';
  return errors;
}

/** Da chiamare solo dopo `validateWbsForm` senza errori. In modifica `taskId` è null e il backend lo ignora. */
export function toWbsPayload(form: WbsFormState, taskId: number | null): Partial<WbsItem> {
  return {
    task_id: taskId ?? 0,
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    estimated_days: Number(form.estimated_days),
    completion_pct: Number(form.completion_pct),
    status: form.status,
    planned_start: form.planned_start || undefined,
    planned_end: form.planned_end || undefined,
    assignee_person_id: form.assignee_person_id ? parseInt(form.assignee_person_id, 10) : undefined,
  };
}
