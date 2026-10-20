import type { Project } from '../types';

/** Consuntivato su stimato, in percentuale intera, mai negativa. Oltre 100 = sforamento. */
export function completionPct(p: Pick<Project, 'total_estimated_days' | 'total_actual_days'>): number {
  if (!p.total_estimated_days || !Number.isFinite(p.total_estimated_days) || p.total_estimated_days < 0) return 0;
  const ratio = ((p.total_actual_days ?? 0) / p.total_estimated_days) * 100;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.round(ratio));
}

export interface SidebarProject {
  id: number;
  name: string;
  icon: string | null;
  pct: number;
}

export const SIDEBAR_PROJECT_LIMIT = 6;

/** Progetti mostrati in sidebar: reali, in lavorazione, in ordine alfabetico. */
export function sidebarProjects(projects: readonly Project[], limit = SIDEBAR_PROJECT_LIMIT): SidebarProject[] {
  return projects
    .filter(p => !p.is_virtual && p.status === 'in lavorazione')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))
    .slice(0, limit)
    .map(p => ({ id: p.id, name: p.name, icon: p.icon ?? null, pct: completionPct(p) }));
}

/** Tacche (0–4) del mini-indicatore in sidebar. */
export function signalLevel(pct: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(4, Math.ceil(pct / 25)) as 1 | 2 | 3 | 4;
}
