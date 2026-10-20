import { useCallback, useEffect, useMemo, useState } from 'react';
import { UsersThree } from '@phosphor-icons/react';
import { getBuTeams } from '../../api';
import type { AppRole, BuTeam } from '../../types';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { PageHeader } from '@/components/app/PageHeader';
import { SectionCard } from '@/components/app/SectionCard';
import { useEnterTeam } from '@/lib/useEnterTeam';

interface Row {
  key: string;
  teamId: number;
  teamName: string;
  personName: string;
  jobTitle: string | null;
  role: AppRole;
}

const ROLE_LABEL: Record<AppRole, string> = { member: 'Membro', pm: 'PM / Team lead', admin: 'Admin' };

function toRows(teams: readonly BuTeam[]): Row[] {
  return teams.flatMap(team => team.members.map(member => ({
    key: `${team.id}-${member.person_id}`,
    teamId: team.id,
    teamName: team.name,
    personName: member.name,
    jobTitle: member.job_title,
    role: member.role,
  })));
}

export default function TuttiTeam() {
  const enterTeam = useEnterTeam();
  const [teams, setTeams] = useState<BuTeam[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTeams(await getBuTeams());
    } catch {
      setError('Errore nel caricamento dei team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => (teams ? toRows(teams) : []), [teams]);

  const columns: readonly DataTableColumn<Row>[] = [
    { key: 'persona', header: 'Membro', sortable: true, accessor: row => row.personName, cell: row => <span className="font-medium">{row.personName}</span> },
    { key: 'titolo', header: 'Ruolo professionale', sortable: true, accessor: row => row.jobTitle ?? '', cell: row => row.jobTitle ?? '—' },
    {
      key: 'team',
      header: 'Team',
      sortable: true,
      accessor: row => row.teamName,
      cell: row => (enterTeam ? (
        <button
          type="button"
          aria-label={`Apri il team ${row.teamName}`}
          onClick={() => void enterTeam(row.teamId, '/timeline-team')}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Badge variant="secondary" size="sm" pill>{row.teamName}</Badge>
        </button>
      ) : (
        <span className="rounded-full">
          <Badge variant="secondary" size="sm" pill>{row.teamName}</Badge>
        </span>
      )),
    },
    { key: 'ruolo', header: 'Ruolo nel team', sortable: true, accessor: row => ROLE_LABEL[row.role], cell: row => ROLE_LABEL[row.role] },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="Team" description="Tutti i membri di tutti i team." />
      <SectionCard
        title="Membri"
        description={`${rows.length} appartenenze in ${teams?.length ?? 0} team`}
        icon={<UsersThree />}
        bodyClassName="p-0"
      >
        <DataTable
          bare
          data={rows}
          columns={columns}
          getRowId={row => row.key}
          defaultSort="team"
          searchPlaceholder="Cerca membri…"
          densityStorageKey="project-tracker:tutti-team-density"
          loading={loading && teams == null}
          error={teams == null ? error : undefined}
          onRetry={() => void load()}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">Nessun membro.</p>}
        />
      </SectionCard>
    </div>
  );
}
