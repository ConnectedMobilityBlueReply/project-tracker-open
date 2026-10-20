import type { Project } from '../types';

export interface ProjectCreateForm {
  name: string;
  societa: string;
  area: string;
  pm: string;
  estimate_days: string;
  description: string;
}

export const EMPTY_PROJECT_FORM: ProjectCreateForm = {
  name: '', societa: '', area: '', pm: '', estimate_days: '', description: '',
};

export type ProjectCreateErrors = Partial<Record<'name' | 'estimate_days', string>>;

/** Solo UX: il backend rivalida (`ProjectsController.create`). */
export function validateProjectForm(form: ProjectCreateForm): ProjectCreateErrors {
  const errors: ProjectCreateErrors = {};
  if (!form.name.trim()) errors.name = 'Il nome è obbligatorio';
  if (form.estimate_days.trim() !== '') {
    const days = Number(form.estimate_days);
    if (!Number.isFinite(days) || days < 0) errors.estimate_days = 'La stima deve essere un numero ≥ 0';
  }
  return errors;
}

/** Da chiamare solo dopo validateProjectForm senza errori. */
export function toCreatePayload(form: ProjectCreateForm): Partial<Project> {
  const estimate = form.estimate_days.trim();
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    societa: form.societa || undefined,
    area: form.area || undefined,
    pm_riferimento_cliente: form.pm || undefined,
    estimate_days: estimate === '' ? undefined : Number(estimate),
  };
}
