import { createSessionRefresher, fetchWithSessionRefresh } from './auth/sessionRefresh.ts';
import type { Person, Project, ProjectTask, TaskAllocation, TimeEntry, TimelineEntry, WeekGroup, KPIData, GlobalKPI, SelectableProject, AllocationWeekEntry, WbsItem, WbsPersonTask, WbsPlanningItem, WbsProgressPatch, ProjectEvData, AlertsData, TaskDependency, DashboardEconomicResponse, DashboardMonthlyRow, DashboardProject, DashboardWbsStatus, OptionValue, OptionKind, PartnerAllocation, ProjectExtension, BasketSummary, BasketMovement, AuthMeResponse, AuthLoginResponse, AuthChangePasswordResponse, ScheduleData, BacklogItem, TimeOffEntry, TimeOffType, RangeRow, TmProject, AppRole, PlatformPerson, TeamMember, TeamSummary, TeamInvite, BuPerson, BuProjectAllocation, BuTeam, BuProject, BuKpi, SetPhasesRequest} from './types.ts';
import { buildHeaders, isTeamAccessError, TEAM_ACCESS_EVENT } from './auth/teamHeader.ts';

const BASE = '/api';

/** Dispatched when the session is gone (expired/revoked and not
 *  refreshable). AuthProvider listens and resets to `anonymous`, which
 *  makes RequireAuth route back to /login. */
export const UNAUTHORIZED_EVENT = 'project-tracker:unauthorized';

let activeTeamId: number | 'all' | null = null;

/** Team (o 'all' in Tutti i Team) inviato in X-Team-Id: AuthProvider lo imposta prima che le pagine facciano fetch. */
export function setActiveTeamHeader(teamId: number | 'all' | null): void {
  activeTeamId = teamId;
}

export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, code: string | null, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Rinnovo sessione: i cookie portano tutto, niente body. Un 401 qui è
 *  SESSION_EXPIRED; essendo un endpoint /auth non può mai innescare un
 *  altro refresh. */
export const refresh = () => request<AuthMeResponse>('/auth/refresh', { method: 'POST' });

// Single-flight: un solo refresh per ciclo, condiviso tra tutte le richieste
// 401 concorrenti; al fallimento UNAUTHORIZED_EVENT viene emesso una sola volta.
// Il refresh usa una fetch DIRETTA (non request()): il ciclo non può mai
// rientrare nella macchina di refresh, quindi la ricorsione è
// strutturalmente impossibile anche se isAuthUrl dovesse regredire.
const refreshSession = createSessionRefresher({
  refresh: async () => {
    const res = await fetch(BASE + '/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new ApiError('SESSION_EXPIRED', 'SESSION_EXPIRED', res.status);
  },
  onSessionExpired: () => window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)),
});

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string; message?: string } | null;
    if (isTeamAccessError(res.status, body?.error ?? null, activeTeamId)) window.dispatchEvent(new Event(TEAM_ACCESS_EVENT));
    throw new ApiError(body?.message ?? body?.error ?? res.statusText, body?.error ?? null, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithSessionRefresh(url, options, {
      fetchImpl: (path, init) =>
        fetch(BASE + path, {
          credentials: 'include',
          ...init,
          headers: buildHeaders(activeTeamId, init?.headers),
        }),
      // Gli endpoint /auth/* rispondono 401 come parte del loro protocollo
      // (credenziali errate, sessione scaduta): li gestisce il chiamante,
      // quindi sono esclusi dal refresh automatico — nessuna ricorsione.
      isAuthUrl: (path) => path.startsWith('/auth/'),
      refresh: refreshSession,
      onUnauthorized: () => window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)),
    });
  } catch {
    throw new ApiError('Errore di rete', 'NETWORK', 0);
  }
  return parseResponse<T>(res);
}

// Persons (membri del team attivo)
export const getPersons = () => request<Person[]>('/persons');

// Anagrafica di piattaforma (solo super-admin)
export const getPlatformPersons = () => request<PlatformPerson[]>('/platform/persons');
export const createPlatformPerson = (data: Partial<PlatformPerson>) =>
  request<PlatformPerson>('/platform/persons', { method: 'POST', body: JSON.stringify(data) });
export const updatePlatformPerson = (id: number, data: Partial<PlatformPerson>) =>
  request<PlatformPerson>(`/platform/persons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePlatformPerson = (id: number) =>
  request<{ success: boolean }>(`/platform/persons/${id}`, { method: 'DELETE' });

// Team
export const getMyTeams = () => request<TeamSummary[]>('/me/teams');
export const createTeam = (name: string) =>
  request<TeamSummary>('/teams', { method: 'POST', body: JSON.stringify({ name }) });
export const renameTeam = (teamId: number, name: string) =>
  request<TeamSummary>(`/teams/${teamId}`, { method: 'PUT', body: JSON.stringify({ name }) });
export const getMyInvites = () => request<TeamInvite[]>('/me/invites');
export const acceptInvite = (teamId: number, role: AppRole) =>
  request<TeamSummary>(`/me/invites/${teamId}/accept`, { method: 'POST', body: JSON.stringify({ role }) });
export const declineInvite = (teamId: number) =>
  request<{ success: boolean }>(`/me/invites/${teamId}/decline`, { method: 'POST' });
export const getTeamMembers = (teamId: number) => request<TeamMember[]>(`/teams/${teamId}/members`);
export const addTeamMember = (teamId: number, data: { email: string; role: AppRole }) =>
  request<TeamMember>(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(data) });
export const updateTeamMemberRole = (teamId: number, personId: number, role: AppRole) =>
  request<TeamMember>(`/teams/${teamId}/members/${personId}`, { method: 'PUT', body: JSON.stringify({ role }) });
export const removeTeamMember = (teamId: number, personId: number) =>
  request<{ success: boolean }>(`/teams/${teamId}/members/${personId}`, { method: 'DELETE' });

// Options (catalogo valori progetto)
export const getOptions = (kind: OptionKind) => request<OptionValue[]>(`/options?kind=${kind}`);
export const createOption = (kind: OptionKind, value: string) =>
  request<OptionValue>('/options', { method: 'POST', body: JSON.stringify({ kind, value }) });
export const updateOption = (id: number, value: string) =>
  request<OptionValue>(`/options/${id}`, { method: 'PUT', body: JSON.stringify({ value }) });
export const deleteOption = (id: number) =>
  request<{ success: boolean }>(`/options/${id}`, { method: 'DELETE' });

// Projects
export const getProjects = (includeVirtual = false) =>
  request<Project[]>(`/projects${includeVirtual ? '?include_virtual=1' : ''}`);
export const getSelectableProjects = () => request<SelectableProject[]>('/projects/selectable');
export const createProject = (data: Partial<Project>) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: number, data: Partial<Project>) =>
  request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id: number) =>
  request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' });
export const getProject = (id: number) => request<Project>(`/projects/${id}`);
export const cloneProject = (id: number, name: string) =>
  request<Project>(`/projects/${id}/clone`, { method: 'POST', body: JSON.stringify({ name }) });
export const setProjectPhases = (id: number, body: SetPhasesRequest) =>
  request<{ uses_phases: boolean; task_id?: number }>(`/projects/${id}/phases`, { method: 'PUT', body: JSON.stringify(body) });

// Giornate altri partner
export const getPartnerAllocations = (projectId: number) =>
  request<PartnerAllocation[]>(`/project-partner-allocations?project_id=${projectId}`);
export const createPartnerAllocation = (data: { project_id: number; societa: string; giornate: number }) =>
  request<PartnerAllocation>('/project-partner-allocations', { method: 'POST', body: JSON.stringify(data) });
export const updatePartnerAllocation = (id: number, data: { societa: string; giornate: number }) =>
  request<PartnerAllocation>(`/project-partner-allocations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePartnerAllocation = (id: number) =>
  request<{ success: boolean }>(`/project-partner-allocations/${id}`, { method: 'DELETE' });

// Estensioni / offerte successive
export const getProjectExtensions = (projectId: number) =>
  request<ProjectExtension[]>(`/project-extensions?project_id=${projectId}`);
export const createProjectExtension = (data: Omit<ProjectExtension, 'id' | 'created_at'>) =>
  request<ProjectExtension>('/project-extensions', { method: 'POST', body: JSON.stringify(data) });
export const updateProjectExtension = (id: number, data: Omit<ProjectExtension, 'id' | 'created_at'>) =>
  request<ProjectExtension>(`/project-extensions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProjectExtension = (id: number) =>
  request<{ success: boolean }>(`/project-extensions/${id}`, { method: 'DELETE' });

// Time & Material
export const getTmBilling = (from: string, to: string) =>
  request<TmProject[]>(`/tm-billing?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
export const closeTmMonth = (projectId: number, month: string) =>
  request<{ month: string; man_days: number; daily_rate: number; amount: number }>(
    `/tm-billing/${projectId}/${encodeURIComponent(month)}/close`, { method: 'POST' });
export const reopenTmMonth = (projectId: number, month: string) =>
  request<{ success: boolean }>(`/tm-billing/${projectId}/${encodeURIComponent(month)}`, { method: 'DELETE' });

// Basket giornate
export const getBaskets = () => request<BasketSummary[]>('/baskets');
export const createBasket = (name: string) =>
  request<BasketSummary>('/baskets', { method: 'POST', body: JSON.stringify({ name }) });
export const createBasketMovement = (data: {
  basket: string;
  movement_date: string;
  azione: string;
  attivita?: string;
  giornate: number;
  stato_lavori?: string;
  note?: string;
}) => request<BasketMovement>('/baskets/movements', { method: 'POST', body: JSON.stringify(data) });
export const deleteBasketMovement = (id: number) =>
  request<{ success: boolean }>(`/baskets/movements/${id}`, { method: 'DELETE' });

// Tasks
export const getProjectTasks = (projectId: number) =>
  request<ProjectTask[]>(`/projects/${projectId}/tasks`);
export const createTask = (projectId: number, data: Partial<ProjectTask>) =>
  request<ProjectTask>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) });
export const updateTask = (id: number, data: Partial<ProjectTask>) =>
  request<ProjectTask>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTask = (id: number) =>
  request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' });

// Allocations
export const upsertAllocation = (taskId: number, data: { person_id: number; estimated_days: number; replace?: boolean }) =>
  request<TaskAllocation>(`/tasks/${taskId}/allocations`, { method: 'POST', body: JSON.stringify(data) });
export const deleteAllocation = (taskId: number, personId: number) =>
  request<{ success: boolean }>(`/tasks/${taskId}/allocations/${personId}`, { method: 'DELETE' });

// Task dependencies
export const addTaskDependency = (successorTaskId: number, predecessorTaskId: number) =>
  request<TaskDependency>(`/tasks/${successorTaskId}/dependencies`, {
    method: 'POST',
    body: JSON.stringify({ predecessor_task_id: predecessorTaskId })
  });
export const deleteTaskDependency = (depId: number) =>
  request<{ success: boolean }>(`/tasks/dependencies/${depId}`, { method: 'DELETE' });

// Time entries
export const getTimeEntries = (params: { person_id?: number; week_start?: string }) => {
  const qs = new URLSearchParams();
  if (params.person_id) qs.set('person_id', String(params.person_id));
  if (params.week_start) qs.set('week_start', params.week_start);
  return request<TimeEntry[]>(`/time-entries?${qs}`);
};
export const getWeekEntries = (person_id: number, week_start: string) =>
  request<WeekGroup[]>(`/time-entries/week?person_id=${person_id}&week_start=${week_start}`);
export const getRangeEntries = (person_id: number, from: string, to: string) =>
  request<RangeRow[]>(`/time-entries/range?person_id=${person_id}&from=${from}&to=${to}`);
export const upsertTimeEntry = (data: {
  person_id: number;
  task_id: number;
  week_start: string;
  man_days: number;
  notes?: string;
  wbs_item_id?: number;
}) => request<TimeEntry>('/time-entries', { method: 'POST', body: JSON.stringify(data) });
export const deleteTimeEntry = (id: number) =>
  request<{ success: boolean }>(`/time-entries/${id}`, { method: 'DELETE' });

// Dashboard
export const getProjectKPI = (project_id: number) =>
  request<KPIData>(`/dashboard/kpi?project_id=${project_id}`);
export const getGlobalKPI = () => request<GlobalKPI>('/dashboard/global');
export const getDashboardWbsStatus = () => request<DashboardWbsStatus>('/dashboard/wbs-status');
export const getDashboardMonthly = (months = 4) => request<DashboardMonthlyRow[]>(`/dashboard/monthly?months=${months}`);
export const getDashboardProjects = () => request<DashboardProject[]>('/dashboard/projects');
export const getProjectEv = (projectId: number) =>
  request<ProjectEvData>(`/dashboard/ev?project_id=${projectId}`);
export const getEconomicData = (projectId?: number) =>
  request<DashboardEconomicResponse>(`/dashboard/economic${projectId ? `?project_id=${projectId}` : ''}`);

// WBS
export const getWbsItems = (projectId: number) =>
  request<WbsItem[]>(`/wbs?project_id=${projectId}`);
export const getWbsItemsByPerson = (personId: number) =>
  request<WbsPersonTask[]>(`/wbs/by-person/${personId}`);
export const createWbsItem = (data: Partial<WbsItem>) =>
  request<WbsItem>('/wbs', { method: 'POST', body: JSON.stringify(data) });
export const updateWbsItem = (id: number, data: Partial<WbsItem>) =>
  request<WbsItem>(`/wbs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteWbsItem = (id: number) =>
  request<{ success: boolean }>(`/wbs/${id}`, { method: 'DELETE' });

/** Perimetro autorizzato intero: i filtri della board sono client-side. */
export const getPlanningWbs = () =>
  request<WbsPlanningItem[]>('/wbs/planning');
export const patchWbsProgress = (id: number, patch: WbsProgressPatch) =>
  request<WbsPlanningItem>(`/wbs/${id}/progress`, { method: 'PATCH', body: JSON.stringify(patch) });

// Alerts
export const getAlerts = () => request<AlertsData>('/alerts');

// Allocation weeks
export const getAllocationWeeks = (projectId: number, month: string) =>
  request<AllocationWeekEntry[]>(`/allocation-weeks?project_id=${projectId}&month=${month}`);
export const getAllocationTotals = (projectId: number) =>
  request<{ task_allocation_id: number; total_days: number }[]>(`/allocation-weeks/totals?project_id=${projectId}`);
export const upsertAllocationWeek = (payload: {
  task_allocation_id: number;
  week_start: string;
  man_days: number;
  tentative?: boolean;
}) => request<{ id: number; man_days: number; tentative: boolean } | { deleted: boolean }>(
  '/allocation-weeks/upsert',
  { method: 'POST', body: JSON.stringify(payload) },
);

export const getSchedule = (from: string, to: string) =>
  request<ScheduleData>(`/schedule?from=${from}&to=${to}`);

export const getScheduleBacklog = () => request<BacklogItem[]>('/schedule/backlog');

export interface TimeOffPayload {
  person_id: number;
  start_date: string;
  end_date: string;
  type: TimeOffType;
  tentative: boolean;
  notes: string | null;
}

export const createTimeOff = (payload: TimeOffPayload) =>
  request<TimeOffEntry>('/time-off', { method: 'POST', body: JSON.stringify(payload) });

export const updateTimeOff = (id: number, payload: TimeOffPayload) =>
  request<TimeOffEntry>(`/time-off/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

export const deleteTimeOff = (id: number) =>
  request<void>(`/time-off/${id}`, { method: 'DELETE' });

export const getTimelineTeam = (
  year: number,
  personIds: number[] = [],
  projectIds: number[] = [],
  societa: string[] = []
) => {
  const params = new URLSearchParams({ year: String(year) });
  if (personIds.length)  params.set('person_ids',  personIds.join(','));
  if (projectIds.length) params.set('project_ids', projectIds.join(','));
  if (societa.length)    params.set('societa',     societa.join(','));
  return request<TimelineEntry[]>(`/time-entries/timeline?${params.toString()}`);
};

// Auth — sessione gestita dal backend. I cookie sono impostati dal server;
// il frontend invia solo `credentials: 'include'` e non legge mai token.

export const getMe = () => request<AuthMeResponse>('/auth/me');

export const login = (email: string, password: string) =>
  request<AuthLoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const changePassword = (email: string, session: string, newPassword: string) =>
  request<AuthChangePasswordResponse>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ email, session, newPassword }),
  });

export const logout = () => request<void>('/auth/logout', { method: 'POST' });

// Business Unit (manager e super-admin)
export const getBuPeople = (from: string, weeks: number) =>
  request<BuPerson[]>(`/bu/people?from=${from}&weeks=${weeks}`);
export const getBuPersonAllocations = (personId: number, from: string, weeks: number) =>
  request<BuProjectAllocation[]>(`/bu/people/${personId}/allocations?from=${from}&weeks=${weeks}`);
export const getBuTeams = () => request<BuTeam[]>('/bu/teams');
export const getBuProjects = () => request<BuProject[]>('/bu/projects');
export const getBuKpi = () => request<BuKpi>('/bu/kpi');
