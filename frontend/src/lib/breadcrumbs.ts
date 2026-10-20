import type { AppRole } from '../types';
import { isNavigationItemActive, navigationForRole } from '../components/layout/navigation.ts';

export interface Crumb {
  label: string;
  to?: string;
}

function detailLabel(pathname: string): string {
  if (pathname === '/planning/table') return 'Table';
  if (pathname === '/planning/gantt') return 'Gantt';
  if (pathname === '/planning/kanban') return 'Kanban';
  if (pathname === '/planning/capacita') return 'Capacità';
  if (pathname.endsWith('/task')) return 'Task';
  if (pathname.endsWith('/wbs')) return 'WBS';
  return 'Dettaglio';
}

/** Briciole della barra contenuto, derivate dalla navigazione del ruolo. */
export function breadcrumbFor(pathname: string, role: AppRole): Crumb[] {
  // Le pagine Tutti i Team non sono nella navigazione del team: si cercano in entrambe.
  const item = [
    ...navigationForRole(role, { businessUnit: true }),
    ...navigationForRole(role, { businessUnit: true, allTeams: true }),
  ]
    .filter(candidate => isNavigationItemActive(candidate, pathname))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (!item) return [];
  if (pathname === item.to) return [{ label: item.label }];
  return [{ label: item.label, to: item.to }, { label: detailLabel(pathname) }];
}
