import type { BillingType, Project, SelectableProject, SetPhasesRequest } from '../types';
import { validateTaskForm, type TaskFormErrors, type TaskFormState } from './projectConfigModel.ts';

/**
 * Regole dei progetti senza fasi: funzioni pure, separate dai componenti per poterle testare
 * con `node --test`. Il backend (ProjectPhaseRules) applica le stesse regole.
 */

export interface DisableDraft {
  person_id: string;
  planned_start: string;
  planned_end: string;
  estimated_days: string;
}

export interface DisableErrors {
  person?: string;
  plannedStart?: string;
  plannedEnd?: string;
  estimatedDays?: string;
}

export const EMPTY_DISABLE_DRAFT: DisableDraft = { person_id: '', planned_start: '', planned_end: '', estimated_days: '' };

const DATES_INCOMPLETE = 'Indica sia l’inizio sia la fine, oppure lascia entrambe vuote.';
const DATES_ORDER = 'La data di fine non può essere precedente alla data di inizio.';
const NEGATIVE_DAYS = 'I giorni stimati non possono essere negativi.';
const DAYS_NOT_NUMBER = 'I giorni stimati devono essere un numero.';

/** Vuoto = nessuna stima. Spazi o testo non numerico: `Number(' ')` e `NaN` finirebbero come `null` nel JSON. */
const estimatedDaysError = (value: string): string | undefined => {
  if (value === '') return undefined;
  if (value.trim() === '' || !Number.isFinite(Number(value))) return DAYS_NOT_NUMBER;
  return Number(value) < 0 ? NEGATIVE_DAYS : undefined;
};

/** Progetto reale gestito senza fasi: ha il solo task GEN implicito. */
export const isPhaseless = (project: Pick<Project, 'uses_phases' | 'is_virtual'>): boolean =>
  project.uses_phases === false && !project.is_virtual;

/**
 * Task su cui consuntivare un progetto senza fasi: il GEN implicito, quindi nessuna attività da scegliere.
 * null per progetti con fasi e virtuali (anche loro hanno un solo GEN, ma restano com'erano).
 */
export function implicitTaskId(
  project: Pick<SelectableProject, 'uses_phases' | 'is_virtual' | 'tasks'>,
): number | null {
  if (!isPhaseless(project)) return null;
  return project.tasks.find(task => task.task_type === 'GEN')?.id ?? null;
}

/**
 * Task su cui scrive la modale "Assegna lavoro": il GEN implicito nei progetti senza fasi (nessuna
 * attività da scegliere), altrimenti l'attività selezionata.
 */
export function resolveAssignTask<T extends { id: number; task_type: string }>(
  project: Pick<Project, 'uses_phases' | 'is_virtual'> | null,
  tasks: T[],
  taskId: number | null,
): T | null {
  if (project && isPhaseless(project)) return tasks.find(task => task.task_type === 'GEN') ?? null;
  return tasks.find(task => task.id === taskId) ?? null;
}

export function validateDisableDraft(draft: DisableDraft): DisableErrors {
  const errors: DisableErrors = {};
  // Persona e date si possono assegnare dopo: vuoti sono validi, a metà no.
  if (draft.planned_end && !draft.planned_start) errors.plannedStart = DATES_INCOMPLETE;
  if (draft.planned_start && !draft.planned_end) errors.plannedEnd = DATES_INCOMPLETE;
  if (draft.planned_start && draft.planned_end && draft.planned_end < draft.planned_start) errors.plannedEnd = DATES_ORDER;
  const daysError = estimatedDaysError(draft.estimated_days);
  if (daysError) errors.estimatedDays = daysError;
  return errors;
}

export function toDisablePayload(draft: DisableDraft): Extract<SetPhasesRequest, { uses_phases: false }> {
  return {
    uses_phases: false,
    ...(draft.person_id !== '' ? { person_id: Number(draft.person_id) } : {}),
    ...(draft.planned_start !== '' ? { planned_start: draft.planned_start } : {}),
    ...(draft.planned_end !== '' ? { planned_end: draft.planned_end } : {}),
    ...(draft.estimated_days !== '' ? { estimated_days: Number(draft.estimated_days) } : {}),
  };
}

/** Come `validateTaskForm`, più la coppia di date del task GEN: facoltative, ma mai a metà (il backend risponde 400). */
export function validatePhaselessTaskForm(form: TaskFormState): TaskFormErrors {
  const errors = validateTaskForm(form);
  if (!form.planned_start !== !form.planned_end) errors.plannedEnd = DATES_INCOMPLETE;
  const daysError = estimatedDaysError(form.estimated_days);
  if (daysError) errors.estimatedDays = daysError;
  return errors;
}

/** Un progetto T&M senza fasi ha una sola persona: per cambiarla si usa `replace`. */
export const isSinglePerson = (billingType: BillingType | undefined): boolean => billingType === 'tm';

/**
 * Giorni di una nuova allocazione dal campo "Giorni". Campo vuoto: nel cambio persona si riportano
 * quelli della persona sostituita (la spec tace; scelta di prodotto), altrimenti 0 come prima.
 */
export const resolveAllocationDays = (input: string, replacedDays?: number | null): number =>
  input !== '' ? Number(input) : (replacedDays ?? 0);
