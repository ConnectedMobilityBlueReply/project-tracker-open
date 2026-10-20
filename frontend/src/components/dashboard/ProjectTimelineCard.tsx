import { CalendarBlank, CalendarDots, Plus } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/app/StateMessages';
import { ProjectTile } from '@/components/app/ProjectTile';
import { SectionCard } from '@/components/app/SectionCard';
import { AvatarFallback, AvatarRoot } from '@/components/ui/avatar';
import { AvatarGroup } from '@/components/ui/avatar-group';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { avatarColorFor, initials } from '@/lib/people';
import { filterDashboardProjects, monthWeeks, timelineRows } from '@/lib/dashboardModel';
import { PROJECT_STATUS_OPTIONS, type DashboardProject } from '@/types';

const ALL_STATUSES = 'all';

const PILL_TONES: Record<string, { surface: string; border: string }> = {
  'da lavorare': { surface: 'bg-pill-orange', border: 'border-l-orange' },
  'in lavorazione': { surface: 'bg-pill-green', border: 'border-l-success' },
  concluso: { surface: 'bg-pill-blue', border: 'border-l-info' },
  'lavorato a consuntivo': { surface: 'bg-pill-purple', border: 'border-l-purple' },
};

function currentMonthLabel(today: string) {
  const [year, month] = today.slice(0, 7).split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day, 12));
}

export function ProjectTimelineCard({ projects, today }: { projects: readonly DashboardProject[]; today: string }) {
  const [status, setStatus] = useState(ALL_STATUSES);
  const weeks = useMemo(() => monthWeeks(today), [today]);
  const statusFiltered = useMemo(() => filterDashboardProjects(projects, '', status), [projects, status]);
  const rows = useMemo(() => timelineRows(statusFiltered, weeks), [statusFiltered, weeks]);
  const columns = `repeat(${weeks.length}, minmax(0, 1fr))`;

  return (
    <SectionCard
      icon={<CalendarDots />}
      title="Timeline progetti"
      description="Progetti nelle settimane del mese corrente."
      actions={(
        <>
          <Badge variant="secondary" size="sm" pill>
            <CalendarBlank aria-hidden="true" />
            {currentMonthLabel(today)}
          </Badge>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" className="w-auto" aria-label="Filtra timeline per stato progetto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>Tutti gli stati</SelectItem>
              {PROJECT_STATUS_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm">
            <Link to="/planning/capacita"><Plus aria-hidden="true" />Pianificazione</Link>
          </Button>
        </>
      )}
    >
      {rows.length === 0 ? (
        <EmptyState bordered={false} title="Nessun progetto con date nel mese corrente" />
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[32rem]">
            <div
              className="grid border-b border-border pb-2 text-xs font-medium text-muted-foreground"
              style={{ gridTemplateColumns: columns }}
              role="group"
              aria-label="Settimane del mese"
            >
              {weeks.map(week => (
                <div key={week.start} className="border-l border-dashed border-border px-2 first:border-l-0">
                  {week.label}
                </div>
              ))}
            </div>
            <div role="list" className="divide-y divide-border">
              {rows.map(({ project, startIndex, span }) => {
                const tone = PILL_TONES[project.status] ?? PILL_TONES.concluso;
                return (
                  <div key={project.id} role="listitem" className="py-1">
                    <div className="relative h-10">
                      <div aria-hidden="true" className="absolute inset-0 grid" style={{ gridTemplateColumns: columns }}>
                        {weeks.map(week => (
                          <span key={week.start} className="border-l border-dashed border-border first:border-l-0" />
                        ))}
                      </div>
                      <div className="absolute inset-0 grid items-center" style={{ gridTemplateColumns: columns }}>
                        <div
                          role="group"
                          className={`z-10 flex h-9 min-w-0 items-center gap-2 overflow-hidden rounded-sm border-l-[3px] px-2 ${tone.surface} ${tone.border}`}
                          style={{ gridColumn: `${startIndex + 1} / span ${span}` }}
                          aria-label={`${project.name}, dal ${formatDate(project.start_date!)} al ${formatDate(project.end_date!)}`}
                        >
                          <ProjectTile id={project.id} name={project.name} icon={project.icon} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{project.name}</span>
                          {project.persons.length > 0 && (
                            <AvatarGroup
                              size="xs"
                              max={4}
                              role="group"
                              aria-label={`Persone assegnate a ${project.name}`}
                              renderOverflow={overflow => (
                                <AvatarRoot size="xs" role="img" aria-label={overflow === 1 ? "un'altra persona" : `altre ${overflow} persone`}>
                                  <AvatarFallback maxInitials={4} className="tabular-nums">{`+${overflow}`}</AvatarFallback>
                                </AvatarRoot>
                              )}
                            >
                              {project.persons.map(person => (
                                <AvatarRoot key={person.id} size="xs" color={avatarColorFor(person.name)} role="img" aria-label={person.name}>
                                  <AvatarFallback>{initials(person.name)}</AvatarFallback>
                                </AvatarRoot>
                              ))}
                            </AvatarGroup>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
