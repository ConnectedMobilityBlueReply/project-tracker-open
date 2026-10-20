import type { AppRole } from '../types';

export interface RouteAccessEntry {
  path: string;
  minimumRole: AppRole;
}

/** The complete protected route contract. Keep this table explicit: it is
 * intentionally independent from the presentation navigation. */
export const ROUTE_ACCESS: readonly RouteAccessEntry[] = [
  { path: '/', minimumRole: 'member' },
  { path: '/consuntivazione', minimumRole: 'member' },
  { path: '/miei-task', minimumRole: 'member' },
  { path: '/schedule', minimumRole: 'member' },
  { path: '/planning', minimumRole: 'member' },
  { path: '/planning/table', minimumRole: 'member' },
  { path: '/planning/gantt', minimumRole: 'member' },
  { path: '/planning/kanban', minimumRole: 'member' },
  { path: '/planning/capacita', minimumRole: 'pm' },
  { path: '/dashboard', minimumRole: 'pm' },
  { path: '/timeline-team', minimumRole: 'pm' },
  { path: '/progetti', minimumRole: 'pm' },
  { path: '/progetti/:id', minimumRole: 'pm' },
  { path: '/progetti/:id/task', minimumRole: 'pm' },
  { path: '/progetti/:id/wbs', minimumRole: 'pm' },
  { path: '/pianificazione', minimumRole: 'member' },
  { path: '/allocazioni', minimumRole: 'member' },
  { path: '/admin/dashboard', minimumRole: 'pm' },
  { path: '/basket', minimumRole: 'pm' },
  { path: '/time-material', minimumRole: 'pm' },
  { path: '/business-unit', minimumRole: 'pm' },
  { path: '/tutti/team', minimumRole: 'pm' },
  { path: '/tutti/planning', minimumRole: 'pm' },
  { path: '/tutti/progetti', minimumRole: 'pm' },
  { path: '/tutti/kpi', minimumRole: 'pm' },
  { path: '/admin/team', minimumRole: 'admin' },
  { path: '/admin/persone', minimumRole: 'admin' },
  { path: '/admin/progetti', minimumRole: 'admin' },
  { path: '/admin/progetti/:id', minimumRole: 'pm' },
  { path: '/admin/opzioni', minimumRole: 'admin' },
  { path: '/impostazioni', minimumRole: 'member' },
  { path: '/impostazioni/aggiornamenti', minimumRole: 'member' },
];

export const PUBLIC_ROUTES = ['/login', '/change-password'] as const;

const ROLE_RANK: Record<AppRole, number> = { member: 0, pm: 1, admin: 2 };

export function roleAtLeast(role: AppRole, minimum: AppRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

function normalizePath(pathname: string): string {
  const collapsed = pathname.replace(/\/+/g, '/');
  if (collapsed === '/') return collapsed;
  return collapsed.replace(/\/+$/, '') || '/';
}

function matchesRoute(pattern: string, pathname: string): boolean {
  const patternParts = normalizePath(pattern).toLocaleLowerCase().split('/').filter(Boolean);
  const pathParts = normalizePath(pathname).toLocaleLowerCase().split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return patternParts.length === 0 && pathParts.length === 0;
  return patternParts.every((part, index) => part.startsWith(':') || part === pathParts[index]);
}

export function minimumRoleForPath(pathname: string): AppRole | null {
  return ROUTE_ACCESS.find(route => matchesRoute(route.path, pathname))?.minimumRole ?? null;
}

export function isPublicRoute(pathname: string): boolean {
  const normalized = normalizePath(pathname).toLocaleLowerCase();
  return PUBLIC_ROUTES.some(route => normalizePath(route).toLocaleLowerCase() === normalized);
}
