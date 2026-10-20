import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Buildings, CaretUpDown, Check, EnvelopeSimple, Plus } from '@phosphor-icons/react';
import { AvatarFallback, AvatarRoot } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '../../auth/AuthContext';
import { canUseAllTeams, isPureManager } from '../../auth/activeTeam';
import { settleAutosave } from '../../pages/admin-progetti/useAutosave';
import { InvitesList } from '../team/InvitesList';
import { CreateTeamForm } from '../team/CreateTeamForm';
import { ALL_TEAMS_LABEL, workspaceLabelFor } from './navigation';

/**
 * Card del team attivo in cima alla sidebar: apre l'elenco dei team (con il
 * ruolo in ciascuno) e la creazione di un nuovo team. Il cambio team riporta
 * alla home: Layout viene rimontato (App.tsx) e ogni pagina ricarica i dati.
 */
export default function TeamSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user, account, teams, invites, selectTeam, selectAllTeams } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [viewingInvites, setViewingInvites] = useState(false);
  // Senza inviti il dialog si chiude: un invito arrivato dopo non deve riaprirlo da solo.
  useEffect(() => {
    if (invites.length === 0) setViewingInvites(false);
  }, [invites.length]);
  if (!user) return null;

  // Manager puro: sempre in Tutti i Team, nessun menu di cambio team.
  const pureManager = account != null && isPureManager(account);
  const showAllTeams = pureManager || user.allTeams;
  const workspace = workspaceLabelFor(user.appRole, user.readOnly, showAllTeams);
  const cardTitle = showAllTeams ? ALL_TEAMS_LABEL : user.teamName;
  const canSelectAllTeams = account != null && canUseAllTeams(account);

  const cardFace = (
    <>
      <AvatarRoot size="md" shape="square" color="brand">
        <AvatarFallback>{showAllTeams ? <Buildings aria-hidden="true" className="size-4" /> : cardTitle.charAt(0).toUpperCase()}</AvatarFallback>
      </AvatarRoot>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-muted-foreground">{cardTitle}</span>
            <span className="block truncate text-sm font-medium text-foreground">{workspace}</span>
          </span>
          {!pureManager && <CaretUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
        </>
      )}
    </>
  );
  const cardLayout = collapsed ? 'mx-auto' : 'flex w-full items-center gap-3 border border-border bg-card px-3 py-2.5 shadow-xs';

  if (pureManager) {
    return <div className={cn('rounded-card text-left', cardLayout)}>{cardFace}</div>;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${cardTitle}, ${workspace}: cambia team`}
            className={cn(
              'rounded-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              cardLayout,
              !collapsed && 'hover:bg-muted/40',
            )}
          >
            {cardFace}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start">
          {canSelectAllTeams && (
            <>
              <DropdownMenuItem
                onClick={async () => {
                  if (user.allTeams) return;
                  const saved = await settleAutosave();
                  if (!saved && !window.confirm('Ci sono modifiche non salvate: cambiando vista andranno perse. Continuare?')) return;
                  selectAllTeams();
                  navigate('/');
                }}
              >
                <Buildings aria-hidden="true" className="size-4" />
                <span className="min-w-0 flex-1 truncate">{ALL_TEAMS_LABEL}</span>
                {user.allTeams && <Check aria-label="Vista attiva" className="size-4" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>I tuoi team</DropdownMenuLabel>
          {teams.map(team => (
            <DropdownMenuItem
              key={team.id}
              onClick={async () => {
                if (team.id === user.teamId && !user.allTeams) return;
                // Prima salva le modifiche in coda (col team ancora attivo); se restano non salvate, chiede conferma.
                const saved = await settleAutosave();
                if (!saved && !window.confirm('Ci sono modifiche non salvate: cambiando team andranno perse. Continuare?')) return;
                selectTeam(team.id);
                navigate('/');
              }}
            >
              <span className="min-w-0 flex-1 truncate">{team.name}</span>
              <span className="text-xs text-muted-foreground">{workspaceLabelFor(team.role, team.read_only === true)}</span>
              {team.id === user.teamId && !user.allTeams && <Check aria-label="Team attivo" className="size-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <Plus /> Crea nuovo team
          </DropdownMenuItem>
          {invites.length > 0 && (
            <DropdownMenuItem onClick={() => setViewingInvites(true)}>
              <EnvelopeSimple /> Inviti ({invites.length})
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={viewingInvites && invites.length > 0} onOpenChange={setViewingInvites}>
        <DialogContent aria-describedby={undefined} className="rounded-card sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Inviti ricevuti</DialogTitle>
          </DialogHeader>
          <InvitesList
            onAccepted={() => {
              setViewingInvites(false);
              navigate('/');
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent aria-describedby={undefined} className="rounded-card sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Nuovo team</DialogTitle>
          </DialogHeader>
          <CreateTeamForm
            autoFocus
            onCreated={() => {
              setCreating(false);
              navigate('/');
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
