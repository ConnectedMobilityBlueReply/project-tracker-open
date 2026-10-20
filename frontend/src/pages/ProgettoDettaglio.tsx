import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerCount } from '@/components/ui/tabs';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { PageHeader } from '@/components/app/PageHeader';
import { SectionCard } from '@/components/app/SectionCard';
import { StatusBadge } from '@/components/app/StatusBadge';
import { ProjectKpiStrip } from '@/components/progetto/ProjectKpiStrip';
import { WbsSheet, type WbsSheetMode } from '@/components/progetto/WbsSheet';
import { ArrowLeft, CaretDown, ChartBar, ChartLine, ListChecks, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { completionTone, consumptionTone, projectStatusTone, WBS_STATUS_TONE } from '@/lib/statusTone';
import { getProject, getWbsItems, deleteWbsItem, getProjectEv } from '../api';
import { Project, WbsItem, WBS_STATUS_LABELS, WbsStatus, TASK_LABELS, TaskType, ProjectEvData, TaskDependency, ProjectTask } from '../types';
import GanttChart from '../components/GanttChart';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

interface WbsRow extends WbsItem {
  taskLabel: string;
}

export default function ProgettoDettaglio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const projectPath = id ? `/progetti/${id}` : '/progetti';
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isBaseRoute = normalizedPath === projectPath;
  const activeTab = normalizedPath.endsWith('/wbs') ? 'wbs' : 'task';

  const [project, setProject] = useState<Project | null>(null);
  const [wbsItems, setWbsItems] = useState<WbsItem[]>([]);
  const [evData, setEvData] = useState<ProjectEvData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadRetry, setLoadRetry] = useState<(() => void) | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionRetry, setActionRetry] = useState<(() => void) | null>(null);
  const [sectionErrors, setSectionErrors] = useState<{ wbs?: string; ev?: string }>({});
  // mode resta valorizzato alla chiusura: l'animazione di uscita non svuota il pannello
  const [wbsSheet, setWbsSheet] = useState<{ open: boolean; mode: WbsSheetMode }>({ open: false, mode: { kind: 'add' } });
  const openWbsSheet = (mode: WbsSheetMode) => { setActionError(null); setActionRetry(null); setWbsSheet({ open: true, mode }); };
  const closeWbsSheet = (open: boolean) => setWbsSheet(current => ({ ...current, open }));

  const loadAll = useCallback(async (projectId: number) => {
    setLoading(true);
    setError(null);
    setLoadRetry(null);
    try {
      const [projectResult, wbsResult, evResult] = await Promise.allSettled([
        getProject(projectId), getWbsItems(projectId), getProjectEv(projectId),
      ]);
      if (projectResult.status === 'rejected') {
        setError('Errore nel caricamento del progetto');
        setLoadRetry(() => () => { void loadAll(projectId); });
        return;
      }
      setProject(projectResult.value);
      if (wbsResult.status === 'fulfilled') setWbsItems(wbsResult.value);
      if (evResult.status === 'fulfilled') setEvData(evResult.value);
      setSectionErrors({
        wbs: wbsResult.status === 'rejected' ? 'Errore nel caricamento dei componenti WBS' : undefined,
        ev: evResult.status === 'rejected' ? "Errore nel caricamento dell'Earned Value" : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id || isBaseRoute) return;
    const projectId = Number(id);
    if (!Number.isFinite(projectId)) {
      setError('Progetto non trovato');
      setLoading(false);
      return;
    }
    void loadAll(projectId);
  }, [id, isBaseRoute, loadAll]);

  const allPersons = useMemo(() => (project?.tasks ?? [])
    .flatMap(t => t.allocations)
    .reduce((acc, a) => {
      if (!acc.find(p => p.id === a.person_id)) acc.push({ id: a.person_id, name: a.person_name });
      return acc;
    }, [] as { id: number; name: string }[])
    .sort((a, b) => a.name.localeCompare(b.name)), [project?.tasks]);

  const wbsRows = useMemo<WbsRow[]>(() => wbsItems.map(item => {
    const task = project?.tasks?.find(candidate => candidate.id === item.task_id);
    return {
      ...item,
      taskLabel: task ? (TASK_LABELS[task.task_type as TaskType] || task.task_type) : `Task ${item.task_id}`,
    };
  }), [project?.tasks, wbsItems]);

  if (isBaseRoute && id) {
    return <Navigate to={`${projectPath}/task`} replace />;
  }

  if (loading && !project) {
    return (
      <div className="space-y-5 p-4 md:p-6">
        <LoadingState label="Caricamento progetto…" className="min-h-64" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-5 p-4 md:p-6">
        <ErrorBanner onRetry={loadRetry ? () => loadRetry() : undefined}>{error || 'Progetto non trovato'}</ErrorBanner>
      </div>
    );
  }

  const totalEstimated = project.tasks?.length
    ? project.tasks.reduce((s, t) => s + t.allocations.reduce((a, al) => a + al.estimated_days, 0), 0)
    : (project.total_estimated_days ?? 0);
  const totalActual = project.tasks?.length
    ? project.tasks.reduce((s, t) => s + (t.actual_days ?? 0), 0)
    : (project.total_actual_days ?? 0);
  const completionPct = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;
  const totalPartnerDays = project.total_partner_days ?? 0;
  const totalStima = project.total_stima ?? 0;
  const totalStimaOwn = project.total_stima_own ?? 0;

  const startDate = project.start_date
    ?? (project.tasks?.flatMap(t => t.planned_start ? [t.planned_start] : []).sort()[0] ?? null);
  const endDate = project.end_date
    ?? (project.tasks?.flatMap(t => t.planned_end ? [t.planned_end] : []).sort().reverse()[0] ?? null);

  const wbsFor = (taskId: number) => wbsItems.filter(w => w.task_id === taskId);

  const wbsEv = (taskId: number) => {
    const items = wbsFor(taskId);
    if (!items.length) return null;
    const total = items.reduce((s, w) => s + w.estimated_days, 0);
    const earned = items.reduce((s, w) => s + w.estimated_days * w.completion_pct / 100, 0);
    return total > 0 ? Math.round((earned / total) * 100) : 0;
  };

  const EvKpi = ({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) => (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="mb-1 text-sm text-muted-foreground">{label}</p>
      <p className={`text-lg font-display font-semibold tabular-nums ${color}`}>
        {suffix === '€' ? `€${value.toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : value.toFixed(2)}
      </p>
    </div>
  );

  const handleDelete = async (wbsId: number) => {
    setActionError(null);
    setActionRetry(null);
    setDeleting(true);
    try {
      await deleteWbsItem(wbsId);
      setDeleteConfirm(null);
      await loadAll(Number(id));
    } catch {
      setActionError("Errore nell'eliminazione del componente WBS");
      setActionRetry(() => () => { void handleDelete(wbsId); });
    } finally {
      setDeleting(false);
    }
  };

  const retryWbs = async () => {
    try {
      setWbsItems(await getWbsItems(project.id));
      setSectionErrors(current => ({ ...current, wbs: undefined }));
    } catch {
      // l'errore di sezione resta visibile: l'utente può riprovare
    }
  };

  const retryEv = async () => {
    try {
      setEvData(await getProjectEv(project.id));
      setSectionErrors(current => ({ ...current, ev: undefined }));
    } catch {
      // idem
    }
  };

  const taskColumns: readonly DataTableColumn<ProjectTask>[] = [
    {
      key: 'type', header: 'Tipo', sortable: true,
      accessor: task => TASK_LABELS[task.task_type as TaskType] || task.task_type,
      cell: task => <span className="font-medium text-foreground">{TASK_LABELS[task.task_type as TaskType] || task.task_type}</span>,
    },
    { key: 'start', header: 'Inizio', sortable: true, accessor: task => task.planned_start || '9999-12-31', cell: task => task.planned_start || '—' },
    { key: 'end', header: 'Fine', sortable: true, accessor: task => task.planned_end || '9999-12-31', cell: task => task.planned_end || '—' },
    { key: 'estimated', header: 'Gg. Stim.', sortable: true, accessor: task => task.estimated_days ?? 0, cell: task => task.estimated_days ?? '—' },
    {
      key: 'allocated', header: 'Gg. Alloc.', sortable: true,
      accessor: task => task.allocations.reduce((sum, allocation) => sum + allocation.estimated_days, 0),
      cell: task => `${task.allocations.reduce((sum, allocation) => sum + allocation.estimated_days, 0).toFixed(1)}gg`,
    },
    {
      key: 'actual', header: 'Gg. Lav.', sortable: true,
      accessor: task => task.actual_days ?? 0,
      cell: task => `${(task.actual_days ?? 0).toFixed(1)}gg`,
    },
    {
      key: 'progress', header: '% / EV', sortable: true,
      accessor: task => {
        const allocated = task.allocations.reduce((sum, allocation) => sum + allocation.estimated_days, 0);
        return allocated > 0 ? Math.round(((task.actual_days ?? 0) / allocated) * 100) : 0;
      },
      cell: task => {
        const allocated = task.allocations.reduce((sum, allocation) => sum + allocation.estimated_days, 0);
        const pct = allocated > 0 ? Math.round(((task.actual_days ?? 0) / allocated) * 100) : 0;
        const ev = wbsEv(task.id);
        return (
          <div className="flex min-w-28 flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <Progress value={pct} size="sm" tone={consumptionTone(pct)} className="w-12" aria-label={`Avanzamento ${pct}%`} />
              <span className="text-xs text-muted-foreground">{pct}%</span>
            </div>
            {ev !== null && <span className="text-xs font-medium text-success">EV {ev}%</span>}
          </div>
        );
      },
    },
    {
      key: 'team', header: 'Team',
      accessor: task => task.allocations.map(allocation => allocation.person_name).join(' '),
      cell: task => <div className="flex flex-wrap gap-1">{task.allocations.map(allocation => <Badge key={allocation.id} variant="secondary" size="sm" pill>{allocation.person_name}</Badge>)}</div>,
    },
  ];

  const wbsColumns: readonly DataTableColumn<WbsRow>[] = [
    { key: 'task', header: 'Task', sortable: true, accessor: row => row.taskLabel, cell: row => row.taskLabel },
    { key: 'name', header: 'Componente', sortable: true, accessor: row => row.name, cell: row => <span className="font-medium text-foreground">{row.name}</span> },
    { key: 'estimated', header: 'Gg. Stim.', sortable: true, accessor: row => row.estimated_days, cell: row => `${row.estimated_days}gg` },
    { key: 'effort', header: 'Gg. Lav.', sortable: true, accessor: row => row.effort_days ?? 0, cell: row => `${(row.effort_days ?? 0).toFixed(1)}gg` },
    { key: 'assignee', header: 'Assegnato', sortable: true, accessor: row => row.assignee_person_name ?? '', cell: row => row.assignee_person_name ?? '—' },
    { key: 'status', header: 'Stato', sortable: true, accessor: row => WBS_STATUS_LABELS[row.status as WbsStatus] ?? row.status, cell: row => <StatusBadge tone={WBS_STATUS_TONE[row.status as WbsStatus]}>{WBS_STATUS_LABELS[row.status as WbsStatus] ?? row.status}</StatusBadge> },
    {
      key: 'completion', header: '%', sortable: true, accessor: row => row.completion_pct,
      cell: row => <div className="flex min-w-24 items-center gap-1.5"><Progress value={row.completion_pct} size="sm" tone={completionTone(row.completion_pct)} className="w-12" aria-label={`Completamento ${row.completion_pct}%`} /><span className="text-xs tabular-nums">{row.completion_pct}%</span></div>,
    },
    { key: 'start', header: 'Inizio', sortable: true, accessor: row => row.planned_start || '9999-12-31', cell: row => row.planned_start ?? '—' },
    { key: 'end', header: 'Fine', sortable: true, accessor: row => row.planned_end || '9999-12-31', cell: row => row.planned_end ?? '—' },
    {
      key: 'actions', header: 'Azioni',
      cell: row => (
        <div className="flex gap-1">
          <Button type="button" variant="ghost" iconOnly size="sm" aria-label={`Modifica componente ${row.name}`} onClick={() => openWbsSheet({ kind: 'edit', item: row })} className="text-muted-foreground hover:text-primary">
            <PencilSimple aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" iconOnly size="sm" aria-label={`Elimina componente ${row.name}`} onClick={() => setDeleteConfirm(row.id)} className="text-muted-foreground hover:text-destructive">
            <Trash aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const refreshLoading = loading && project !== null;
  const initialLoading = loading && project === null;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        leading={<Button type="button" iconOnly variant="ghost" aria-label="Torna ai progetti" onClick={() => navigate('/progetti')}><ArrowLeft /></Button>}
        title={project.name}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge tone={projectStatusTone(project.status)}>{project.status}</StatusBadge>{project.description}</span>}
        actions={<Button type="button" variant="outline" onClick={() => navigate(`/admin/progetti/${project.id}`)}>Modifica</Button>}
      />

      {refreshLoading && <LoadingState label="Aggiornamento…" className="justify-start py-2" />}
      {error && <ErrorBanner onRetry={loadRetry ? () => loadRetry() : undefined}>{error}</ErrorBanner>}
      {actionError && <ErrorBanner onRetry={actionRetry ? () => actionRetry() : undefined}>{actionError}</ErrorBanner>}

      <ProjectKpiStrip
        completionPct={completionPct}
        totalEstimated={totalEstimated}
        totalActual={totalActual}
        totalStima={totalStima}
        startDate={startDate}
        endDate={endDate}
        estimateDays={project.estimate_days}
        totalPartnerDays={totalPartnerDays}
        totalStimaOwn={totalStimaOwn}
        partnerAllocations={project.partner_allocations ?? []}
      />

      <Tabs variant="line" value={activeTab} onValueChange={value => { if (value === 'task' || value === 'wbs') navigate(`${projectPath}/${value}`); }}>
        <TabsList>
          <TabsTrigger value="task">Task <TabsTriggerCount>{project.tasks?.length ?? 0}</TabsTriggerCount></TabsTrigger>
          <TabsTrigger value="wbs">Componenti WBS <TabsTriggerCount>{wbsItems.length}</TabsTriggerCount></TabsTrigger>
        </TabsList>

        <TabsContent value="task" className="mt-5">
          <SectionCard title="Task del progetto" description="Elenco delle attività e delle relative allocazioni." icon={<ListChecks />} bodyClassName="p-0">
            <DataTable
              bare
              data={project.tasks ?? []}
              columns={taskColumns}
              getRowId={task => task.id}
              defaultSort="type"
              searchPlaceholder="Cerca nei task…"
              densityStorageKey="project-tracker:project-detail-task-density"
              loading={initialLoading}
              error={initialLoading ? error : undefined}
              onRetry={() => loadAll(project.id)}
              emptyState={<EmptyState title="Nessun task configurato per questo progetto." bordered={false} />}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="wbs" className="mt-5">
          <SectionCard
            title="Componenti WBS"
            description="Cerca, ordina e aggiorna i componenti di lavoro del progetto."
            icon={<ListChecks />}
            actions={(
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" disabled={!project.tasks?.length}><Plus aria-hidden="true" /> Aggiungi <CaretDown aria-hidden="true" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => openWbsSheet({ kind: 'add' })}>Aggiungi componente</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openWbsSheet({ kind: 'dates' })}>Da elenco date</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            bodyClassName="p-0"
          >
            <DataTable
              bare
              data={wbsRows}
              columns={wbsColumns}
              getRowId={row => row.id}
              defaultSort="task"
              searchPlaceholder="Cerca nei componenti WBS…"
              densityStorageKey="project-tracker:project-detail-wbs-density"
              loading={initialLoading}
              error={initialLoading ? error : sectionErrors.wbs}
              onRetry={initialLoading ? () => loadAll(Number(id)) : () => void retryWbs()}
              emptyState={<EmptyState title="Nessun componente WBS configurato per questo progetto." bordered={false} />}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      {sectionErrors.ev && <ErrorBanner onRetry={() => void retryEv()}>{sectionErrors.ev}</ErrorBanner>}
      {evData && (evData.budget_eur > 0 || evData.ac_eur > 0) && (
        <SectionCard title="Earned Value Analysis" icon={<ChartLine />}>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            <EvKpi label="Budget (PV)" value={evData.budget_eur} color="text-foreground" suffix="€" />
            <EvKpi label="Earned Value" value={evData.ev_eur} color="text-success" suffix="€" />
            <EvKpi label="Actual Cost" value={evData.ac_eur} color={evData.ac_eur > evData.ev_eur ? 'text-destructive' : 'text-primary'} suffix="€" />
            <EvKpi label="CPI" value={evData.cpi} color={evData.cpi >= 1 ? 'text-success' : evData.cpi >= 0.8 ? 'text-warning' : 'text-destructive'} />
            <EvKpi label="SPI" value={evData.spi} color={evData.spi >= 1 ? 'text-success' : evData.spi >= 0.8 ? 'text-warning' : 'text-destructive'} />
            <EvKpi label="VAC" value={evData.vac} color={evData.vac >= 0 ? 'text-success' : 'text-destructive'} suffix="€" />
          </div>
          <p className="text-xs text-muted-foreground">CPI = EV/AC (≥1 sotto budget) · SPI = EV/Budget (≥1 in anticipo) · VAC = Budget − AC</p>
          {evData.curve.length > 0 && <ResponsiveContainer width="100%" height={260}><ComposedChart data={evData.curve} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={week => { const date = new Date(week); return `${date.getDate()}/${date.getMonth() + 1}`; }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={value => `€${(value / 1000).toFixed(0)}k`} /><Tooltip formatter={(value: number, name: string) => [`€${value.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`, name]} labelFormatter={week => `Settimana ${week}`} /><Legend /><Area type="monotone" dataKey="pv" name="PV (pianificato)" fill="var(--chart-1)" stroke="var(--chart-1)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="ac" name="AC (costo reale)" stroke="var(--destructive)" strokeWidth={2} dot={false} /><ReferenceLine y={evData.ev_eur} stroke="var(--success)" strokeDasharray="5 5" label={{ value: `EV €${Math.round(evData.ev_eur).toLocaleString('it-IT')}`, position: 'right', fontSize: 11, fill: 'var(--success)' }} /></ComposedChart></ResponsiveContainer>}
        </SectionCard>
      )}

      {project.tasks && project.tasks.length > 0 && (
        <SectionCard title="Gantt del Progetto" icon={<ChartBar />}>
          <GanttChart tasks={project.tasks} dependencies={project.tasks.flatMap(task => (task.dependencies ?? []) as TaskDependency[])} />
        </SectionCard>
      )}

      <WbsSheet
        open={wbsSheet.open}
        mode={wbsSheet.mode}
        tasks={project.tasks ?? []}
        persons={allPersons}
        onOpenChange={closeWbsSheet}
        onSaved={() => loadAll(project.id)}
      />

      <Dialog open={deleteConfirm !== null} onOpenChange={open => { if (!open && !deleting) setDeleteConfirm(null); }}>
        <DialogContent className="rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Elimina componente WBS</DialogTitle>
            <DialogDescription>
              Stai per eliminare il componente WBS “{wbsItems.find(item => item.id === deleteConfirm)?.name ?? 'selezionato'}”. L’azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Annulla</Button>
            <Button type="button" variant="destructive" onClick={() => { if (deleteConfirm !== null) void handleDelete(deleteConfirm); }} disabled={deleting}>{deleting ? 'Eliminazione…' : 'Elimina componente'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
