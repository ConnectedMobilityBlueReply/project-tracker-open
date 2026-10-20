import { CaretDown, CaretRight, ListChecks, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState } from '@/components/app/StateMessages';
import { ProjectTile } from '@/components/app/ProjectTile';
import { SectionCard } from '@/components/app/SectionCard';
import { StatusBadge } from '@/components/app/StatusBadge';
import { ProgressRing } from '@/components/dashboard/ProgressRing';
import { AvatarFallback, AvatarRoot } from '@/components/ui/avatar';
import { AvatarGroup } from '@/components/ui/avatar-group';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { avatarColorFor, initials } from '@/lib/people';
import { filterDashboardProjects, pct } from '@/lib/dashboardModel';
import { minimumRoleForPath, roleAtLeast } from '@/auth/routeAccess';
import { projectStatusTone } from '@/lib/statusTone';
import { PROJECT_STATUS_OPTIONS, TASK_LABELS, type DashboardProject } from '@/types';

const ALL_STATUSES = 'all';

function formatDate(value: string | null) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day, 12));
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(value)}%`;
}

export function ProjectListCard({ projects }: { projects: readonly DashboardProject[] }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(ALL_STATUSES);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const visibleProjects = filterDashboardProjects(projects, query, status);
  const createMinimum = minimumRoleForPath('/admin/progetti') ?? 'admin';
  const canCreate = user != null && roleAtLeast(user.appRole, createMinimum);

  const toggleExpanded = (projectId: number) => {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  return (
    <SectionCard
      icon={<ListChecks />}
      title="Elenco progetti"
      description="Tutti i progetti, con task, persone e avanzamento."
      bodyClassName="p-0"
      actions={(
        <>
          <div className="relative w-full min-w-56 sm:w-64">
            <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Cerca progetto, task, società…"
              aria-label="Cerca progetto, task, società"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" className="w-auto" aria-label="Filtra elenco per stato progetto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>Tutti gli stati</SelectItem>
              {PROJECT_STATUS_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/progetti"><Plus aria-hidden="true" />Nuovo progetto</Link>
            </Button>
          )}
        </>
      )}
    >
      {visibleProjects.length === 0 ? (
        <EmptyState
          bordered={false}
          title={projects.length === 0 ? 'Nessun progetto da mostrare' : 'Nessun progetto corrisponde ai filtri'}
        />
      ) : (
        <>
          <ul className="divide-y divide-border md:hidden">
            {visibleProjects.map(project => {
              const progress = pct(project.actual_days, project.estimated_days);
              return (
                <li key={project.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Link to={`/progetti/${project.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{project.name}</div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="sr-only">{formatPercent(progress)}</span>
                  </Link>
                  <StatusBadge tone={projectStatusTone(project.status)} size="sm">{project.status}</StatusBadge>
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block">
            <Table className="min-w-[65rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-muted-foreground">Progetto</TableHead>
                  <TableHead className="text-muted-foreground">Scadenza</TableHead>
                  <TableHead className="text-muted-foreground">Riferimenti</TableHead>
                  <TableHead className="text-muted-foreground">Persone</TableHead>
                  <TableHead className="text-muted-foreground">Stato</TableHead>
                  <TableHead className="text-muted-foreground">Avanzamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProjects.map(project => {
                  const isExpanded = expanded.has(project.id);
                  const progress = pct(project.actual_days, project.estimated_days);
                  const references = [
                    project.societa && `Società: ${project.societa}`,
                    project.area && `Area: ${project.area}`,
                    project.codice_offerta && `Offerta: ${project.codice_offerta}`,
                  ].filter((value): value is string => Boolean(value));

                  return (
                    <Fragment key={project.id}>
                      <TableRow>
                        <TableCell className="whitespace-normal">
                          <div className="flex min-w-0 items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              iconOnly
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Comprimi' : 'Espandi'} ${project.name}`}
                              onClick={() => toggleExpanded(project.id)}
                            >
                              {isExpanded ? <CaretDown aria-hidden="true" /> : <CaretRight aria-hidden="true" />}
                            </Button>
                            <ProjectTile id={project.id} name={project.name} icon={project.icon} size="sm" />
                            <span className="min-w-0 break-words font-medium text-foreground">{project.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(project.end_date)}</TableCell>
                        <TableCell className="whitespace-normal">
                          {references.length > 0 ? (
                            <div className="flex max-w-xs flex-wrap gap-1">
                              {references.map(reference => (
                                <Badge key={reference} variant="secondary" size="sm" className="max-w-full whitespace-normal break-words text-left">
                                  {reference}
                                </Badge>
                              ))}
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {project.persons.length > 0 ? (
                            <AvatarGroup
                              size="sm"
                              max={4}
                              role="group"
                              aria-label={`Persone assegnate a ${project.name}`}
                              renderOverflow={overflow => (
                                <AvatarRoot size="sm" role="img" aria-label={overflow === 1 ? "un'altra persona" : `altre ${overflow} persone`}>
                                  <AvatarFallback maxInitials={4} className="tabular-nums">{`+${overflow}`}</AvatarFallback>
                                </AvatarRoot>
                              )}
                            >
                              {project.persons.map(person => (
                                <AvatarRoot key={person.id} size="sm" color={avatarColorFor(person.name)} role="img" aria-label={person.name}>
                                  <AvatarFallback>{initials(person.name)}</AvatarFallback>
                                </AvatarRoot>
                              ))}
                            </AvatarGroup>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={projectStatusTone(project.status)}>{project.status}</StatusBadge>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 tabular-nums">
                            <ProgressRing value={progress} />
                            {formatPercent(progress)}
                          </span>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (project.tasks.length > 0 ? project.tasks.map(task => {
                        const taskProgress = pct(task.actual_days, task.estimated_days);
                        return (
                          <TableRow key={`task-${task.id}`}>
                            <TableCell colSpan={6} className="whitespace-normal">
                              <div className="ml-8 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 border-l border-border py-1 pl-4">
                                <span className="min-w-48 flex-1 break-words font-medium text-foreground">
                                  {TASK_LABELS[task.task_type] ?? task.task_type}
                                </span>
                                <span className="text-sm text-muted-foreground">Scadenza: {formatDate(task.planned_end)}</span>
                                <span className="flex items-center gap-2 tabular-nums text-sm">
                                  <ProgressRing value={taskProgress} />
                                  {formatPercent(taskProgress)}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow key={`empty-tasks-${project.id}`}>
                          <TableCell colSpan={6} className="whitespace-normal">
                            <div className="ml-8 border-l border-border py-1 pl-4 text-sm text-muted-foreground">Nessun task nel progetto</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </SectionCard>
  );
}
