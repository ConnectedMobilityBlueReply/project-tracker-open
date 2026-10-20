import type { BillingType, Project, TaskType } from '../types';

/**
 * Modello della pagina Configurazione progetti: filtro della lista, validazione dei form,
 * confronto stima/task. Funzioni pure, separate dalla pagina per poterle testare con
 * `node --test`.
 */

export interface ProjectForm {
  societa: string;
  area: string;
  pm_riferimento_cliente: string;
  name: string;
  description: string;
  codice_offerta: string;
  estimate_days: string;
  status: string;
  status_offerta: string;
  scala_da_basket: boolean;
  basket: string;
  /** true = le ore registrate non entrano nei giorni consuntivati (mai con T&M). */
  exclude_from_actuals: boolean;
  icon: string;
  daily_rate: string;
  billing_type: BillingType;
  /** Id del progetto T&M padre come stringa (valore del Select); '' = nessuno. */
  parent_project_id: string;
}

export interface TaskFormState {
  enabled: boolean;
  task_id?: number;
  status: string;
  planned_start: string;
  planned_end: string;
  estimated_days: string;
}

export type TaskFormsState = Partial<Record<TaskType, TaskFormState>>;

export interface ProjectFormErrors {
  name?: string;
  estimateDays?: string;
  basket?: string;
  dailyRate?: string;
  billingType?: string;
  parentProject?: string;
}

export interface TaskFormErrors {
  plannedEnd?: string;
  estimatedDays?: string;
}

export const STATUS_FILTER_ALL = 'tutti';

type ListedProject = Pick<Project, 'name' | 'status'> & { codice_offerta?: string | null };

export function filterProjectList<T extends ListedProject>(projects: T[], query: string, status: string): T[] {
  const needle = query.trim().toLowerCase();
  return projects.filter(project => {
    if (status !== STATUS_FILTER_ALL && project.status !== status) return false;
    if (needle === '') return true;
    return `${project.name} ${project.codice_offerta ?? ''}`.toLowerCase().includes(needle);
  });
}

const isNegative = (value: string) => value !== '' && Number(value) < 0;

export const DEFAULT_DAILY_RATE = '450';
// Stesso limite del CHECK su projects.daily_rate e della validazione backend.
const MAX_DAILY_RATE = 10000;

const isValidDailyRate = (value: string) => {
  if (value.trim() === '') return false;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 && rate <= MAX_DAILY_RATE;
};

/** Area di catalogo che preimposta l'esclusione dai consuntivi (stesso nome del backend). */
export const INVESTIMENTO_AREA = 'Investimento';

/** Patch di una scelta d'area: Investimento preimposta l'esclusione (salvo T&M), l'utente può poi toglierla. */
export function areaPatch(area: string, billingType: BillingType): Partial<ProjectForm> {
  return area === INVESTIMENTO_AREA && billingType !== 'tm' ? { area, exclude_from_actuals: true } : { area };
}

export function validateProjectForm(form: ProjectForm): ProjectFormErrors {
  const errors: ProjectFormErrors = {};
  if (!form.name.trim()) errors.name = 'Il nome del progetto è obbligatorio.';
  if (isNegative(form.estimate_days)) errors.estimateDays = 'La stima giorni non può essere negativa.';
  if (!isValidDailyRate(form.daily_rate)) {
    errors.dailyRate = 'Inserisci una tariffa giornaliera maggiore di 0 e al massimo 10.000 €.';
  }
  if (form.scala_da_basket && !form.basket) {
    errors.basket = 'Seleziona un basket dal menù, oppure disattiva “Scala da basket”.';
  }
  if (form.billing_type === 'tm' && form.scala_da_basket) {
    errors.billingType = 'Un progetto Time & Material non può scalare da basket: disattiva “Scala da basket”.';
  }
  if (form.billing_type === 'tm' && form.exclude_from_actuals) {
    errors.billingType = 'Un progetto Time & Material non può essere escluso dai consuntivi: disattiva “Escludi dai consuntivi”.';
  }
  if (form.parent_project_id !== '' && (form.billing_type !== 'tm' || form.scala_da_basket)) {
    errors.parentProject = 'Un sotto progetto deve essere Time & Material e non può scalare da basket.';
  }
  return errors;
}

export function validateTaskForm(form: TaskFormState): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (form.planned_start && form.planned_end && form.planned_end < form.planned_start) {
    errors.plannedEnd = 'La data di fine non può essere precedente alla data di inizio.';
  }
  if (isNegative(form.estimated_days)) errors.estimatedDays = 'I giorni stimati non possono essere negativi.';
  return errors;
}

export const hasErrors = (errors: object): boolean => Object.values(errors).some(Boolean);

/** `diff` = somma task − stima progetto; `null` se la stima non è impostata. */
export function estimateComparison(estimateDays: string, tasks: TaskFormsState): { taskTotal: number; diff: number | null } {
  const taskTotal = Object.values(tasks)
    .filter((task): task is TaskFormState => !!task?.enabled)
    .reduce((sum, task) => sum + (Number(task.estimated_days) || 0), 0);
  return { taskTotal, diff: estimateDays === '' ? null : taskTotal - Number(estimateDays) };
}

type ParentCandidate = Pick<Project, 'id' | 'name' | 'billing_type' | 'is_virtual' | 'parent_project_id'>;

/** Padri ammessi: progetti T&M reali e senza padre, escluso il progetto corrente, per nome. */
export function parentCandidates<T extends ParentCandidate>(projects: readonly T[], currentId: number | null): T[] {
  return projects
    .filter(p => p.billing_type === 'tm' && !p.is_virtual && p.parent_project_id == null && p.id !== currentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

/** Dati iniziali di un nuovo sotto progetto: eredita dal padre i campi commerciali, sempre T&M. */
export function subprojectSeed(
  parentId: number,
  parent: Pick<ProjectForm, 'area' | 'societa' | 'pm_riferimento_cliente' | 'codice_offerta'>,
): Partial<Project> {
  return {
    parent_project_id: parentId,
    area: parent.area || undefined,
    societa: parent.societa || undefined,
    pm_riferimento_cliente: parent.pm_riferimento_cliente || undefined,
    codice_offerta: parent.codice_offerta || undefined,
    billing_type: 'tm',
  };
}
