import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from '@/components/app/BrandMark';
import { Button } from '@/components/ui/button';
import { Field, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

// Requisiti della password policy del backend (Cognito):
// minimo 8 caratteri, maiuscola, minuscola, numero, simbolo.
const PASSWORD_POLICY_REQUIREMENTS = [
  'almeno 8 caratteri',
  'una lettera maiuscola',
  'una lettera minuscola',
  'un numero',
  'un simbolo',
];

function changePasswordErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Impossibile contattare il server. Riprova.';
  switch (error.code) {
    case 'PASSWORD_POLICY':
      return error.message; // messaggio della policy fornito dal backend
    case 'NETWORK':
      return 'Errore di rete. Controlla la connessione e riprova.';
    case 'AUTHENTICATION_SERVICE_UNAVAILABLE':
      return 'Servizio di autenticazione non disponibile. Riprova tra qualche minuto.';
    default:
      return error.message;
  }
}

export default function ChangePassword({
  email,
  session,
  onBack,
}: {
  email: string;
  session: string;
  onBack(): void;
}) {
  const { changePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = confirmPassword !== '' && newPassword !== confirmPassword;
  const canSubmit = newPassword !== '' && confirmPassword !== '' && !mismatch && !busy;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      await changePassword(email, session, newPassword);
      // AUTHENTICATED: AuthProvider passa ad `authenticated` e Login
      // reindirizza alla pagina tentata (o alla landing del ruolo).
    } catch (err) {
      setError(changePasswordErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-app items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-card border border-border bg-card p-8 shadow-xs">
        <BrandMark wordmark={false} />
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">
          Imposta la tua password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Primo accesso per <span className="font-medium text-foreground">{email}</span>: scegli una nuova password.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel>Nuova password</FieldLabel>
            <Input
              type="password"
              autoComplete="new-password"
              autoFocus
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={busy}
              required
            />
            <FieldHint>Deve soddisfare tutti i requisiti:</FieldHint>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {PASSWORD_POLICY_REQUIREMENTS.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </Field>
          <Field hasError={mismatch}>
            <FieldLabel>Conferma password</FieldLabel>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={busy}
              required
            />
            {mismatch && <FieldHint role="alert">Le due password non coincidono.</FieldHint>}
          </Field>
          {error != null && (
            <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onBack} disabled={busy}>
              Indietro
            </Button>
            <Button type="submit" className="flex-1" disabled={!canSubmit}>
              {busy ? 'Salvataggio…' : 'Imposta password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
