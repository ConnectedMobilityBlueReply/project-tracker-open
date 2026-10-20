import { useMemo, useState } from 'react';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/app/StateMessages';
import { ProjectTile } from '@/components/app/ProjectTile';
import { StatusBadge } from '@/components/app/StatusBadge';
import { projectStatusTone } from '@/lib/statusTone';
import { cn } from '@/lib/utils';
import { STATUS_FILTER_ALL, filterProjectList } from '@/lib/projectConfigModel';
import { PROJECT_STATUS_OPTIONS, type Project } from '../../types';

interface ProjectListSidebarProps {
  projects: Project[];
  selectedId: number | null;
  onSelect: (project: Project) => void;
  onCreate: () => void;
}

const FILTERS = [STATUS_FILTER_ALL, ...PROJECT_STATUS_OPTIONS];

export function ProjectListSidebar({ projects, selectedId, onSelect, onCreate }: ProjectListSidebarProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>(STATUS_FILTER_ALL);
  const visible = useMemo(() => filterProjectList(projects, query, status), [projects, query, status]);
  const namesById = useMemo(() => new Map(projects.map(project => [project.id, project.name])), [projects]);

  return (
    <aside
      aria-label="Elenco progetti"
      className="flex w-full shrink-0 flex-col border-b border-border bg-panel lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:border-r lg:border-b-0"
    >
      <div className="space-y-3 border-b border-border p-4">
        <Button onClick={onCreate} className="w-full">
          <Plus aria-hidden="true" className="size-4" />
          Nuovo progetto
        </Button>
        <label className="flex items-center gap-2 rounded-full bg-search-field px-3.5 py-2 text-sm">
          <MagnifyingGlass aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="sr-only">Cerca progetto</span>
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Cerca progetto o codice offerta"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div role="group" aria-label="Filtra per stato" className="flex flex-wrap gap-1.5">
          {FILTERS.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={status === option}
              onClick={() => setStatus(option)}
              className={cn(
                'min-h-8 cursor-pointer rounded-full border px-3 text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                status === option
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-foreground hover:bg-accent',
              )}
            >
              {option === STATUS_FILTER_ALL ? 'Tutti' : option}
            </button>
          ))}
        </div>
      </div>

      <p className="px-4 pt-2 text-xs text-muted-foreground" aria-live="polite">
        {visible.length} di {projects.length} progetti
      </p>
      <nav aria-label="Progetti" className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <div className="px-2 py-3">
            <EmptyState title={projects.length === 0 ? 'Nessun progetto' : 'Nessun progetto trovato'} />
          </div>
        ) : (
          visible.map(project => {
            const isSelected = project.id === selectedId;
            return (
              <button
                key={project.id}
                type="button"
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => onSelect(project)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  isSelected ? 'border-border bg-card shadow-xs' : 'border-transparent hover:bg-accent',
                )}
              >
                <ProjectTile id={project.id} name={project.name} icon={project.icon} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium text-foreground">{project.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={projectStatusTone(project.status)} size="sm">{project.status}</StatusBadge>
                    {project.total_stima != null && (
                      <span className="text-xs text-muted-foreground">{project.total_stima.toFixed(1)}gg</span>
                    )}
                  </span>
                  {project.parent_project_id != null && namesById.has(project.parent_project_id) && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      Sotto progetto di {namesById.get(project.parent_project_id)}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </nav>
    </aside>
  );
}
