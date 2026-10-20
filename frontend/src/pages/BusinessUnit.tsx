import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Buildings } from '@phosphor-icons/react';
import { getBuPeople } from '../api';
import type { BuPerson } from '../types';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/PageHeader';
import { ErrorBanner } from '@/components/app/StateMessages';
import BuGrid from '@/components/bu/BuGrid';
import BuPersonDialog from '@/components/bu/BuPersonDialog';
import { useEnterTeam } from '@/lib/useEnterTeam';
import {
  DEFAULT_HORIZON, HORIZONS, allocatedUntilLabel, filterByEngagement, formatDays, formatPct, mondayOf, summarize,
  type BuSummary, type Engagement, type Horizon,
} from '@/lib/buModel';

interface Row {
  person: BuPerson;
  summary: BuSummary;
}

const ENGAGEMENTS: readonly { value: Engagement; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'tm', label: 'T&M' },
  { value: 'turnkey', label: 'Turn Key' },
];

export default function BusinessUnit() {
  const enterTeam = useEnterTeam();
  const [weeks, setWeeks] = useState<Horizon>(DEFAULT_HORIZON);
  const [engagement, setEngagement] = useState<Engagement>('all');
  const [people, setPeople] = useState<BuPerson[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BuPerson | null>(null);
  const from = useMemo(() => mondayOf(new Date()), []);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getBuPeople(from, weeks);
      if (seq === requestSeq.current) setPeople(data);
    } catch (e) {
      if (seq === requestSeq.current) setError(e instanceof Error ? e.message : 'Errore nel caricamento');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [from, weeks]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(
    () => (people ? filterByEngagement(people, engagement) : []),
    [people, engagement],
  );
  const rows = useMemo<Row[]>(
    () => filtered.map(person => ({ person, summary: summarize(person) })),
    [filtered],
  );

  const columns: readonly DataTableColumn<Row>[] = [
    {
      key: 'persona',
      header: 'Persona',
      sortable: true,
      accessor: row => row.person.name,
      cell: row => (
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(row.person)}
            className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {row.person.name}
          </button>
          {row.person.pending && <Badge variant="secondary" size="sm" pill>in attesa</Badge>}
        </span>
      ),
    },
    {
      key: 'team',
      header: 'Team',
      sortable: true,
      accessor: row => row.person.teams.map(team => team.name).join(', '),
      cell: row => (
        <div className="flex flex-wrap gap-1">
          {row.person.teams.map(team => (enterTeam ? (
            <button
              key={team.id}
              type="button"
              aria-label={`Apri il team ${team.name}`}
              onClick={() => void enterTeam(team.id, '/timeline-team')}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Badge variant="secondary" size="sm" pill>{team.name}</Badge>
            </button>
          ) : (
            <span key={team.id} className="rounded-full">
              <Badge variant="secondary" size="sm" pill>{team.name}</Badge>
            </span>
          )))}
        </div>
      ),
    },
    {
      key: 'allocazione',
      header: 'Allocazione',
      sortable: true,
      accessor: row => row.summary.utilization ?? -1,
      cell: row => formatPct(row.summary.utilization),
    },
    {
      key: 'fino',
      header: 'Allocato fino al',
      sortable: true,
      accessor: row => row.person.allocated_until ?? '',
      cell: row => allocatedUntilLabel(row.person.allocated_until, from, weeks),
    },
    {
      key: 'scoperti',
      header: 'Giorni scoperti',
      sortable: true,
      accessor: row => row.summary.uncoveredDays,
      cell: row => <span className="tabular-nums">{formatDays(row.summary.uncoveredDays)}</span>,
    },
    {
      key: 'tm',
      header: 'T&M (gg)',
      sortable: true,
      accessor: row => row.summary.tmDays,
      cell: row => <span className="tabular-nums">{formatDays(row.summary.tmDays)}</span>,
    },
    {
      key: 'turnkey',
      header: 'Turn Key (gg)',
      sortable: true,
      accessor: row => row.summary.turnkeyDays,
      cell: row => <span className="tabular-nums">{formatDays(row.summary.turnkeyDays)}</span>,
    },
    {
      key: 'altro',
      header: 'Altro (gg)',
      sortable: true,
      accessor: row => row.summary.otherDays,
      cell: row => <span className="tabular-nums">{formatDays(row.summary.otherDays)}</span>,
    },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Business Unit"
        description="Allocazione di tutte le persone di tutti i team, oggi e nelle settimane future."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={String(weeks)} onValueChange={value => setWeeks(Number(value) as Horizon)}>
          <TabsList>
            {HORIZONS.map(horizon => (
              <TabsTrigger key={horizon} value={String(horizon)}>{horizon} sett.</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={engagement} onValueChange={value => setEngagement(value as Engagement)}>
          <TabsList>
            {ENGAGEMENTS.map(item => (
              <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error && people != null && <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>}

      <SectionCard
        title="Persone"
        description={`${rows.length} persone, prossime ${weeks} settimane`}
        icon={<Buildings />}
        bodyClassName="p-0"
      >
        <DataTable
          bare
          data={rows}
          columns={columns}
          getRowId={row => row.person.person_id}
          defaultSort="scoperti"
          defaultDirection="desc"
          searchPlaceholder="Cerca persone…"
          densityStorageKey="project-tracker:business-unit-density"
          loading={loading && people == null}
          error={people == null ? error : undefined}
          onRetry={() => void load()}
          emptyState={<p className="py-10 text-center text-sm text-muted-foreground">Nessuna persona per i filtri selezionati.</p>}
        />
      </SectionCard>

      {people != null && (
        <SectionCard title="Settimane" description="Giorni allocati per settimana" bodyClassName="p-0">
          <BuGrid people={filtered} onSelect={setSelected} />
        </SectionCard>
      )}

      <BuPersonDialog person={selected} from={from} weeks={weeks} onClose={() => setSelected(null)} />
    </div>
  );
}
