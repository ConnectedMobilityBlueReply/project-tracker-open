import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import Layout from './components/Layout'
import RequireAuth from './auth/RequireAuth'
import { useAuth } from './auth/AuthContext'
import Login from './pages/Login'
import Benvenuto from './pages/Benvenuto'
import { ONBOARDING_PATH } from './auth/routeGuard'
import { ALL_TEAMS_LANDING, landingForRole } from './components/layout/navigation'
import { PROTECTED_ROUTES } from './appRoutes'
import Consuntivazione from './pages/Consuntivazione'
import Progetti from './pages/Progetti'
import ProgettoDettaglio from './pages/ProgettoDettaglio'
import AdminPersone from './pages/AdminPersone'
import AdminTeam from './pages/AdminTeam'
import AdminProgetti from './pages/AdminProgetti'
import AdminOpzioni from './pages/AdminOpzioni'
import AdminDashboard from './pages/AdminDashboard'
import Planning from './pages/Planning'
import MieiTask from './pages/MieiTask'
import TimelineTeam from './pages/TimelineTeam'
import Basket from './pages/Basket'
import TimeMaterial from './pages/TimeMaterial'
import BusinessUnit from './pages/BusinessUnit'
import TuttiTeam from './pages/tutti/TuttiTeam'
import TuttiPlanning from './pages/tutti/TuttiPlanning'
import TuttiProgetti from './pages/tutti/TuttiProgetti'
import TuttiKpi from './pages/tutti/TuttiKpi'
import Dashboard from './pages/Dashboard'
import { legacyScheduleTarget } from './lib/planningModel'
import UpdatesSettings from './pages/settings/UpdatesSettings'
import { hasDesktopUpdates } from './lib/desktopBridge'
import { SETTINGS_UPDATES_PATH } from './pages/settings/useDesktopUpdates'

/** Redirect dell'indice "/" consapevole del ruolo: ogni ruolo atterra dove
 *  inizia la sua navigazione (member → /consuntivazione, pm → /timeline-team,
 *  admin → /admin/persone). In modalità Tutti i Team (default del manager)
 *  atterra sulla Business Unit; il super-admin resta sulla landing del suo
 *  ruolo finché non sceglie Tutti i Team. Il ruolo viene dal server, mai scelto. */
function RoleLanding() {
  const { user } = useAuth();
  const target = !user ? '/login' : user.allTeams ? ALL_TEAMS_LANDING : landingForRole(user.appRole);
  return <Navigate to={target} replace />;
}

/** Layout rimontato a ogni cambio di team: nessuna pagina mostra dati del team precedente. */
function TeamLayout() {
  const { activeTeamId, allTeams } = useAuth();
  return <Layout key={allTeams ? 'all-teams' : activeTeamId ?? 'none'} />;
}

/** Vecchi link alla Pianificazione: il PM ritrova la griglia con i suoi parametri, il member la Table. */
function LegacyScheduleRedirect() {
  const { user } = useAuth();
  const { search } = useLocation();
  return <Navigate to={user ? legacyScheduleTarget(user.appRole, search) : '/login'} replace />;
}

/** Componente per ogni rotta protetta di PROTECTED_ROUTES: le chiavi devono
 *  coprire TUTTI i path della tabella — il render fallisce subito se un path
 *  resta senza elemento. */
const ROUTE_ELEMENTS: Record<string, ReactNode> = {
  'dashboard': <Dashboard />,
  'timeline-team': <TimelineTeam />,
  'consuntivazione': <Consuntivazione />,
  'progetti': <Progetti />,
  'progetti/:id': <ProgettoDettaglio />,
  'progetti/:id/task': <ProgettoDettaglio />,
  'progetti/:id/wbs': <ProgettoDettaglio />,
  // Capacità per il PM, Table per il member: stessa regola dei vecchi link alla Pianificazione.
  'planning': <LegacyScheduleRedirect />,
  'planning/table': <Planning />,
  'planning/gantt': <Planning />,
  'planning/kanban': <Planning />,
  'planning/capacita': <Planning />,
  // Pagine fuse in Planning: le rotte restano vive solo per i segnalibri.
  'pianificazione': <LegacyScheduleRedirect />,
  'allocazioni': <LegacyScheduleRedirect />,
  'schedule': <LegacyScheduleRedirect />,
  'basket': <Basket />,
  'time-material': <TimeMaterial />,
  'business-unit': <BusinessUnit />,
  'tutti/team': <TuttiTeam />,
  'tutti/planning': <TuttiPlanning />,
  'tutti/progetti': <TuttiProgetti />,
  'tutti/kpi': <TuttiKpi />,
  'miei-task': <MieiTask />,
  'admin/team': <AdminTeam />,
  'admin/persone': <AdminPersone />,
  'admin/progetti': <AdminProgetti />,
  'admin/progetti/:id': <AdminProgetti />,
  'admin/opzioni': <AdminOpzioni />,
  'admin/dashboard': <AdminDashboard />,
  // Solo app desktop: nel browser entrambe rimandano alla home.
  'impostazioni': <Navigate to={hasDesktopUpdates() ? SETTINGS_UPDATES_PATH : '/'} replace />,
  'impostazioni/aggiornamenti': <UpdatesSettings />,
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path={ONBOARDING_PATH} element={<RequireAuth path={ONBOARDING_PATH}><Benvenuto /></RequireAuth>} />
        <Route path="/" element={<RequireAuth><TeamLayout /></RequireAuth>}>
          <Route index element={<RoleLanding />} />
          {PROTECTED_ROUTES.map(route => {
            const element = ROUTE_ELEMENTS[route.path];
            if (element == null) {
              throw new Error(
                `Manca l'elemento per la rotta protetta "${route.path}" (vedi ROUTE_ELEMENTS in App.tsx)`,
              );
            }
            return (
              <Route
                key={route.path}
                path={route.path}
                element={<RequireAuth path={route.guardPath}>{element}</RequireAuth>}
              />
            );
          })}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
