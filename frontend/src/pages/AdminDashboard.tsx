import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { ChartBar, Table as TableIcon } from '@phosphor-icons/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { PageHeader } from '@/components/app/PageHeader';
import { SectionCard } from '@/components/app/SectionCard';
import { StatusBadge } from '@/components/app/StatusBadge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { consumptionTone, projectStatusTone } from '@/lib/statusTone';
import { getProjects, getProjectKPI, getGlobalKPI, getEconomicData } from '../api';
import { Project, KPIData, GlobalKPI, TASK_LABELS, TaskType, DashboardEconomicResponse } from '../types';
import EconomicTable from '../components/EconomicTable';

export default function AdminDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [globalKPI, setGlobalKPI] = useState<GlobalKPI | null>(null);
  const [economicData, setEconomicData] = useState<DashboardEconomicResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const kpiRequestRef = useRef(0);
  const projectsRequestRef = useRef(0);

  const loadProjects = useCallback(async () => {
    const requestId = ++projectsRequestRef.current;
    setProjectsError(null);
    try {
      const data = await getProjects();
      if (projectsRequestRef.current === requestId) setProjects(data);
    } catch {
      if (projectsRequestRef.current === requestId) setProjectsError('Errore nel caricamento dei progetti');
    }
  }, []);

  const loadDashboard = useCallback(async (projectId: string) => {
    const requestId = ++kpiRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const economicProjectId = projectId === 'all' ? undefined : Number(projectId);
      if (projectId === 'all') {
        const [data, economic] = await Promise.all([getGlobalKPI(), getEconomicData(economicProjectId)]);
        if (kpiRequestRef.current !== requestId) return;
        setGlobalKPI(data);
        setKpiData(null);
        setEconomicData(economic);
      } else {
        const [data, economic] = await Promise.all([getProjectKPI(Number(projectId)), getEconomicData(economicProjectId)]);
        if (kpiRequestRef.current !== requestId) return;
        setKpiData(data);
        setGlobalKPI(null);
        setEconomicData(economic);
      }
    } catch {
      if (kpiRequestRef.current === requestId) setError('Errore nel caricamento dei KPI');
    } finally {
      if (kpiRequestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    return () => { projectsRequestRef.current += 1; };
  }, [loadProjects]);

  useEffect(() => {
    void loadDashboard(selectedProjectId);
    return () => { kpiRequestRef.current += 1; };
  }, [loadDashboard, selectedProjectId]);

  const taskChartData = kpiData?.tasks.map(t => ({
    name: TASK_LABELS[t.task_type],
    'Stimate': t.allocated_days,
    'Lavorate': t.actual_days
  })) || [];

  const globalChartData = globalKPI?.projects.map(p => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
    'Stimate': p.total_estimated_days,
    'Lavorate': p.total_actual_days
  })) || [];

  type ProjectTaskKPI = KPIData['tasks'][number];
  const projectTaskColumns: readonly DataTableColumn<ProjectTaskKPI>[] = [
    {
      key: 'type', header: 'Tipo', sortable: true,
      accessor: task => TASK_LABELS[task.task_type as TaskType] || task.task_type,
      cell: task => <span className="font-medium text-foreground">{TASK_LABELS[task.task_type as TaskType] || task.task_type}</span>,
    },
    {
      key: 'estimated', header: 'Giorni Stimati', sortable: true,
      accessor: task => task.allocated_days,
      cell: task => <span className="tabular-nums text-foreground">{task.allocated_days.toFixed(1)}gg</span>,
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      key: 'actual', header: 'Giorni Lavorati', sortable: true,
      accessor: task => task.actual_days,
      cell: task => {
        const over = task.actual_days > task.allocated_days;
        return <span className={`font-medium tabular-nums ${over ? 'text-destructive' : 'text-foreground'}`}>{task.actual_days.toFixed(1)}gg</span>;
      },
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      key: 'delta', header: 'Delta', sortable: true,
      accessor: task => task.actual_days - task.allocated_days,
      cell: task => {
        const delta = task.actual_days - task.allocated_days;
        return <span className={`font-medium tabular-nums ${delta > 0 ? 'text-destructive' : 'text-success'}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}gg</span>;
      },
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      key: 'completion', header: '% Completamento', sortable: true,
      accessor: task => task.completion_pct,
      cell: task => (
        <div className="flex min-w-36 items-center gap-2">
          <Progress value={task.completion_pct} size="sm" tone={consumptionTone(task.completion_pct)} className="w-24 shrink-0" aria-label={`Avanzamento ${task.completion_pct}%`} />
          <span className="text-xs text-foreground">{task.completion_pct}%</span>
        </div>
      ),
    },
  ];

  const hasDashboardData = kpiData !== null || globalKPI !== null || economicData !== null;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="KPI ed economia"
        description="Analisi dei giorni stimati vs lavorati"
        actions={(
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
          >
            <SelectTrigger className="min-w-56">
              <SelectValue placeholder="Seleziona..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i progetti</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      {projectsError && (
        <ErrorBanner onRetry={() => void loadProjects()}>{projectsError}</ErrorBanner>
      )}

      {error && (
        <ErrorBanner onRetry={() => void loadDashboard(selectedProjectId)}>{error}</ErrorBanner>
      )}

      {loading && !hasDashboardData && !error && (
        <LoadingState label="Aggiornamento dei KPI…" className="min-h-32 rounded-card border border-border bg-card px-5" />
      )}

      {hasDashboardData && (
        <>
          {loading && <LoadingState label="Aggiornamento dei KPI…" className="justify-start py-2 text-xs" />}
          {/* PROJECT-SPECIFIC VIEW */}
          {kpiData && (
            <div className="space-y-6">
              {/* Summary blocks — mixed spans, not four equal cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="md:col-span-2 rounded-card border border-border bg-card p-4 shadow-xs">
                  <p className="text-sm text-muted-foreground">Completamento</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${kpiData.total_completion_pct > 100 ? 'text-destructive' : 'text-primary'}`}>
                    {kpiData.total_completion_pct}%
                  </p>
                  <Progress value={kpiData.total_completion_pct} size="sm" tone={consumptionTone(kpiData.total_completion_pct)} className="mt-2" aria-label={`Avanzamento ${kpiData.total_completion_pct}%`} />
                </div>
                <div className="rounded-card border border-border bg-card p-4 shadow-xs">
                  <p className="text-sm text-muted-foreground">Stima giorni</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {kpiData.estimate_days == null ? <span className="text-base text-muted-foreground">Dato non disponibile</span> : `${kpiData.estimate_days}gg`}
                  </p>
                </div>
                <div className="rounded-card border border-border bg-card p-4 shadow-xs">
                  <p className="text-sm text-muted-foreground">Giorni stimati</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{kpiData.total_estimated.toFixed(1)}gg</p>
                </div>
                <div className="rounded-card border border-border bg-card p-4 shadow-xs">
                  <p className="text-sm text-muted-foreground">Giorni lavorati</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${kpiData.total_actual > kpiData.total_estimated && kpiData.total_estimated > 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {kpiData.total_actual.toFixed(1)}gg
                  </p>
                </div>
              </div>

              {taskChartData.length === 0 ? (
                <EmptyState
                  title="Nessun task per questo progetto"
                  description="Il grafico e il dettaglio per tipo attivita' saranno disponibili quando verranno pianificate attività."
                />
              ) : (
                <>
                  <SectionCard title="Giorni Stimati vs Lavorati per Tipo" icon={<ChartBar />}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={taskChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Stimate" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Lavorate" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </SectionCard>

                  <SectionCard title="Dettaglio per Tipo Attivita'" icon={<TableIcon />} bodyClassName="p-0">
                    <DataTable
                      bare
                      data={kpiData.tasks}
                      columns={projectTaskColumns}
                      getRowId={task => task.task_type}
                      defaultSort="type"
                      searchPlaceholder="Cerca nei tipi di attività…"
                      densityStorageKey="project-tracker:admin-dashboard-task-density"
                    />
                  </SectionCard>
                </>
              )}
            </div>
          )}

          {/* GLOBAL VIEW */}
          {globalKPI && (
            <div className="space-y-6">
              {/* Summary blocks — mixed spans */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 rounded-card border border-border bg-card p-4 shadow-xs">
                  <p className="text-sm text-muted-foreground">Avanzamento globale</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${globalKPI.total_completion_pct > 100 ? 'text-destructive' : 'text-primary'}`}>
                    {globalKPI.total_completion_pct}%
                  </p>
                </div>
                <div className="rounded-card border border-border bg-card p-4 shadow-xs">
                  <p className="text-sm text-muted-foreground">Totale giorni stimati</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{globalKPI.total_estimated.toFixed(1)}gg</p>
                </div>
                <div className="rounded-card border border-border bg-card p-4 shadow-xs">
                  <p className="text-sm text-muted-foreground">Totale giorni lavorati</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{globalKPI.total_actual.toFixed(1)}gg</p>
                </div>
              </div>

              {/* Projects bar chart */}
              {globalChartData.length > 0 && (
                <SectionCard title="Giorni per Progetto" icon={<ChartBar />}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={globalChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend verticalAlign="top" />
                      <Bar dataKey="Stimate" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Lavorate" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}

              {/* Projects table */}
              {globalKPI.projects.length > 0 ? (
                <SectionCard title="Riepilogo Progetti" icon={<TableIcon />} bodyClassName="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-background">
                        <TableHead className="px-4 py-3 text-left font-semibold">Progetto</TableHead>
                        <TableHead className="px-4 py-3 text-left font-semibold">Stato</TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold">Giorni Stimati</TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold">Giorni Lavorati</TableHead>
                        <TableHead className="px-4 py-3 text-left font-semibold">Avanzamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalKPI.projects.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="px-4 py-3 whitespace-normal font-medium text-foreground">{p.name}</TableCell>
                          <TableCell className="px-4 py-3">
                            <StatusBadge tone={projectStatusTone(p.status)}>{p.status}</StatusBadge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-foreground">{p.total_estimated_days.toFixed(1)}gg</TableCell>
                          <TableCell className={`px-4 py-3 text-right font-medium ${p.total_actual_days > p.total_estimated_days && p.total_estimated_days > 0 ? 'text-destructive' : 'text-foreground'}`}>
                            {p.total_actual_days.toFixed(1)}gg
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={p.completion_pct} size="sm" tone={consumptionTone(p.completion_pct)} className="w-24 shrink-0" aria-label={`Avanzamento ${p.completion_pct}%`} />
                              <span className="text-xs text-foreground">{p.completion_pct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </SectionCard>
              ) : (
                <EmptyState title="Nessun dato disponibile" description="Crea progetti e inizia a consuntivare." />
              )}

              {/* Breakdown by type */}
              {globalKPI.breakdown_by_type.length > 0 && (
                <SectionCard title="Breakdown per Tipo Attivita'" icon={<TableIcon />} bodyClassName="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-background">
                        <TableHead className="px-4 py-3 text-left font-semibold">Tipo</TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold">Giorni Stimati</TableHead>
                        <TableHead className="px-4 py-3 text-right font-semibold">Giorni Lavorati</TableHead>
                        <TableHead className="px-4 py-3 text-left font-semibold">Avanzamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalKPI.breakdown_by_type.map(b => (
                        <TableRow key={b.task_type}>
                          <TableCell className="px-4 py-3 font-medium text-foreground">
                            {TASK_LABELS[b.task_type as TaskType] || b.task_type}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-foreground">{b.estimated_days.toFixed(1)}gg</TableCell>
                          <TableCell className={`px-4 py-3 text-right font-medium ${b.actual_days > b.estimated_days && b.estimated_days > 0 ? 'text-destructive' : 'text-foreground'}`}>
                            {b.actual_days.toFixed(1)}gg
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={b.completion_pct} size="sm" tone={consumptionTone(b.completion_pct)} className="w-24 shrink-0" aria-label={`Avanzamento ${b.completion_pct}%`} />
                              <span className="text-xs text-foreground">{b.completion_pct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </SectionCard>
              )}
            </div>
          )}

          <EconomicTable data={economicData} />
        </>
      )}
    </div>
  );
}
