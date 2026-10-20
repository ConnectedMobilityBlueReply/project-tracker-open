import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Users } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { PageHeader } from '@/components/app/PageHeader';
import { SectionCard } from '@/components/app/SectionCard';
import { ErrorBanner } from '@/components/app/StateMessages';
import { addTeamMember, ApiError, getTeamMembers, removeTeamMember, renameTeam, updateTeamMemberRole } from '../api';
import { useAuth } from '../auth/AuthContext';
import { WORKSPACE_LABELS } from '../components/layout/navigation';
import { memberEmailError, teamNameError } from '../lib/teamValidation';
import type { AppRole, TeamMember } from '../types';

const ROLES: readonly AppRole[] = ['member', 'pm', 'admin'];

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Operazione non riuscita';
}

/** Gestione del team attivo: nome, membri, ruoli. Solo admin del team (rotta e backend). */
export default function AdminTeam() {
  const { user, reloadAccount } = useAuth();
  const teamId = user?.teamId ?? null;
  const currentTeamName = user?.teamName ?? '';
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState(currentTeamName);
  const [renaming, setRenaming] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('member');
  const [adding, setAdding] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [busyMember, setBusyMember] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (teamId == null) return;
    setLoading(true);
    setError(null);
    try {
      setMembers(await getTeamMembers(teamId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { void load(); }, [load]);
  // Cambio di team attivo o rinomina riuscita: il campo segue il nome corrente.
  useEffect(() => { setTeamName(currentTeamName); }, [currentTeamName]);

  if (!user || teamId == null) return null;

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    const problem = teamNameError(teamName);
    if (problem) { setActionError(problem); return; }
    setRenaming(true);
    setActionError(null);
    try {
      await renameTeam(teamId!, teamName.trim());
      await reloadAccount();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setRenaming(false);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const problem = memberEmailError(email);
    if (problem) { setActionError(problem); return; }
    setAdding(true);
    setActionError(null);
    setInviteSent(false);
    try {
      await addTeamMember(teamId!, { email: email.trim(), role });
      setEmail('');
      setRole('member');
      setInviteSent(true);
      await load();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(member: TeamMember, next: AppRole) {
    if (next === member.role) return;
    setBusyMember(member.person_id);
    setActionError(null);
    try {
      await updateTeamMemberRole(teamId!, member.person_id, next);
      await load();
      if (member.person_id === user!.personId) await reloadAccount();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyMember(null);
    }
  }

  async function handleRemove() {
    if (!removing) return;
    setBusyMember(removing.person_id);
    setActionError(null);
    try {
      await removeTeamMember(teamId!, removing.person_id);
      setRemoving(null);
      await load();
    } catch (err) {
      setRemoving(null);
      setActionError(errorMessage(err));
    } finally {
      setBusyMember(null);
    }
  }

  const columns: DataTableColumn<TeamMember>[] = [
    {
      key: 'nome', header: 'Nome', sortable: true,
      accessor: member => member.name,
      cell: member => (
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{member.name}</span>
          {member.invited
            ? <Badge variant="info" size="sm" pill>Invito inviato</Badge>
            : member.pending && <Badge variant="warning" size="sm" pill>In attesa</Badge>}
        </span>
      ),
    },
    { key: 'email', header: 'Email', sortable: true, accessor: member => member.email ?? '' },
    {
      key: 'ruolo', header: 'Ruolo', sortable: true,
      accessor: member => WORKSPACE_LABELS[member.role],
      cell: member => (
        // stopPropagation: il cambio ruolo non deve attivare la riga.
        <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
          <Select
            value={member.role}
            disabled={busyMember === member.person_id}
            onValueChange={value => void handleRoleChange(member, value as AppRole)}
          >
            <SelectTrigger className="w-40" aria-label={`Ruolo di ${member.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(option => <SelectItem key={option} value={option}>{WORKSPACE_LABELS[option]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: 'azioni', header: '',
      cell: member => (
        <div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busyMember === member.person_id}
            onClick={() => setRemoving(member)}
            aria-label={member.invited ? `Revoca l'invito a ${member.name}` : `Rimuovi ${member.name} dal team`}
          >
            {member.invited ? 'Revoca' : 'Rimuovi'}
          </Button>
        </div>
      ),
    },
  ];

  const activeCount = members.filter(member => !member.invited).length;
  const inviteCount = members.length - activeCount;
  const personaLabel = activeCount === 1 ? 'persona' : 'persone';
  const inviteLabel = inviteCount === 1 ? 'invito' : 'inviti';
  const teamSummary = `${activeCount} ${personaLabel}${inviteCount > 0 ? ` · ${inviteCount} ${inviteLabel}` : ''}`;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title={user.teamName} description="Gestione del team: nome, persone e ruoli" />

      {actionError && <ErrorBanner>{actionError}</ErrorBanner>}

      <SectionCard title="Nome del team">
        <form onSubmit={handleRename} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="flex-1">
            <FieldLabel>Nome</FieldLabel>
            <Input name="team-name" maxLength={80} value={teamName} onChange={event => setTeamName(event.target.value)} />
          </Field>
          <Button type="submit" disabled={renaming || teamName.trim() === user.teamName}>
            {renaming ? 'Salvataggio…' : 'Salva nome'}
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Aggiungi persona" description="La persona riceverà un invito e entrerà nel team quando lo accetta.">
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="flex-1">
            <FieldLabel>Email</FieldLabel>
            <Input name="member-email" type="email" placeholder="nome@azienda.it" value={email} onChange={event => setEmail(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Ruolo</FieldLabel>
            <Select value={role} onValueChange={value => setRole(value as AppRole)}>
              <SelectTrigger className="w-40" aria-label="Ruolo della nuova persona">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(option => <SelectItem key={option} value={option}>{WORKSPACE_LABELS[option]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" disabled={adding}>{adding ? 'Invio…' : 'Invita'}</Button>
        </form>
        {inviteSent && <p role="status" className="mt-3 text-sm font-medium text-foreground">Invito inviato</p>}
      </SectionCard>

      <SectionCard title="Persone" description={teamSummary} icon={<Users />} bodyClassName="p-0">
        <DataTable
          bare
          data={members}
          columns={columns}
          getRowId={member => member.person_id}
          defaultSort="nome"
          searchPlaceholder="Cerca persone…"
          densityStorageKey="project-tracker:admin-team-density"
          loading={loading && members.length === 0}
          error={error}
          onRetry={() => void load()}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">Nessuna persona nel team.</p>}
        />
      </SectionCard>

      <Dialog open={removing != null} onOpenChange={open => { if (!open) setRemoving(null); }}>
        <DialogContent className="rounded-card sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{removing?.invited ? 'Revocare l\'invito?' : `Rimuovere ${removing?.name} dal team?`}</DialogTitle>
            <DialogDescription>
              {removing?.invited
                ? `${removing.name} non potrà più accettare l'invito al team.`
                : 'Consuntivi e allocazioni passate restano sui progetti del team. Non è possibile rimuovere chi ha allocazioni future.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setRemoving(null)}>Annulla</Button>
            <Button type="button" variant="destructive" className="flex-1" disabled={busyMember != null} onClick={() => void handleRemove()}>{removing?.invited ? 'Revoca' : 'Rimuovi'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
