import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { workspaceForRole, WORKSPACE_LABELS } from '../layout/navigation';
import type { TeamInvite } from '../../types';

function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Operazione non riuscita';
  return err.status === 404 ? 'Invito non più disponibile' : err.message;
}

interface InvitesListProps {
  /** Chiamata dopo un'accettazione riuscita, quando il team accettato è già attivo. */
  onAccepted?(): void;
}

/** Inviti ricevuti con Accetta/Rifiuta; condiviso da onboarding e dialog del TeamSwitcher. */
export function InvitesList({ onAccepted }: InvitesListProps) {
  const { invites, acceptInvite, declineInvite } = useAuth();
  const [busyTeam, setBusyTeam] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(invite: TeamInvite, action: 'accept' | 'decline') {
    setBusyTeam(invite.team_id);
    setError(null);
    try {
      if (action === 'accept') {
        await acceptInvite(invite.team_id, invite.role);
        onAccepted?.();
      } else {
        await declineInvite(invite.team_id);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyTeam(null);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {invites.map(invite => (
          <li key={invite.team_id} className="flex flex-wrap items-center gap-3 rounded-card border border-border p-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{invite.team_name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {WORKSPACE_LABELS[workspaceForRole(invite.role)]}
                {invite.invited_by_name ? ` · Invitato da ${invite.invited_by_name}` : ''}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              disabled={busyTeam != null}
              onClick={() => void run(invite, 'accept')}
              aria-label={`Accetta l'invito a ${invite.team_name}`}
            >
              Accetta
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyTeam != null}
              onClick={() => void run(invite, 'decline')}
              aria-label={`Rifiuta l'invito a ${invite.team_name}`}
            >
              Rifiuta
            </Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
