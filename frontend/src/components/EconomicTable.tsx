import { useMemo, useState } from 'react';
import { CaretRight, CurrencyEur, Table as TableIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/app/StateMessages';
import { SectionCard } from '@/components/app/SectionCard';
import { StatusBadge } from '@/components/app/StatusBadge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WBS_STATUS_TONE } from '@/lib/statusTone';
import { DashboardEconomicResponse, EconomicRow, TASK_LABELS, TaskType, WBS_STATUS_LABELS, WbsStatus } from '../types';

interface EconomicTableProps {
  data: DashboardEconomicResponse | null;
}

interface RowTotals {
  effort_days: number;
  estimated_days: number;
  remaining_days: number;
  effort_eur: number;
  estimated_eur: number;
  remaining_eur: number;
  final_efficiency_eur: number | null;
  activity_count: number;
}

interface PhaseGroup {
  taskType: TaskType;
  rows: EconomicRow[];
  totals: RowTotals;
}

interface ProjectGroup {
  name: string;
  phases: PhaseGroup[];
  totals: RowTotals;
}

const eur = (v: number) => v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const round2 = (v: number) => Math.round(v * 100) / 100;

function accumulate(rows: EconomicRow[]): RowTotals {
  let effort = 0, estimated = 0, remaining = 0;
  let effortEur = 0, estimatedEur = 0, remainingEur = 0;
  let finalSum = 0, finalCount = 0;
  for (const r of rows) {
    effort += r.effort_days;
    estimated += r.estimated_days;
    remaining += r.remaining_days;
    effortEur += r.effort_eur;
    estimatedEur += r.estimated_eur;
    remainingEur += r.remaining_eur;
    if (r.final_efficiency_eur !== null) {
      finalSum += r.final_efficiency_eur;
      finalCount++;
    }
  }
  return {
    effort_days: round2(effort),
    estimated_days: round2(estimated),
    remaining_days: round2(remaining),
    effort_eur: round2(effortEur),
    estimated_eur: round2(estimatedEur),
    remaining_eur: round2(remainingEur),
    final_efficiency_eur: finalCount > 0 ? round2(finalSum) : null,
    activity_count: rows.length,
  };
}

function groupByProject(rows: EconomicRow[]): ProjectGroup[] {
  const projects: ProjectGroup[] = [];
  for (const row of rows) {
    let project = projects.find(p => p.name === row.project_name);
    if (!project) {
      project = { name: row.project_name, phases: [], totals: { effort_days: 0, estimated_days: 0, remaining_days: 0, effort_eur: 0, estimated_eur: 0, remaining_eur: 0, final_efficiency_eur: null, activity_count: 0 } };
      projects.push(project);
    }
    let phase = project.phases.find(p => p.taskType === row.task_type);
    if (!phase) {
      phase = { taskType: row.task_type, rows: [], totals: { effort_days: 0, estimated_days: 0, remaining_days: 0, effort_eur: 0, estimated_eur: 0, remaining_eur: 0, final_efficiency_eur: null, activity_count: 0 } };
      project.phases.push(phase);
    }
    phase.rows.push(row);
  }
  for (const project of projects) {
    for (const phase of project.phases) {
      phase.totals = accumulate(phase.rows);
    }
    project.totals = accumulate(project.phases.flatMap(p => p.rows));
  }
  return projects;
}

const effPct = (t: RowTotals) => (t.estimated_days > 0 ? t.remaining_days / t.estimated_days : 0);
const donePct = (t: RowTotals) => (t.estimated_days > 0 ? t.effort_days / t.estimated_days : 0);

function Chevron({ open }: { open: boolean }) {
  return (
    <CaretRight aria-hidden="true" className={`mr-2 inline-block h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
  );
}

function TotalsCell({ t, col }: { t: RowTotals; col: 'effort' | 'estimated' | 'remaining' }) {
  if (col === 'effort') return <>{t.effort_days.toFixed(1)}</>;
  if (col === 'estimated') return <>{t.estimated_days.toFixed(1)}</>;
  return <>{t.remaining_days.toFixed(1)}</>;
}

function EurTotalsCell({ t, col }: { t: RowTotals; col: 'effort' | 'estimated' | 'remaining' }) {
  if (col === 'effort') return <>{eur(t.effort_eur)}</>;
  if (col === 'estimated') return <>{eur(t.estimated_eur)}</>;
  return <>{eur(t.remaining_eur)}</>;
}

export default function EconomicTable({ data }: EconomicTableProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const projects = useMemo(
    () => (data ? groupByProject(data.rows) : []),
    [data]
  );

  if (!data || data.rows.length === 0) {
    return (
      <EmptyState title="Nessuna attività WBS disponibile per il prospetto economico." />
    );
  }

  const { summary } = data;

  const toggleProject = (name: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const togglePhase = (key: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allProjectsExpanded = projects.every(p => expandedProjects.has(p.name));
  const toggleAllProjects = () => {
    setExpandedProjects(allProjectsExpanded ? new Set() : new Set(projects.map(p => p.name)));
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Prospetto Economico"
        icon={<TableIcon />}
        bodyClassName="p-0"
        actions={(
          <button
            onClick={toggleAllProjects}
            className="text-xs font-medium text-primary hover:underline"
          >
            {allProjectsExpanded ? 'Comprimi tutti' : 'Espandi tutti'}
          </button>
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-background">
              <TableHead className="px-4 py-3 text-left font-semibold">Progetto</TableHead>
              <TableHead className="px-4 py-3 text-left font-semibold">Fase</TableHead>
              <TableHead className="px-4 py-3 text-left font-semibold">Attività</TableHead>
              <TableHead className="px-4 py-3 text-left font-semibold">Stato</TableHead>
              <TableHead className="px-4 py-3 text-left font-semibold">Assegnato a</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Effort (gg)</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Stimato (gg)</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Rimanente (gg)</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Efficienza</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Completato</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Valore Effort</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Valore Stimato</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Valore Rimanente</TableHead>
              <TableHead className="px-4 py-3 text-right font-semibold">Efficienza Finale (€)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {projects.map(project => {
                const projectOpen = expandedProjects.has(project.name);
                return (
                  <ProjectRows
                    key={project.name}
                    project={project}
                    open={projectOpen}
                    expandedPhases={expandedPhases}
                    onToggleProject={toggleProject}
                    onTogglePhase={togglePhase}
                  />
                );
              })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-background border-t-2 border-border">
              <TableCell className="px-4 py-3 font-bold text-foreground" colSpan={5}>Totale</TableCell>
              <TableCell className="px-4 py-3 text-right font-bold text-foreground">{summary.total_effort_days.toFixed(1)}</TableCell>
              <TableCell className="px-4 py-3 text-right font-bold text-foreground">{summary.total_estimated_days.toFixed(1)}</TableCell>
              <TableCell className="px-4 py-3 text-right font-bold text-foreground">{summary.total_remaining_days.toFixed(1)}</TableCell>
              <TableCell className="px-4 py-3" colSpan={2}></TableCell>
              <TableCell className="px-4 py-3 text-right font-bold text-foreground">{eur(summary.total_effort_eur)}</TableCell>
              <TableCell className="px-4 py-3 text-right font-bold text-foreground">{eur(summary.total_estimated_eur)}</TableCell>
              <TableCell className="px-4 py-3 text-right font-bold text-foreground">{eur(summary.total_remaining_eur)}</TableCell>
              <TableCell className="px-4 py-3"></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </SectionCard>

      <SectionCard title="Riepilogo Economico" icon={<CurrencyEur />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Tariffa giornaliera</p>
            <p className="text-xl font-display font-semibold tabular-nums text-foreground mt-1">{summary.rate_day != null ? `${eur(summary.rate_day)}/gg` : 'Variabile'}</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Attività filtrate</p>
            <p className="text-xl font-display font-semibold tabular-nums text-foreground mt-1">{summary.activity_count}</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Valore effort</p>
            <p className="text-xl font-display font-semibold tabular-nums text-foreground mt-1">{eur(summary.total_effort_eur)}</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">Efficienza media</p>
            <p className="text-xl font-display font-semibold tabular-nums text-primary mt-1">{pct(summary.avg_efficiency)}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

interface ProjectRowsProps {
  project: ProjectGroup;
  open: boolean;
  expandedPhases: Set<string>;
  onToggleProject: (name: string) => void;
  onTogglePhase: (key: string) => void;
}

function ProjectRows({ project, open, expandedPhases, onToggleProject, onTogglePhase }: ProjectRowsProps) {
  const t = project.totals;
  return (
    <>
      <TableRow
        className="bg-background/60 cursor-pointer select-none hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => onToggleProject(project.name)}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onToggleProject(project.name);
        }}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-label={`${open ? 'Comprimi' : 'Espandi'} fasi di ${project.name}`}
      >
        <TableCell className="px-4 py-3 whitespace-normal font-semibold text-foreground">
          <Chevron open={open} />
          {project.name}
        </TableCell>
        <TableCell className="px-4 py-3 text-foreground">{project.phases.length} {project.phases.length === 1 ? 'fase' : 'fasi'}</TableCell>
        <TableCell className="px-4 py-3 text-foreground">{t.activity_count} attività</TableCell>
        <TableCell className="px-4 py-3 text-foreground">—</TableCell>
        <TableCell className="px-4 py-3 text-foreground">—</TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground"><TotalsCell t={t} col="effort" /></TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground"><TotalsCell t={t} col="estimated" /></TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground"><TotalsCell t={t} col="remaining" /></TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground">{pct(effPct(t))}</TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground">{pct(donePct(t))}</TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground"><EurTotalsCell t={t} col="effort" /></TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground"><EurTotalsCell t={t} col="estimated" /></TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground"><EurTotalsCell t={t} col="remaining" /></TableCell>
        <TableCell className="px-4 py-3 text-right font-semibold text-foreground">
          {t.final_efficiency_eur !== null ? eur(t.final_efficiency_eur) : '—'}
        </TableCell>
      </TableRow>
      {open && project.phases.map(phase => {
        const phaseKey = `${project.name}::${phase.taskType}`;
        const phaseOpen = expandedPhases.has(phaseKey);
        const pt = phase.totals;
        return (
          <PhaseRows
            key={phaseKey}
            projectName={project.name}
            phase={phase}
            open={phaseOpen}
            onTogglePhase={onTogglePhase}
          />
        );
      })}
    </>
  );
}

interface PhaseRowsProps {
  projectName: string;
  phase: PhaseGroup;
  open: boolean;
  onTogglePhase: (key: string) => void;
}

function PhaseRows({ projectName, phase, open, onTogglePhase }: PhaseRowsProps) {
  const phaseKey = `${projectName}::${phase.taskType}`;
  const t = phase.totals;
  return (
    <>
      <TableRow
        className="cursor-pointer select-none hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => onTogglePhase(phaseKey)}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onTogglePhase(phaseKey);
        }}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-label={`${open ? 'Comprimi' : 'Espandi'} attività di ${TASK_LABELS[phase.taskType] ?? phase.taskType}`}
      >
        <TableCell className="px-4 py-2.5"></TableCell>
        <TableCell className="px-4 py-2.5 font-medium text-foreground">
          <Chevron open={open} />
          {TASK_LABELS[phase.taskType] ?? phase.taskType}
        </TableCell>
        <TableCell className="px-4 py-2.5 text-foreground">{t.activity_count} attività</TableCell>
        <TableCell className="px-4 py-2.5 text-foreground">—</TableCell>
        <TableCell className="px-4 py-2.5 text-foreground">—</TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground"><TotalsCell t={t} col="effort" /></TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground"><TotalsCell t={t} col="estimated" /></TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground"><TotalsCell t={t} col="remaining" /></TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground">{pct(effPct(t))}</TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground">{pct(donePct(t))}</TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground"><EurTotalsCell t={t} col="effort" /></TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground"><EurTotalsCell t={t} col="estimated" /></TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground"><EurTotalsCell t={t} col="remaining" /></TableCell>
        <TableCell className="px-4 py-2.5 text-right font-medium text-foreground">
          {t.final_efficiency_eur !== null ? eur(t.final_efficiency_eur) : '—'}
        </TableCell>
      </TableRow>
      {open && phase.rows.map((row: EconomicRow, i: number) => (
        <TableRow key={i} className="hover:bg-background">
          <TableCell className="px-4 py-3"></TableCell>
          <TableCell className="px-4 py-3"></TableCell>
          <TableCell className="min-w-48 px-4 py-3 pl-10 whitespace-normal text-foreground">{row.activity_name}</TableCell>
          <TableCell className="px-4 py-3">
            <StatusBadge tone={WBS_STATUS_TONE[row.status as WbsStatus] ?? 'neutral'}>
              {WBS_STATUS_LABELS[row.status as WbsStatus] ?? row.status}
            </StatusBadge>
          </TableCell>
          <TableCell className="px-4 py-3 whitespace-normal text-foreground">{row.assigned_to ?? '—'}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">{row.effort_days.toFixed(1)}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">{row.estimated_days.toFixed(1)}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">{row.remaining_days.toFixed(1)}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">{pct(row.efficiency)}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">{pct(row.completion_pct)}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">{eur(row.effort_eur)}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">{eur(row.estimated_eur)}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">{eur(row.remaining_eur)}</TableCell>
          <TableCell className="px-4 py-3 text-right text-foreground">
            {row.final_efficiency_eur !== null ? eur(row.final_efficiency_eur) : '—'}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
