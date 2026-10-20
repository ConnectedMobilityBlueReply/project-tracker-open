import { ArrowRight, ChartPieSlice, DotsThree } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/app/StateMessages';
import { SectionCard } from '@/components/app/SectionCard';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeltaChip } from '@/components/dashboard/DeltaChip';
import { NotchBar } from '@/components/dashboard/NotchBar';
import { lastMonths, monthlyTrack, progressBanner, progressSummary } from '@/lib/dashboardModel';
import type { DashboardMonthlyRow, DashboardProject, Project } from '@/types';

const formatPercent = (value: number) => `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(value)}%`;

export function ProjectProgressCard({
  projects,
  listed,
  monthly,
  today,
}: {
  projects: readonly DashboardProject[];
  listed: readonly Project[];
  monthly: readonly DashboardMonthlyRow[];
  today: string;
}) {
  const currentMonthActual = monthlyTrack(monthly, null, lastMonths(today, 1))[0]?.actual ?? 0;
  const summary = progressSummary(projects, listed, currentMonthActual);
  const estimatedDays = projects.reduce((sum, project) => sum + project.estimated_days, 0);
  const footerMessage = progressBanner(summary, { currentMonthActual, estimatedDays });

  return (
    <SectionCard
      icon={<ChartPieSlice />}
      title="Avanzamento progetti"
      description="Completamento complessivo dei progetti."
      actions={(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" iconOnly aria-label="Altre azioni avanzamento progetti">
              <DotsThree aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link to="/admin/dashboard">Apri KPI ed economia</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{footerMessage}</span>
          <Link to="/admin/dashboard" className="inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline">
            Apri KPI ed economia <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
      footerTone={summary.progressDeltaPts > 0 ? 'success' : 'neutral'}
    >
      {projects.length === 0 ? (
        <EmptyState bordered={false} title="Nessun progetto disponibile" />
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Avanzamento</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold tabular-nums text-foreground">{formatPercent(summary.progressPct)}</span>
                <DeltaChip value={summary.progressDeltaPts} suffix=" pt" />
              </div>
            </div>
            <NotchBar value={summary.progressPct} tone="green" label="Avanzamento" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Consumo stima offerta</span>
              <span className="text-xl font-semibold tabular-nums text-foreground">{formatPercent(summary.budgetPct)}</span>
            </div>
            <NotchBar value={summary.budgetPct} tone="blue" label="Consumo stima offerta" />
          </div>
        </div>
      )}
    </SectionCard>
  );
}
