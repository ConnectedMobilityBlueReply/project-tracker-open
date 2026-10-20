export type TaskType = 'AF' | 'AT' | 'DEV' | 'SIT' | 'UAT' | 'GEN';

export const PROJECT_STATUS_OPTIONS = ['da lavorare', 'in lavorazione', 'concluso', 'lavorato a consuntivo'] as const;

export const timeEntryKey = (taskId: number, wbsItemId: number | null): string =>
  `${taskId}_${wbsItemId ?? 'null'}`;
export const TASK_TYPES: TaskType[] = ['AF', 'AT', 'DEV', 'SIT', 'UAT']; // GEN escluso dall'admin
export const TASK_LABELS: Record<TaskType, string> = {
  AF: 'Analisi Funzionale',
  AT: 'Analisi Tecnica',
  DEV: 'Sviluppo',
  SIT: 'SIT/FUN',
  UAT: 'UAT',
  GEN: 'Ore'
};

export const TASK_COLORS: Record<TaskType, string> = {
  AF: 'var(--chart-1)',
  AT: 'var(--chart-2)',
  DEV: 'var(--chart-3)',
  SIT: 'var(--chart-4)',
  UAT: 'var(--chart-5)',
  GEN: 'var(--chart-6)'
};

export interface SelectableProject {
  id: number;
  name: string;
  is_virtual: number;
  tasks: {
    id: number;
    project_id: number;
    task_type: string;
    status: string;
    wbs_items: { id: number; name: string; status: string }[];
  }[];
  /** false = progetto senza fasi: si consuntiva sul solo GEN, senza scegliere l'attività. Assente = con fasi. */
  uses_phases?: boolean;
}

export interface Person {
  id: number;
  name: string;
  email?: string;
  role?: string;
  weekly_capacity_days: number;
  created_at: string;
}

export const WBS_STATUS_OPTIONS = ['aperto', 'in_corso', 'chiuso'] as const;
export type WbsStatus = typeof WBS_STATUS_OPTIONS[number];

export const WBS_STATUS_LABELS: Record<WbsStatus, string> = {
  aperto:   'Aperto',
  in_corso: 'In corso',
  chiuso:   'Chiuso',
};

export const WBS_PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const;
export type WbsPriority = typeof WBS_PRIORITY_OPTIONS[number];

export const WBS_PRIORITY_LABELS: Record<WbsPriority, string> = {
  low:    'Bassa',
  medium: 'Media',
  high:   'Alta',
};

export interface WbsItem {
  id: number;
  task_id: number;
  task_type: string;
  name: string;
  description?: string;
  estimated_days: number;
  effort_days?: number;
  completion_pct: number;
  status: WbsStatus;
  priority?: WbsPriority;
  planned_start?: string;
  planned_end?: string;
  assignee_person_id?: number | null;
  assignee_person_name?: string;
  created_at: string;
}

export interface WbsPersonTask extends WbsItem {
  project_id: number;
  project_name: string;
}

/** Riga della board Planning (`GET /api/wbs/planning`). Le date sono `yyyy-MM-dd` o null. */
export interface WbsPlanningItem {
  id: number;
  task_id: number;
  task_type: string;
  project_id: number;
  project_name: string;
  project_color: string | null;
  name: string;
  status: WbsStatus;
  priority: WbsPriority;
  completion_pct: number;
  planned_start?: string | null;
  planned_end?: string | null;
  assignee_person_id: number | null;
  assignee_person_name: string | null;
}

/** Body di `PATCH /api/wbs/{id}/progress`: solo i campi presenti vengono scritti. */
export interface WbsProgressPatch {
  status?: WbsStatus;
  completion_pct?: number;
  priority?: WbsPriority;
}

export interface AllocationWeekEntry {
  id: number;
  task_allocation_id: number;
  task_id: number;
  task_type: string;
  project_id: number;
  project_name: string;
  person_id: number;
  person_name: string;
  week_start: string;
  man_days: number;
}

export interface TaskAllocation {
  id: number;
  task_id: number;
  person_id: number;
  person_name: string;
  estimated_days: number;
}

export interface TaskDependency {
  id: number;
  predecessor_task_id: number;
  successor_task_id: number;
}

export interface ProjectTask {
  id: number;
  project_id: number;
  task_type: TaskType;
  planned_start?: string;
  planned_end?: string;
  estimated_days?: number;
  status: string;
  allocations: TaskAllocation[];
  actual_days?: number;
  dependencies?: TaskDependency[];
}

export interface ProjectChild {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  icon?: string | null;
  daily_rate?: number;
  billing_type?: BillingType;
  /** Progetto T&M padre; null/assente = progetto autonomo. */
  parent_project_id?: number | null;
  /** false = progetto senza fasi: ha il solo task GEN implicito. Assente = con fasi. */
  uses_phases?: boolean;
  /** Solo nel dettaglio: sotto progetti collegati, per nome. */
  children?: ProjectChild[];
  area?: string;
  pm_riferimento_cliente?: string;
  societa?: string;
  codice_offerta?: string;
  status_offerta?: string;
  is_virtual?: number;
  estimate_days?: number;
  status: string;
  created_at: string;
  start_date?: string;
  end_date?: string;
  total_estimated_days?: number;
  total_actual_days?: number;
  total_partner_days?: number;
  total_stima?: number;
  total_stima_own?: number;
  partner_detail?: string;
  partner_allocations?: PartnerAllocation[];
  scala_da_basket?: boolean;
  basket?: string | null;
  /** true = i giorni registrati non contano nei consuntivati (es. area Investimento). */
  exclude_from_actuals?: boolean;
  tasks?: ProjectTask[];
}

export interface TimeEntry {
  id: number;
  person_id: number;
  task_id: number;
  week_start: string;
  man_days: number;
  notes?: string;
  task_type?: TaskType;
  project_id?: number;
  project_name?: string;
}

export interface TimelineEntry {
  person_id: number;
  person_name: string;
  weekly_capacity_days: number;
  project_id: number;
  project_name: string;
  task_id: number;
  task_type: TaskType;
  week_start: string;
  man_days: number;
  entry_id: number | null;
  has_wbs: boolean;
}

export interface WeekGroup {
  project_id: number;
  project_name: string;
  tasks: {
    task_id: number;
    task_type: TaskType;
    estimated_days: number;
    entry_id: number | null;
    man_days: number;
    notes: string | null;
    total_man_days: number;
    is_extra: boolean;
    task_status: string;
    last_entry_week: string | null;
    planned_days: number;
    wbs_item_id: number | null;
    wbs_item_name: string | null;
    wbs_status: string | null;
    available_wbs_items: { id: number; name: string }[];
  }[];
}

export interface KPIData {
  project_id: number;
  project_name: string;
  estimate_days: number;
  tasks: {
    task_type: TaskType;
    allocated_days: number;
    actual_days: number;
    planned_start?: string;
    planned_end?: string;
    estimated_days?: number;
    completion_pct: number;
  }[];
  total_estimated: number;
  total_actual: number;
  total_completion_pct: number;
}

export interface EvCurvePoint {
  week: string;
  pv: number;
  ac: number;
  ev: number;
}

export interface ProjectEvData {
  budget_eur: number;
  ev_eur: number;
  ac_eur: number;
  cpi: number;
  spi: number;
  vac: number;
  curve: EvCurvePoint[];
}

export interface EconomicRow {
  project_name: string;
  task_type: TaskType;
  activity_name: string;
  status: WbsStatus;
  assigned_to: string | null;
  effort_days: number;
  estimated_days: number;
  remaining_days: number;
  efficiency: number;
  completion_pct: number;
  effort_eur: number;
  estimated_eur: number;
  remaining_eur: number;
  final_efficiency_eur: number | null;
}

export interface EconomicSummary {
  /** Assente se le righe filtrate appartengono a progetti con tariffe diverse. */
  rate_day?: number | null;
  activity_count: number;
  total_effort_days: number;
  total_estimated_days: number;
  total_remaining_days: number;
  total_effort_eur: number;
  total_estimated_eur: number;
  total_remaining_eur: number;
  avg_efficiency: number;
}

export interface DashboardEconomicResponse {
  rows: EconomicRow[];
  summary: EconomicSummary;
}

export interface AlertOverdueItem {
  id: number;
  name: string;
  planned_end: string;
  status: string;
  task_type: string;
  project_name: string;
  person_name: string | null;
}

export interface AlertsData {
  overdue_wbs: number;
  overcapacity_persons: number;
  tm_plafond_projects: number;
  overdue_list: AlertOverdueItem[];
}

export interface GlobalKPI {
  total_estimated: number;
  total_actual: number;
  total_completion_pct: number;
  projects: {
    id: number;
    name: string;
    estimate_days: number;
    status: string;
    total_estimated_days: number;
    total_actual_days: number;
    completion_pct: number;
  }[];
  breakdown_by_type: {
    task_type: TaskType;
    estimated_days: number;
    actual_days: number;
    completion_pct: number;
  }[];
}

export interface DashboardWbsStatus {
  aperto: number;
  in_corso: number;
  chiuso: number;
  total: number;
  projects: number;
}

export interface DashboardMonthlyRow {
  project_id: number;
  project_name: string;
  month: string;
  planned_days: number;
  actual_days: number;
}

export interface DashboardProjectTask {
  id: number;
  task_type: TaskType;
  planned_start: string | null;
  planned_end: string | null;
  status: string;
  estimated_days: number;
  actual_days: number;
}

export interface DashboardPerson {
  id: number;
  name: string;
}

export interface DashboardProject {
  id: number;
  name: string;
  status: string;
  societa: string | null;
  area: string | null;
  codice_offerta: string | null;
  icon: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_days: number;
  actual_days: number;
  tasks: DashboardProjectTask[];
  persons: DashboardPerson[];
}

export type OptionKind = 'societa' | 'area' | 'pm' | 'status_offerta' | 'partner';

export interface OptionValue {
  id: number;
  value: string;
}

export interface PartnerAllocation {
  id: number;
  project_id: number;
  societa: string;
  giornate: number;
}

export interface ProjectExtension {
  id: number;
  project_id: number;
  codice_offerta?: string;
  giornate: number;
  status_offerta?: string;
  created_at?: string;
}

export interface BasketMovement {
  id: number;
  basket: string;
  movement_date: string;
  azione: string;
  attivita: string | null;
  giornate: number;
  stato_lavori: string | null;
  note: string | null;
}

export interface BasketLinkedProject {
  project_id: number;
  project_name: string;
  period: string | null;
  consumo: number;
}

export interface BasketSummary {
  basket: string;
  movements: BasketMovement[];
  linked_projects: BasketLinkedProject[];
  totale: number;
  erogato: number;
  residuo: number;
}

// Auth — sessione gestita dal backend (cookie httpOnly). Il frontend non
// gestisce token: identità e ruolo arrivano dalle risposte /api/auth/*.

export type AppRole = 'member' | 'pm' | 'admin';

export interface TeamSummary {
  id: number;
  name: string;
  role: AppRole;
  /** Team di appoggio del manager: non si può entrare. */
  read_only?: boolean;
}

/** Risposta di /api/auth/*: la persona e i team che può vedere. */
export interface AuthAccount {
  personId: number;
  name: string;
  email: string;
  platformAdmin: boolean;
  manager: boolean;
  teams: TeamSummary[];
}

/** Utente nel team attivo (derivato da AuthAccount in AuthProvider). */
export interface User {
  personId: number;
  name: string;
  email: string;
  platformAdmin: boolean;
  manager: boolean;
  /** Team attivo in sola lettura (manager), o vista aggregata Tutti i Team. */
  readOnly: boolean;
  /** Modalità Tutti i Team (manager e super-admin): in Capacità il manager pianifica e assegna; le pagine BU sono in sola lettura. */
  allTeams: boolean;
  appRole: AppRole;
  teamId: number;
  teamName: string;
}

export interface AuthMeResponse {
  status: 'AUTHENTICATED';
  user: AuthAccount;
}

export type AuthLoginResponse =
  | { status: 'AUTHENTICATED'; user: AuthAccount }
  | { status: 'NEW_PASSWORD_REQUIRED'; session: string };

export interface AuthChangePasswordResponse {
  status: 'AUTHENTICATED';
  user: AuthAccount;
}

export interface TeamMember {
  person_id: number;
  name: string;
  email: string | null;
  role: AppRole;
  pending: boolean;
  /** Invito in attesa di accettazione: la persona non è ancora nel team. */
  invited: boolean;
}

/** Invito ricevuto (GET /api/me/invites). */
export interface TeamInvite {
  team_id: number;
  team_name: string;
  role: AppRole;
  invited_by_name: string | null;
  created_at: string;
}

export interface PlatformPerson {
  id: number;
  name: string;
  email: string | null;
  job_title: string | null;
  weekly_capacity_days: number;
  is_platform_admin: boolean;
  is_manager: boolean;
  pending: boolean;
  created_at: string;
}

// --- Schedule ---

export type TimeOffType = 'ferie' | 'permesso' | 'assenza';

export const TIME_OFF_TYPES: readonly TimeOffType[] = ['ferie', 'permesso', 'assenza'];

export interface SchedulePerson {
  id: number;
  name: string;
  job_title: string | null;
  team_id: number;
  weekly_capacity_days: number;
}

export interface ScheduleAllocation {
  id: number;
  task_allocation_id: number;
  task_id: number;
  task_type: string;
  project_id: number;
  project_name: string;
  basket: string | null;
  color: string | null;
  person_id: number;
  /** Lunedì della settimana, ISO `YYYY-MM-DD`. */
  week_start: string;
  man_days: number;
  tentative: boolean;
}

export interface TimeOffEntry {
  id: number;
  person_id: number;
  start_date: string;
  end_date: string;
  type: TimeOffType;
  tentative: boolean;
  notes: string | null;
}

/** Carico anonimo di altri team: solo i giorni per persona e settimana, mai i progetti. */
export interface ScheduleOtherTeamLoad {
  person_id: number;
  week_start: string;
  man_days: number;
}

/** Persona assegnata a un progetto (`task_allocation`) che non ha ancora nessuna settimana pianificata. */
export interface UnplannedAssignment {
  task_allocation_id: number;
  task_id: number;
  task_type: string;
  project_id: number;
  project_name: string;
  color: string | null;
  person_id: number;
}

export interface ScheduleData {
  persons: SchedulePerson[];
  allocations: ScheduleAllocation[];
  time_off: TimeOffEntry[];
  other_team_load: ScheduleOtherTeamLoad[];
  /** Assenti nelle risposte di un backend precedente. */
  unplanned_assignments?: UnplannedAssignment[];
}

/** Residuo non pianificato di una task_allocation (`GET /api/schedule/backlog`). */
export interface BacklogItem {
  task_allocation_id: number;
  task_id: number;
  person_id: number;
  person_name: string;
  project_id: number;
  project_name: string;
  project_color: string | null;
  task_type: string;
  estimated_days: number;
  allocated_days: number;
  remaining_days: number;
}

/** Una cella della griglia di consuntivazione: assegnato e consuntivato di quella settimana. */
export interface RangeCell {
  entry_id: number | null;
  man_days: number;
  planned_days: number;
  notes: string | null;
}

/**
 * Una riga della griglia di consuntivazione. `weeks` non contiene le settimane
 * senza dati: la griglia distingue "non assegnato" da "assegnato e non
 * consuntivato", e una mappa piena di zeri perderebbe la differenza.
 */
export interface RangeRow {
  key: string;
  task_id: number;
  wbs_item_id: number | null;
  wbs_item_name: string | null;
  project_id: number;
  project_name: string;
  task_type: string;
  task_status: string;
  estimated_days: number;
  total_man_days: number;
  is_extra: boolean;
  available_wbs_items: { id: number; name: string }[];
  weeks: Record<string, RangeCell>;
}

export type BillingType = 'turnkey' | 'tm';
export type TmMonthStatus = 'aperto' | 'fatturato' | 'rettifica';

export interface TmMonth {
  month: string;
  live_days: number;
  billed_days: number | null;
  delta_days: number | null;
  amount: number;
  status: TmMonthStatus;
}

/** Giornate live per mese di un progetto (padre o sotto progetto), allineate a TmProject.months. */
export interface TmBreakdown {
  project_id: number;
  name: string;
  live_days: number[];
}

export interface TmProject {
  project_id: number;
  name: string;
  daily_rate: number;
  plafond_days: number;
  consumed_days: number;
  residual_days: number;
  months: TmMonth[];
  /** Prima voce: lavoro diretto del padre; poi i sotto progetti per nome. */
  breakdown: TmBreakdown[];
}

// --- Business Unit ---

export interface BuTeamRef {
  id: number;
  name: string;
}

export interface BuWeek {
  week_start: string;
  tm_days: number;
  turnkey_days: number;
  other_days: number;
}

export interface BuTimeOff {
  start_date: string;
  end_date: string;
}

export interface BuPerson {
  person_id: number;
  name: string;
  job_title: string | null;
  weekly_capacity_days: number;
  pending: boolean;
  teams: BuTeamRef[];
  allocated_until: string | null;
  weeks: BuWeek[];
  time_off: BuTimeOff[];
}

export interface BuAllocationWeek {
  week_start: string;
  man_days: number;
}

export interface BuProjectAllocation {
  project_id: number;
  project_name: string;
  team_id: number;
  team_name: string;
  billing_type: 'turnkey' | 'tm';
  is_virtual: boolean;
  color: string | null;
  tentative: boolean;
  parent_project_id: number | null;
  parent_project_name: string | null;
  weeks: BuAllocationWeek[];
}

// --- Tutti i Team (/api/bu/teams, /projects, /kpi) ---

export interface BuTeamMember {
  person_id: number;
  name: string;
  job_title: string | null;
  role: AppRole;
}

export interface BuTeam {
  id: number;
  name: string;
  members: BuTeamMember[];
}

export interface BuProject {
  id: number;
  name: string;
  team_id: number;
  team_name: string;
  status: string;
  billing_type: 'turnkey' | 'tm';
  estimate_days: number | null;
  total_estimated_days: number;
  total_actual_days: number;
  completion_pct: number;
  start_date: string | null;
  end_date: string | null;
  icon: string | null;
  parent_project_id: number | null;
}

export interface BuTeamKpi {
  team_id: number;
  team_name: string;
  project_count: number;
  total_estimated_days: number;
  total_actual_days: number;
  completion_pct: number;
}

export interface BuBreakdown {
  task_type: string;
  estimated_days: number;
  actual_days: number;
  completion_pct: number;
}

export interface BuKpi {
  total_estimated_days: number;
  total_actual_days: number;
  completion_pct: number;
  teams: BuTeamKpi[];
  breakdown: BuBreakdown[];
}

/** Body di PUT /projects/:id/phases. */
export type SetPhasesRequest =
  | { uses_phases: true }
  | { uses_phases: false; person_id?: number; planned_start?: string; planned_end?: string; estimated_days?: number };
