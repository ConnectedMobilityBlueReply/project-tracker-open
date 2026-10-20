import { ArrowRight, ClockCountdown } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/app/StateMessages';
import { ProjectTile } from '@/components/app/ProjectTile';
import { SectionCard } from '@/components/app/SectionCard';
import { DeltaChip } from '@/components/dashboard/DeltaChip';
import { MonthBars } from '@/components/dashboard/MonthBars';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { lastMonths, monthlyTrack, trackBanner, trackDelta } from '@/lib/dashboardModel';
import type { DashboardMonthlyRow, DashboardProject } from '@/types';

const ALL_PROJECTS = '__all__';
const formatDays = (value: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value);

export function ProjectTrackCard({ monthly, projects, today }: { monthly: readonly DashboardMonthlyRow[]; projects: readonly DashboardProject[]; today: string }) {
  const [projectId, setProjectId] = useState<number | null>(null);
  const projectOptions = useMemo(() => {
    const byId = new Map<number, string>();
    monthly.forEach(row => byId.set(row.project_id, row.project_name));
    const projectById = new Map(projects.map(project => [project.id, project]));
    return Array.from(byId, ([id, name]) => ({ id, name, icon: projectById.get(id)?.icon ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  }, [monthly, projects]);
  const points = monthlyTrack(monthly, projectId, lastMonths(today, 3));
  const delta = trackDelta(points);
  const hasData = points.some(point => point.planned > 0 || point.actual > 0);

  return (
    <SectionCard
      icon={<ClockCountdown />}
      title="Andamento progetti"
      description="Pianificato e consuntivato per mese."
      actions={(
        <>
          <Select
            value={projectId == null ? ALL_PROJECTS : String(projectId)}
            onValueChange={value => setProjectId(value === ALL_PROJECTS ? null : Number(value))}
          >
            <SelectTrigger size="sm" className="max-w-44" aria-label="Filtra per progetto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>Tutti i progetti</SelectItem>
              {projectOptions.map(project => (
                <SelectItem key={project.id} value={String(project.id)}>
                  <ProjectTile id={project.id} name={project.name} icon={project.icon} size="sm" />
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select disabled value="last-3">
            <SelectTrigger size="sm" className="w-auto" aria-label="Periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-3">Ultimi 3 mesi</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{trackBanner(delta)}</span>
          <Link to="/planning/capacita" className="inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline">
            Apri pianificazione <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}
      footerTone={delta.deltaPct != null && delta.deltaPct > 0 ? 'success' : 'neutral'}
    >
      {!hasData ? (
        <EmptyState bordered={false} title="Nessuna pianificazione o consuntivo negli ultimi 3 mesi" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-foreground">{formatDays(delta.current)} gg</p>
              <p className="text-sm text-muted-foreground">consuntivati</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <DeltaChip value={delta.deltaPct} suffix="%" />
              <span className="text-xs text-muted-foreground">vs mese precedente</span>
            </div>
          </div>
          <MonthBars points={points} />
        </div>
      )}
    </SectionCard>
  );
}
