import { landingForRole } from '../components/layout/navigation.ts';
import { isPublicRoute, minimumRoleForPath, roleAtLeast } from './routeAccess.ts';
import type { AppRole } from '../types';

export const ONBOARDING_PATH = '/benvenuto';
export const BUSINESS_UNIT_PATH = '/business-unit';
const ALL_TEAMS_PATH_PREFIX = '/tutti/';

/** Business Unit e pagine Tutti i Team: riservate al manager e al super-admin. */
function isManagerOnlyPath(path: string): boolean {
  const normalized = path.replace(/\/+/g, '/').replace(/\/+$/, '').toLocaleLowerCase();
  return normalized === BUSINESS_UNIT_PATH || normalized.startsWith(ALL_TEAMS_PATH_PREFIX);
}

export type AuthGateDecision =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'landing'; to: string }
  | { kind: 'allow' };

/** Decisione pura del guard di rotta, testabile senza React Router.
 *
 *  - non autenticato → /login (il path tentato è preservato da RequireAuth);
 *  - autenticato ma con ruolo sotto il minimo della rotta → landing del
 *    proprio workspace (NON /login: è autenticato, solo non abilitato);
 *  - autenticato senza team → onboarding (nessuna rotta team-scoped viene
 *    resa, quindi nessuna fetch senza X-Team-Id); con un team l'onboarding
 *    rimanda alla landing del ruolo;
 *  - una rotta non pubblica senza vincolo esplicito è negata per default;
 *  - le rotte /business-unit e /tutti/* richiedono anche il flag manager o super-admin;
 *  - il ruolo minimo per rotta deriva dalla tabella esplicita di
 *    routeAccess.ts, separata dalla presentazione della navigazione. */
export function resolveAuthGate(params: {
  status: 'loading' | 'anonymous' | 'authenticated';
  role: AppRole | null;
  path: string | null;
  hasTeam?: boolean;
  businessUnit?: boolean;
}): AuthGateDecision {
  const { status, role, path, hasTeam = true, businessUnit = false } = params;

  if (status === 'loading') return { kind: 'loading' };
  if (status === 'anonymous') return { kind: 'login' };

  if (path != null && isPublicRoute(path)) return { kind: 'allow' };
  if (!hasTeam) return path === ONBOARDING_PATH ? { kind: 'allow' } : { kind: 'landing', to: ONBOARDING_PATH };
  if (path === ONBOARDING_PATH) return { kind: 'landing', to: role ? landingForRole(role) : '/' };
  if (path == null || role == null) return { kind: 'login' };

  const minimum = minimumRoleForPath(path);
  if (minimum == null || !roleAtLeast(role, minimum)) {
    return { kind: 'landing', to: landingForRole(role) };
  }
  // Il ruolo pm non basta: Business Unit e Tutti i Team sono del manager (o del super-admin).
  if (isManagerOnlyPath(path) && !businessUnit) {
    return { kind: 'landing', to: landingForRole(role) };
  }
  return { kind: 'allow' };
}
