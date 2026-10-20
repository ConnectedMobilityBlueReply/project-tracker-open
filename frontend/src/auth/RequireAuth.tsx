import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AuthLoading from './AuthLoading';
import { resolveAuthGate } from './routeGuard';

/** Protegge le rotte dell'app. Se `path` non è fornito, usa il pathname reale
 *  per applicare comunque il vincolo esplicito e il default-deny. */
export default function RequireAuth({ children, path }: { children: ReactNode; path?: string }) {
  const { status, user } = useAuth();
  const location = useLocation();

  const decision = resolveAuthGate({
    status,
    role: user?.appRole ?? null,
    hasTeam: user != null,
    businessUnit: user?.manager === true || user?.platformAdmin === true,
    path: path ?? location.pathname,
  });

  if (decision.kind === 'loading') return <AuthLoading />;
  if (decision.kind === 'login') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (decision.kind === 'landing') return <Navigate to={decision.to} replace />;
  return <>{children}</>;
}
