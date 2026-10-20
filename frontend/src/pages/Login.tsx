import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { ONBOARDING_PATH } from '../auth/routeGuard';
import { workspaceForRole, WORKSPACE_LANDING } from '../components/layout/navigation';
import { BrandMark } from '@/components/app/BrandMark';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import ChangePassword from './ChangePassword';

interface LoginLocationState {
  from?: { pathname: string; search?: string; hash?: string };
}

function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Impossibile contattare il server. Riprova.';
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Email o password non corretti.';
    case 'NETWORK':
      return 'Errore di rete. Controlla la connessione e riprova.';
    case 'AUTHENTICATION_SERVICE_UNAVAILABLE':
      return 'Servizio di autenticazione non disponibile. Riprova tra qualche minuto.';
    default:
      return error.message;
  }
}

export default function Login() {
  const { status, user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordFlow, setPasswordFlow] = useState<{ email: string; session: string } | null>(null);

  // Visitatori autenticati (o login/cambio password appena completati)
  // lasciano /login per la pagina da cui venivano, o per la landing del ruolo.
  if (status === 'authenticated') {
    if (!user) return <Navigate to={ONBOARDING_PATH} replace />;
    const from = (location.state as LoginLocationState | null)?.from;
    const target = from
      ? from.pathname + (from.search ?? '') + (from.hash ?? '')
      : WORKSPACE_LANDING[workspaceForRole(user.appRole)];
    return <Navigate to={target} replace />;
  }

  if (passwordFlow) {
    return (
      <ChangePassword
        email={passwordFlow.email}
        session={passwordFlow.session}
        onBack={() => setPasswordFlow(null)}
      />
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (result.status === 'NEW_PASSWORD_REQUIRED') {
        setPasswordFlow({ email: email.trim(), session: result.session });
      }
      // AUTHENTICATED: il contesto passa ad `authenticated` e il redirect
      // qui sopra prende il controllo.
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.trim() !== '' && password !== '' && !busy;

  return (
    <div className="flex min-h-app items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-8 shadow-xs">
        <div className="mb-6">
          <BrandMark wordmark={false} />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">
            Project Tracker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Accedi per continuare</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="nome@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              required
            />
          </Field>
          <Field>
            <FieldLabel>Password</FieldLabel>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              required
            />
          </Field>
          {error != null && (
            <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {busy ? 'Accesso in corso…' : 'Accedi'}
          </Button>
        </form>
      </div>
    </div>
  );
}
