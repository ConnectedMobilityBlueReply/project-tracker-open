import { useCallback, useEffect, useState } from 'react';
import { FolderOpen } from '@phosphor-icons/react';
import { getBuProjects } from '../../api';
import type { BuProject } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { PageHeader } from '@/components/app/PageHeader';
import { ProjectTile } from '@/components/app/ProjectTile';
import { SectionCard } from '@/components/app/SectionCard';
import { StatusBadge } from '@/components/app/StatusBadge';
import { formatDays } from '@/lib/buModel';
import { consumptionTone, projectStatusTone } from '@/lib/statusTone';
import { useEnterTeam } from '@/lib/useEnterTeam';

export default function TuttiProgetti() {
  const enterTeam = useEnterTeam();
  const [projects, setProjects] = useState<BuProject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await getBuProjects());
    } catch {
      setError('Errore nel caricamento dei progetti');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns: readonly DataTableColumn<BuProject>[] = [
    {
      key: 'name',
      header: 'Progetto',
      sortable: true,
      accessor: project => project.name,
      cell: project => {
        const tile = <ProjectTile id={project.id} name={project.name} icon={project.icon} size="sm" />;
        if (!enterTeam) {
          return (
            <span className="flex items-center gap-2">
              {tile}
              <span className="font-medium text-foreground">{project.name}</span>
            </span>
          );
        }
        return (
          <button
            type="button"
            onClick={() => void enterTeam(project.team_id, `/progetti/${project.id}`)}
            className="flex items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tile}
            <span className="font-medium text-foreground hover:underline">{project.name}</span>
          </button>
        );
      },
    },
    {
      key: 'team',
      header: 'Team',
      sortable: true,
      accessor: project => project.team_name,
      cell: project => <Badge variant="secondary" size="sm" pill>{project.team_name}</Badge>,
    },
    { key: 'tipo', header: 'Tipo', sortable: true, accessor: project => project.billing_type, cell: project => (project.billing_type === 'tm' ? 'T&M' : 'Turn Key') },
    {
      key: 'period',
      header: 'Periodo',
      accessor: project => project.start_date ?? '',
      cell: project => (project.start_date ? `${project.start_date} → ${project.end_date ?? '—'}` : '—'),
    },
    {
      key: 'status',
      header: 'Stato',
      sortable: true,
      accessor: project => project.status,
      cell: project => <StatusBadge tone={projectStatusTone(project.status)}>{project.status}</StatusBadge>,
    },
    {
      key: 'estimated',
      header: 'Stimati (gg)',
      sortable: true,
      accessor: project => project.total_estimated_days,
      cell: project => <span className="tabular-nums">{formatDays(project.total_estimated_days)}</span>,
    },
    {
      key: 'actual',
      header: 'Consuntivati (gg)',
      sortable: true,
      accessor: project => project.total_actual_days,
      cell: project => <span className="tabular-nums">{formatDays(project.total_actual_days)}</span>,
    },
    {
      key: 'progress',
      header: 'Avanzamento',
      sortable: true,
      accessor: project => project.completion_pct,
      cell: project => {
        const pct = Math.round(project.completion_pct);
        return (
          <div className="flex min-w-32 items-center gap-2">
            <Progress value={pct} size="sm" tone={consumptionTone(pct)} className="min-w-24 flex-1" aria-label={`Avanzamento ${pct}%`} />
            <span className="w-10 text-right text-xs text-foreground">{pct}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Progetti"
        description={enterTeam
          ? 'Tutti i progetti reali di tutti i team. Apri un progetto per entrare nel suo team.'
          : 'Tutti i progetti reali di tutti i team.'}
      />
      <SectionCard
        title="Elenco progetti"
        description={`${projects?.length ?? 0} progetti`}
        icon={<FolderOpen />}
        bodyClassName="p-0"
      >
        <DataTable
          bare
          data={projects ?? []}
          columns={columns}
          getRowId={project => project.id}
          defaultSort="team"
          searchPlaceholder="Cerca progetti…"
          densityStorageKey="project-tracker:tutti-progetti-density"
          loading={loading && projects == null}
          error={projects == null ? error : undefined}
          onRetry={() => void load()}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">Nessun progetto.</p>}
        />
      </SectionCard>
    </div>
  );
}
