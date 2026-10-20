import { useCallback, useEffect, useState } from 'react';
import { ChartBar, UsersThree } from '@phosphor-icons/react';
import { getBuKpi } from '../../api';
import type { BuBreakdown, BuKpi, BuTeamKpi } from '../../types';
import { Progress } from '@/components/ui/progress';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { PageHeader } from '@/components/app/PageHeader';
import { SectionCard } from '@/components/app/SectionCard';
import { ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { formatDays } from '@/lib/buModel';
import { consumptionTone } from '@/lib/statusTone';

function ProgressCell({ pct }: { pct: number }) {
  const rounded = Math.round(pct);
  return (
    <div className="flex min-w-32 items-center gap-2">
      <Progress value={rounded} size="sm" tone={consumptionTone(rounded)} className="min-w-24 flex-1" aria-label={`Avanzamento ${rounded}%`} />
      <span className="w-10 text-right text-xs text-foreground">{rounded}%</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

const TEAM_COLUMNS: readonly DataTableColumn<BuTeamKpi>[] = [
  { key: 'team', header: 'Team', sortable: true, accessor: row => row.team_name, cell: row => <span className="font-medium">{row.team_name}</span> },
  { key: 'progetti', header: 'Progetti', sortable: true, accessor: row => row.project_count, cell: row => <span className="tabular-nums">{row.project_count}</span> },
  { key: 'stimati', header: 'Stimati (gg)', sortable: true, accessor: row => row.total_estimated_days, cell: row => <span className="tabular-nums">{formatDays(row.total_estimated_days)}</span> },
  { key: 'consuntivati', header: 'Consuntivati (gg)', sortable: true, accessor: row => row.total_actual_days, cell: row => <span className="tabular-nums">{formatDays(row.total_actual_days)}</span> },
  { key: 'avanzamento', header: 'Avanzamento', sortable: true, accessor: row => row.completion_pct, cell: row => <ProgressCell pct={row.completion_pct} /> },
];

const BREAKDOWN_COLUMNS: readonly DataTableColumn<BuBreakdown>[] = [
  { key: 'tipo', header: 'Tipo attività', sortable: true, accessor: row => row.task_type, cell: row => <span className="font-medium">{row.task_type}</span> },
  { key: 'stimati', header: 'Stimati (gg)', sortable: true, accessor: row => row.estimated_days, cell: row => <span className="tabular-nums">{formatDays(row.estimated_days)}</span> },
  { key: 'consuntivati', header: 'Consuntivati (gg)', sortable: true, accessor: row => row.actual_days, cell: row => <span className="tabular-nums">{formatDays(row.actual_days)}</span> },
  { key: 'avanzamento', header: 'Avanzamento', sortable: true, accessor: row => row.completion_pct, cell: row => <ProgressCell pct={row.completion_pct} /> },
];

export default function TuttiKpi() {
  const [kpi, setKpi] = useState<BuKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setKpi(await getBuKpi());
    } catch {
      setError('Errore nel caricamento dei KPI');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="KPI ed economia" description="Giornate stimate e consuntivate su tutti i progetti reali di tutti i team." />

      {loading && kpi == null && <LoadingState label="Caricamento dei KPI…" />}
      {error && <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>}

      {kpi && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Giornate stimate" value={formatDays(kpi.total_estimated_days)} />
            <Stat label="Giornate consuntivate" value={formatDays(kpi.total_actual_days)} />
            <Stat label="Avanzamento" value={`${Math.round(kpi.completion_pct)}%`} />
          </div>
          <SectionCard title="Per team" icon={<UsersThree />} bodyClassName="p-0">
            <DataTable bare data={kpi.teams} columns={TEAM_COLUMNS} getRowId={row => row.team_id} defaultSort="team" densityStorageKey="project-tracker:tutti-kpi-density" />
          </SectionCard>
          <SectionCard title="Per tipo di attività" icon={<ChartBar />} bodyClassName="p-0">
            <DataTable bare data={kpi.breakdown} columns={BREAKDOWN_COLUMNS} getRowId={row => row.task_type} defaultSort="tipo" densityStorageKey="project-tracker:tutti-kpi-density" />
          </SectionCard>
        </>
      )}
    </div>
  );
}
