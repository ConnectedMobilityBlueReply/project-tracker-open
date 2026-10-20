/**
 * Albo delle rotte protette dell'applicazione: UNICA fonte di verità per il
 * guard di rotta. App.tsx renderizza le Route DA QUESTA TABELLA (il guard è
 * derivato, non opzionale: `guardPath` è obbligatorio e la protezione viene
 * applicata automaticamente a ogni riga). Il test strutturale in
 * routeGuard.test.mjs verifica che ogni guardPath abbia un ruolo minimo
 * nella navigazione e che ogni voce di navigazione punti a una rotta protetta.
 *
 * Aggiungere una rotta = aggiungere una riga qui + l'elemento in
 * ROUTE_ELEMENTS (App.tsx). Togliere la protezione a una rotta = errore di
 * tipo (guardPath obbligatorio) + test rosso.
 */
export interface ProtectedRoute {
  /** Path relativo della Route figlia (sotto "/"). */
  path: string;
  /** Path assoluto usato da RequireAuth per derivare il ruolo minimo. */
  guardPath: string;
  /** Etichetta del componente (solo documentazione). */
  page: string;
}

export const PROTECTED_ROUTES: readonly ProtectedRoute[] = [
  { path: 'dashboard', guardPath: '/dashboard', page: 'Dashboard' },
  { path: 'timeline-team', guardPath: '/timeline-team', page: 'TimelineTeam' },
  { path: 'consuntivazione', guardPath: '/consuntivazione', page: 'Consuntivazione' },
  { path: 'progetti', guardPath: '/progetti', page: 'Progetti' },
  { path: 'progetti/:id', guardPath: '/progetti/:id', page: 'ProgettoDettaglio' },
  { path: 'progetti/:id/task', guardPath: '/progetti/:id/task', page: 'ProgettoDettaglio' },
  { path: 'progetti/:id/wbs', guardPath: '/progetti/:id/wbs', page: 'ProgettoDettaglio' },
  { path: 'planning', guardPath: '/planning', page: 'Redirect → Capacità (PM) / Table (member)' },
  { path: 'planning/table', guardPath: '/planning/table', page: 'Planning' },
  { path: 'planning/gantt', guardPath: '/planning/gantt', page: 'Planning' },
  { path: 'planning/kanban', guardPath: '/planning/kanban', page: 'Planning' },
  { path: 'planning/capacita', guardPath: '/planning/capacita', page: 'Planning (Schedule)' },
  { path: 'pianificazione', guardPath: '/pianificazione', page: 'Navigate → Planning' },
  { path: 'allocazioni', guardPath: '/allocazioni', page: 'Navigate → Planning' },
  { path: 'schedule', guardPath: '/schedule', page: 'Navigate → Planning' },
  { path: 'basket', guardPath: '/basket', page: 'Basket' },
  { path: 'time-material', guardPath: '/time-material', page: 'TimeMaterial' },
  { path: 'business-unit', guardPath: '/business-unit', page: 'BusinessUnit' },
  { path: 'tutti/team', guardPath: '/tutti/team', page: 'TuttiTeam' },
  { path: 'tutti/planning', guardPath: '/tutti/planning', page: 'TuttiPlanning' },
  { path: 'tutti/progetti', guardPath: '/tutti/progetti', page: 'TuttiProgetti' },
  { path: 'tutti/kpi', guardPath: '/tutti/kpi', page: 'TuttiKpi' },
  { path: 'miei-task', guardPath: '/miei-task', page: 'MieiTask' },
  { path: 'admin/team', guardPath: '/admin/team', page: 'AdminTeam' },
  { path: 'admin/persone', guardPath: '/admin/persone', page: 'AdminPersone' },
  { path: 'admin/progetti', guardPath: '/admin/progetti', page: 'AdminProgetti' },
  { path: 'admin/progetti/:id', guardPath: '/admin/progetti/:id', page: 'AdminProgetti' },
  { path: 'admin/opzioni', guardPath: '/admin/opzioni', page: 'AdminOpzioni' },
  { path: 'admin/dashboard', guardPath: '/admin/dashboard', page: 'AdminDashboard' },
  { path: 'impostazioni', guardPath: '/impostazioni', page: 'Navigate → Impostazioni Aggiornamenti' },
  { path: 'impostazioni/aggiornamenti', guardPath: '/impostazioni/aggiornamenti', page: 'UpdatesSettings' },
];
