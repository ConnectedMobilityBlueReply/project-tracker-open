import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { EmptyState } from '@/components/app/StateMessages';
import { FilterChip } from '@/components/app/FilterChip';
import { PageHeader } from '@/components/app/PageHeader';
import { ProjectTile } from '@/components/app/ProjectTile';
import { SectionCard } from '@/components/app/SectionCard';
import { StatusBadge } from '@/components/app/StatusBadge';
import { UndoToast, useUndoToast } from '@/components/app/UndoToast';
import { NewProjectSheet } from '@/components/progetti/NewProjectSheet';
import { Progress } from '@/components/ui/progress';
import { ArrowCounterClockwise, DownloadSimple, FolderOpen, Plus } from '@phosphor-icons/react';
import { downloadCsv } from '@/lib/csv';
import {
  applyFilters, EMPTY_FILTERS, hasActiveFilters, parseFilters, serializeFilters, type ProjectFilters,
} from '@/lib/projectFilters';
import { completionPct } from '@/lib/projectProgress';
import { consumptionTone, projectStatusTone } from '@/lib/statusTone';
import { getProjects, getOptions } from '../api';
import { PROJECT_STATUS_OPTIONS, type OptionValue, type Project } from '../types';

export default function Progetti() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // pm (cognome reale) e stato locale: non va in query string
  const [pm, setPm] = useState('');
  const filters = useMemo(() => ({ ...parseFilters(searchParams), pm }), [searchParams, pm]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [societaOptions, setSocietaOptions] = useState<OptionValue[]>([]);
  const [areaOptions, setAreaOptions] = useState<OptionValue[]>([]);
  const [pmOptions, setPmOptions] = useState<OptionValue[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const undoToast = useUndoToast();

  /** `silent`: ricarica senza riportare la tabella allo scheletro (dopo una creazione). */
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [data, soc, area, pm] = await Promise.all([
        getProjects(true),
        getOptions('societa'), getOptions('area'), getOptions('pm'),
      ]);
      setProjects(data);
      setSocietaOptions(soc); setAreaOptions(area); setPmOptions(pm);
    } catch {
      setError('Errore nel caricamento dei progetti');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const setFilter = (key: keyof ProjectFilters, value: string) => {
    if (key === 'pm') setPm(value);
    else setSearchParams(serializeFilters({ ...filters, [key]: value }), { replace: true });
  };
  const resetFilters = () => {
    setPm('');
    setSearchParams(serializeFilters(EMPTY_FILTERS), { replace: true });
  };
  const filtersActive = hasActiveFilters(filters);
  const filtered = useMemo(() => applyFilters(projects, filters), [projects, filters]);

  const handleCreated = (project: Project) => {
    setSheetOpen(false);
    void load(true);
    undoToast.show({
      message: 'Progetto creato',
      actionLabel: 'Configura',
      undo: async () => { navigate(`/admin/progetti/${project.id}`); },
    });
  };

  const handleExport = () => {
    const rows = filtered.map(p => ({
      'Società': p.societa || '',
      'Area': p.area || '',
      'PM Riferimento Cliente': p.pm_riferimento_cliente || '',
      'Nome Progetto': p.name,
      'Descrizione Attività': p.description || '',
      'Codice Offerta': p.codice_offerta || '',
      'Status Offerta': p.status_offerta || '',
      'Totale Giorni': p.estimate_days ?? '',
      'Giornate Altri Partner': p.total_partner_days ?? 0,
      'Dettaglio Altri Partner': p.partner_detail || '',
      'Totale stima': p.total_stima ?? 0,
      'Totale stima propria': p.total_stima_own ?? 0,
      'Data Inizio': p.start_date || '',
      'Data Fine': p.end_date || '',
      'Stato': p.status,
      'Avanzamento (%)': completionPct(p),
    }));
    downloadCsv('progetti.csv', rows);
  };

  const columns: readonly DataTableColumn<Project>[] = [
    { key: 'societa', header: 'Società', accessor: project => project.societa || '-', cell: project => project.societa || '-' },
    { key: 'area', header: 'Area', accessor: project => project.area || '-', cell: project => project.area || '-' },
    { key: 'pm', header: 'PM Rif. Cliente', accessor: project => project.pm_riferimento_cliente || '-', cell: project => project.pm_riferimento_cliente || '-' },
    { key: 'name', header: 'Nome Progetto', accessor: project => project.name, cell: project => <span className="flex items-center gap-2"><ProjectTile id={project.id} name={project.name} icon={project.icon} size="sm" /><span className="font-medium text-foreground">{project.name}</span></span> },
     { key: 'estimate', header: 'Totale stima', accessor: project => project.total_stima ?? 0, cell: project => `${(project.total_stima ?? 0).toFixed(1)}gg` },
     { key: 'estimate-blue', header: 'Totale stima propria', accessor: project => project.total_stima_own ?? 0, cell: project => `${(project.total_stima_own ?? 0).toFixed(1)}gg` },
    {
      key: 'period',
      header: 'Periodo',
      accessor: project => `${project.start_date || ''} ${project.end_date || ''}`,
      cell: project => project.start_date ? (
        <span>
          {project.start_date} → {project.end_date ? project.end_date : <span title="Data di fine non disponibile">—</span>}
        </span>
      ) : <span title="Date del progetto non disponibili">—</span>,
    },
    {
      key: 'status',
      header: 'Stato',
      sortable: true,
      accessor: project => project.status,
      cell: project => <StatusBadge tone={projectStatusTone(project.status)}>{project.status}</StatusBadge>,
    },
    {
      key: 'progress',
      header: 'Avanzamento',
      sortable: true,
      accessor: completionPct,
      cell: project => {
        const pct = completionPct(project);
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
        description="Panoramica di tutti i progetti"
        actions={(
          <>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <ArrowCounterClockwise />
                Reset filtri
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <DownloadSimple />
              Esporta CSV
            </Button>
            <Button onClick={() => setSheetOpen(true)}>
              <Plus />
              Nuovo progetto
            </Button>
          </>
        )}
      />

      <SectionCard title="Elenco progetti" description={`${filtered.length} ${filtered.length === 1 ? 'progetto' : 'progetti'}`} icon={<FolderOpen />} bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Input
            type="search"
            className="h-8 w-full sm:w-64"
            placeholder="Cerca per nome…"
            aria-label="Cerca progetto per nome"
            value={filters.q}
            onChange={event => setFilter('q', event.target.value)}
          />
          <FilterChip label="Stato" allLabel="Tutti gli stati" value={filters.stato} options={PROJECT_STATUS_OPTIONS} onChange={value => setFilter('stato', value)} />
          <FilterChip label="Società" allLabel="Tutte le società" value={filters.societa} options={societaOptions.map(o => o.value)} onChange={value => setFilter('societa', value)} />
          <FilterChip label="Area" allLabel="Tutte le aree" value={filters.area} options={areaOptions.map(o => o.value)} onChange={value => setFilter('area', value)} />
          <FilterChip label="PM cliente" allLabel="Tutti i PM" value={filters.pm} options={pmOptions.map(o => o.value)} onChange={value => setFilter('pm', value)} />
        </div>
        <DataTable
          bare
          hideSearch
          data={filtered}
          columns={columns}
          getRowId={project => project.id}
          defaultSort="name"
          loading={loading}
          error={error}
          onRetry={() => void load()}
          onRowActivate={project => navigate(`/progetti/${project.id}`)}
          rowLabel={project => `Apri il progetto ${project.name}`}
          emptyState={projects.length === 0 ? (
            <EmptyState bordered={false} title="Nessun progetto" action={<Button variant="ghost" onClick={() => setSheetOpen(true)}>Crea il primo progetto</Button>} />
          ) : (
            <EmptyState bordered={false} title="Nessun risultato" action={<Button variant="ghost" onClick={resetFilters}>Rimuovi i filtri</Button>} />
          )}
        />
      </SectionCard>

      <NewProjectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        societaOptions={societaOptions}
        areaOptions={areaOptions}
        pmOptions={pmOptions}
        onCreated={handleCreated}
      />
      <UndoToast notice={undoToast.notice} onDismiss={undoToast.dismiss} />
    </div>
  );
}
