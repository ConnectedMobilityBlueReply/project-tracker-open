import { Gauge } from '@phosphor-icons/react';
import { SectionCard } from '@/components/app/SectionCard';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { EmptyState } from '@/components/app/StateMessages';
import { formatDays, formatIsoDate, round2 } from '@/lib/buModel';
import type { BuEfficiency, BuTkSaving, BuTmOverlap } from '@/types';
import type { BuSource } from './useBuDashboardData';

interface EfficiencySectionProps {
  efficiency: BuSource<BuEfficiency>;
  period: { from: string; to: string };
}

const NO_TK: BuTkSaving[] = [];
const NO_TM: BuTmOverlap[] = [];

const numberCell = 'text-right tabular-nums';

const TK_COLUMNS: readonly DataTableColumn<BuTkSaving>[] = [
  { key: 'project', header: 'Progetto', accessor: row => row.project_name, sortable: true },
  { key: 'team', header: 'Team', accessor: row => row.team_name, sortable: true },
  {
    key: 'estimate',
    header: 'Stima',
    accessor: row => row.estimate_days,
    cell: row => `${formatDays(row.estimate_days)} gg`,
    sortable: true,
    className: numberCell,
    headerClassName: 'text-right',
  },
  {
    key: 'actual',
    header: 'Consuntivato',
    accessor: row => row.actual_days,
    cell: row => `${formatDays(row.actual_days)} gg`,
    sortable: true,
    className: numberCell,
    headerClassName: 'text-right',
  },
  {
    key: 'saved',
    header: 'Giorni risparmiati',
    accessor: row => row.saved_days,
    cell: row => `${formatDays(row.saved_days)} gg`,
    sortable: true,
    className: numberCell,
    headerClassName: 'text-right',
  },
];

const TM_COLUMNS: readonly DataTableColumn<BuTmOverlap>[] = [
  { key: 'person', header: 'Persona', accessor: row => row.person_name, sortable: true },
  {
    key: 'overlap',
    header: 'Giorni in parallelo',
    accessor: row => row.overlap_days,
    cell: row => `${formatDays(row.overlap_days)} gg`,
    sortable: true,
    className: numberCell,
    headerClassName: 'text-right',
  },
];

/** Efficienza nel periodo: risparmio dei Turn Key chiusi e giorni TM in parallelo, ciascuna con tabella propria. */
export function EfficiencySection({ efficiency, period }: EfficiencySectionProps) {
  const tkRows = efficiency.data?.tk_closed ?? NO_TK;
  const tmRows = efficiency.data?.tm_overlap ?? NO_TM;
  const totalSaved = efficiency.data == null
    ? null
    : round2(tkRows.reduce((total, row) => total + row.saved_days, 0));
  const periodLabel = `Periodo dal ${formatIsoDate(period.from)} al ${formatIsoDate(period.to)}`;
  const loading = efficiency.loading && efficiency.data == null;

  return (
    <SectionCard title="Efficienza" description={periodLabel} icon={<Gauge />} bodyClassName="p-0">
      <div className="space-y-6 py-5">
        <div>
          <h3 className="px-5 text-base font-semibold text-foreground">Progetti Turn Key chiusi</h3>
          <p className="px-5 pt-1 text-sm text-muted-foreground">
            Risparmio = stima − consuntivato, sui progetti chiusi con fine pianificata nel periodo.
            Totale risparmiato: <span className="font-medium text-foreground">{totalSaved == null ? '—' : `${formatDays(totalSaved)} gg`}</span>
          </p>
          <div className="pt-3">
            <DataTable
              bare
              hideSearch
              data={tkRows}
              columns={TK_COLUMNS}
              getRowId={row => row.project_id}
              defaultSort="saved"
              defaultDirection="desc"
              loading={loading}
              error={efficiency.error ?? undefined}
              onRetry={efficiency.reload}
              emptyState={<EmptyState title="Nessun progetto Turn Key chiuso nel periodo." bordered={false} />}
            />
          </div>
        </div>
        <div>
          <h3 className="px-5 text-base font-semibold text-foreground">TM in parallelo</h3>
          <p className="px-5 pt-1 text-sm text-muted-foreground">
            Giorni in cui un progetto TM è pianificato insieme ad altri progetti, nel periodo.
          </p>
          <div className="pt-3">
            <DataTable
              bare
              hideSearch
              data={tmRows}
              columns={TM_COLUMNS}
              getRowId={row => row.person_id}
              defaultSort="overlap"
              defaultDirection="desc"
              loading={loading}
              error={efficiency.error ?? undefined}
              onRetry={efficiency.reload}
              emptyState={<EmptyState title="Nessuna sovrapposizione TM nel periodo." bordered={false} />}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
