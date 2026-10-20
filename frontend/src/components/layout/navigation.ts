import type { AppRole, User } from '../../types';

export const WORKSPACE_IDS = ['member', 'pm', 'admin'] as const;
export type WorkspaceId = typeof WORKSPACE_IDS[number];

export type NavigationIcon =
  | 'dashboard'
  | 'timeline'
  | 'time'
  | 'projects'
  | 'planning'
  | 'tasks'
  | 'people'
  | 'settings'
  | 'kpi'
  | 'basket'
  | 'tm'
  | 'business'
  | 'logout';

export interface NavigationItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: NavigationIcon;
  badge?: 'overdue_wbs' | 'overcapacity_persons' | 'tm_plafond_projects';
  mobile?: boolean;
}

export const ALL_TEAMS_SECTION_KEY = 'all-teams';

export interface NavigationSection {
  key: WorkspaceId | typeof ALL_TEAMS_SECTION_KEY;
  label: string;
  items: readonly NavigationItem[];
}

export const WORKSPACE_LABELS: Record<WorkspaceId, string> = {
  member: 'Membro',
  pm: 'PM / Team lead',
  admin: 'Admin',
};

export const WORKSPACE_LANDING: Record<WorkspaceId, string> = {
  member: '/consuntivazione',
  pm: '/timeline-team',
  admin: '/admin/team',
};

export const NAVIGATION_BY_WORKSPACE: Record<WorkspaceId, readonly NavigationItem[]> = {
  member: [
    { to: '/consuntivazione', label: 'Consuntivazione', shortLabel: 'Ore', icon: 'time', mobile: true },
    { to: '/miei-task', label: 'I miei task', shortLabel: 'Task', icon: 'tasks', badge: 'overdue_wbs', mobile: true },
    // Visibile a tutti; il badge resta 0 per il member perché /api/alerts è PM+.
    { to: '/planning', label: 'Planning', shortLabel: 'Planning', icon: 'planning', badge: 'overcapacity_persons', mobile: true },
  ],
  pm: [
    { to: '/dashboard', label: 'Dashboard', shortLabel: 'Dashboard', icon: 'dashboard' },
    { to: '/timeline-team', label: 'Timeline team', shortLabel: 'Timeline', icon: 'timeline', mobile: true },
    { to: '/progetti', label: 'Progetti', shortLabel: 'Progetti', icon: 'projects', mobile: true },
    { to: '/admin/dashboard', label: 'KPI ed economia', icon: 'kpi' },
    { to: '/basket', label: 'Basket giornate', shortLabel: 'Basket', icon: 'basket' },
    { to: '/time-material', label: 'Time & Material', shortLabel: 'T&M', icon: 'tm', badge: 'tm_plafond_projects' },
  ],
  admin: [
    { to: '/admin/team', label: 'Team', shortLabel: 'Team', icon: 'people', mobile: true },
    { to: '/admin/progetti', label: 'Configurazione progetti', shortLabel: 'Config.', icon: 'projects', mobile: true },
    { to: '/admin/opzioni', label: 'Opzioni', shortLabel: 'Opzioni', icon: 'settings', mobile: true },
  ],
};

/** Voci del super-admin: anagrafica globale, fuori dal perimetro del team. */
export const PLATFORM_NAVIGATION: readonly NavigationItem[] = [
  { to: '/admin/persone', label: 'Persone (piattaforma)', shortLabel: 'Persone', icon: 'people' },
];

/** Modalità Tutti i Team, per il manager e il super-admin: Business Unit compare solo qui, sotto Team, Planning e Progetti.
 *  Il backend resta l'autorità (/api/bu/**). */
export const ALL_TEAMS_NAVIGATION: readonly NavigationItem[] = [
  { to: '/tutti/team', label: 'Team', shortLabel: 'Team', icon: 'people', mobile: true },
  { to: '/tutti/planning', label: 'Planning', shortLabel: 'Planning', icon: 'planning', mobile: true },
  { to: '/tutti/progetti', label: 'Progetti', shortLabel: 'Progetti', icon: 'projects' },
  { to: '/tutti/kpi', label: 'KPI ed economia', icon: 'kpi' },
  { to: '/business-unit', label: 'Business Unit', shortLabel: 'BU', icon: 'business', mobile: true },
];

export const ALL_TEAMS_LABEL = 'Tutti i Team';
export const ALL_TEAMS_LANDING = '/business-unit';

export interface NavigationOptions {
  platformAdmin?: boolean;
  /** Manager o super-admin: abilitati alla modalità Tutti i Team. */
  businessUnit?: boolean;
  /** Modalità Tutti i Team attiva: sostituisce la navigazione del team. */
  allTeams?: boolean;
}

export function navigationOptionsFor(user: Pick<User, 'platformAdmin' | 'manager' | 'allTeams'>): NavigationOptions {
  return {
    platformAdmin: user.platformAdmin,
    businessUnit: user.manager || user.platformAdmin,
    allTeams: user.allTeams === true,
  };
}

export const NAVIGATION_SECTION_LABELS: Record<WorkspaceId, string> = {
  member: 'Il mio lavoro',
  pm: 'Team e progetti',
  admin: 'Amministrazione',
};

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

const ROLE_RANK: Record<AppRole, number> = { member: 0, pm: 1, admin: 2 };

/** Il workspace è derivato dal ruolo server-side, mai scelto dall'utente. */
export function workspaceForRole(role: AppRole): WorkspaceId {
  return role;
}

/** Navigazione cumulativa: un ruolo vede le proprie voci più quelle di
 *  tutti i ruoli inferiori. Le voci sono deduplicate per route, in ordine
 *  member → pm → admin. */
export function navigationForRole(role: AppRole, options: NavigationOptions = {}): readonly NavigationItem[] {
  return navigationSectionsForRole(role, options).flatMap(section => section.items);
}

function itemsFor(workspace: WorkspaceId, options: NavigationOptions): readonly NavigationItem[] {
  const items = NAVIGATION_BY_WORKSPACE[workspace];
  if (workspace === 'admin' && options.platformAdmin) return [...items, ...PLATFORM_NAVIGATION];
  return items;
}

export function navigationSectionsForRole(role: AppRole, options: NavigationOptions = {}): readonly NavigationSection[] {
  if (options.allTeams && options.businessUnit) {
    return [{ key: ALL_TEAMS_SECTION_KEY, label: ALL_TEAMS_LABEL, items: ALL_TEAMS_NAVIGATION }];
  }
  const maxRank = ROLE_RANK[role];
  return WORKSPACE_IDS
    .filter(workspace => ROLE_RANK[workspace] <= maxRank)
    .map(workspace => ({
      key: workspace,
      label: NAVIGATION_SECTION_LABELS[workspace],
      items: itemsFor(workspace, options),
    }))
    .filter(section => section.items.length > 0);
}

export function mobileNavigationFor(role: AppRole, options: NavigationOptions = {}): readonly NavigationItem[] {
  return navigationForRole(role, options).filter(item => item.mobile).slice(0, 3);
}

/** Landing del ruolo: dove parte la navigazione di quel ruolo. */
export function landingForRole(role: AppRole): string {
  return WORKSPACE_LANDING[workspaceForRole(role)];
}

export const READ_ONLY_WORKSPACE_LABEL = 'Manager (sola lettura)';
export const ALL_TEAMS_WORKSPACE_LABEL = 'Manager';

/** Etichetta del workspace: per un team in sola lettura il ruolo del manager, non quello di team. */
export function workspaceLabelFor(role: AppRole, readOnly = false, allTeams = false): string {
  if (allTeams) return ALL_TEAMS_WORKSPACE_LABEL;
  return readOnly ? READ_ONLY_WORKSPACE_LABEL : WORKSPACE_LABELS[workspaceForRole(role)];
}
