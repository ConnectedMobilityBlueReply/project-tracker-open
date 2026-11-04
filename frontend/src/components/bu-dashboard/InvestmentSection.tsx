import { Fragment, useState, type ReactNode } from 'react';
import { CaretDown, CaretRight, Briefcase } from '@phosphor-icons/react';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDays, formatIsoDate, formatPct } from '@/lib/buModel';
import { investmentByPerson, type InvestmentPerson } from '@/lib/buDashboardModel';
import type { BuInvestmentRow } from '@/types';
import type { BuSource } from './useBuDashboardData';

interface InvestmentSectionProps {
  investment: BuSource<BuInvestmentRow[]>;
  period: { from: string; to: string };
}

const NO_ROWS: BuInvestmentRow[] = [];

function days(value: number): string {
  return `${formatDays(value)} gg`;
}

function ProjectRow({ project }: { project: BuInvestmentRow }) {
  return (
    <TableRow className="bg-muted/40">
      <TableCell className="pl-10 text-muted-foreground">
        {project.project_name} <span className="text-xs">· {project.team_name}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{days(project.done_days_lifetime)}</TableCell>
      <TableCell className="text-right tabular-nums">{days(project.todo_days_lifetime)}</TableCell>
      <TableCell className="text-right tabular-nums">{days(project.done_days_period)}</TableCell>
      <TableCell className="text-right tabular-nums">{days(project.todo_days_period)}</TableCell>
      <TableCell />
    </TableRow>
  );
}

interface PersonRowsProps {
  entry: InvestmentPerson;
  expanded: boolean;
  onToggle: () => void;
}

function PersonRows({ entry, expanded, onToggle }: PersonRowsProps) {
  return (
    <Fragment>
      <TableRow>
        <TableCell>
          <Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? <CaretDown aria-hidden="true" /> : <CaretRight aria-hidden="true" />}
            {entry.person_name}
          </Button>
        </TableCell>
        <TableCell className="text-right tabular-nums">{days(entry.done_lifetime)}</TableCell>
        <TableCell className="text-right tabular-nums">{days(entry.todo_lifetime)}</TableCell>
        <TableCell className="text-right tabular-nums">{days(entry.done_period)}</TableCell>
        <TableCell className="text-right tabular-nums">{days(entry.todo_period)}</TableCell>
        <TableCell>
          {entry.progress == null ? (
            <span className="text-muted-foreground">{formatPct(null)}</span>
          ) : (
            <div className="flex min-w-32 items-center gap-3">
              <Progress
                value={entry.progress * 100}
                size="sm"
                tone="foreground"
                aria-label={`Avanzamento di ${entry.person_name}`}
              />
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatPct(entry.progress)}</span>
            </div>
          )}
        </TableCell>
      </TableRow>
      {expanded && entry.projects.map(project => <ProjectRow key={project.project_id} project={project} />)}
    </Fragment>
  );
}

/** Giorni di investimento per persona: vita del progetto e periodo selezionato, con dettaglio per progetto. */
export function InvestmentSection({ investment, period }: InvestmentSectionProps) {
  const [expanded, setExpanded] = useState<readonly number[]>([]);
  const people = investmentByPerson(investment.data ?? NO_ROWS);

  const toggle = (personId: number) => {
    setExpanded(current => current.includes(personId)
      ? current.filter(id => id !== personId)
      : [...current, personId]);
  };

  let body: ReactNode;
  if (investment.error != null) {
    body = <div className="p-4"><ErrorBanner onRetry={investment.reload}>{investment.error}</ErrorBanner></div>;
  } else if (investment.data == null) {
    body = <LoadingState label="Caricamento investimento…" />;
  } else if (people.length === 0) {
    body = <EmptyState title="Nessuna attività ad investimento nel periodo." bordered={false} />;
  } else {
    body = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Persona</TableHead>
            <TableHead className="text-right">Fatti (vita)</TableHead>
            <TableHead className="text-right">Da fare (vita)</TableHead>
            <TableHead className="text-right">Fatti (periodo)</TableHead>
            <TableHead className="text-right">Da fare (periodo)</TableHead>
            <TableHead>Avanzamento (vita)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map(entry => (
            <PersonRows
              key={entry.person_id}
              entry={entry}
              expanded={expanded.includes(entry.person_id)}
              onToggle={() => toggle(entry.person_id)}
            />
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <SectionCard
      title="Investimento"
      description={`Periodo dal ${formatIsoDate(period.from)} al ${formatIsoDate(period.to)}`}
      icon={<Briefcase />}
      bodyClassName="p-0"
    >
      {body}
    </SectionCard>
  );
}
