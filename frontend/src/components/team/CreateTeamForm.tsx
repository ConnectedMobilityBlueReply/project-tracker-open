import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { teamNameError } from '../../lib/teamValidation';
import type { TeamSummary } from '../../types';

interface CreateTeamFormProps {
  onCreated(team: TeamSummary): void;
  autoFocus?: boolean;
}

export function CreateTeamForm({ onCreated, autoFocus = false }: CreateTeamFormProps) {
  const { createTeam } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = teamNameError(name);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await createTeam(name.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Creazione del team non riuscita');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field>
        <FieldLabel>Nome del team</FieldLabel>
        <Input
          name="team-name"
          type="text"
          required
          maxLength={80}
          autoFocus={autoFocus}
          placeholder="es. Team Digital"
          value={name}
          aria-invalid={error != null}
          onChange={event => setName(event.target.value)}
        />
      </Field>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Creazione…' : 'Crea team'}
      </Button>
    </form>
  );
}
