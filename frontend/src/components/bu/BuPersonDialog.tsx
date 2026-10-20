import { useEffect, useMemo, useState } from 'react';
import { getBuPersonAllocations } from '../../api';
import type { BuPerson, BuProjectAllocation } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { formatDays, formatIsoShort, groupByTeam, projectKindLabel, projectTotal } from '@/lib/buModel';

interface BuPersonDialogProps {
  person: BuPerson | null;
  from: string;
  weeks: number;
  onClose: () => void;
}

function ProjectRow({ project }: { project: BuProjectAllocation }) {
  return (
    <li className="space-y-1 rounded-lg border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{project.project_name}</span>
        <Badge variant="secondary" size="sm" pill>{projectKindLabel(project)}</Badge>
        {project.tentative && <Badge variant="outline" size="sm" pill>provvisorio</Badge>}
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">{formatDays(projectTotal(project))} gg</span>
      </div>
      {project.parent_project_name && (
        <p className="text-xs text-muted-foreground">Confluisce in {project.parent_project_name}</p>
      )}
      <p className="text-xs tabular-nums text-muted-foreground">
        {project.weeks.map(week => `${formatIsoShort(week.week_start)}: ${formatDays(week.man_days)}`).join(' · ')}
      </p>
    </li>
  );
}

export default function BuPersonDialog({ person, from, weeks, onClose }: BuPersonDialogProps) {
  const personId = person?.person_id ?? null;
  const [items, setItems] = useState<BuProjectAllocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (personId == null) return;
    let cancelled = false;
    setItems(null);
    setError(null);
    getBuPersonAllocations(personId, from, weeks).then(
      data => { if (!cancelled) setItems(data); },
      err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Errore nel caricamento'); },
    );
    return () => { cancelled = true; };
  }, [personId, from, weeks]);

  const groups = useMemo(() => groupByTeam(items ?? []), [items]);

  return (
    <Dialog open={person != null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="rounded-card sm:max-w-[640px]">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle>{person?.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {error && <ErrorBanner>{error}</ErrorBanner>}
          {!error && items == null && <LoadingState />}
          {items != null && groups.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nessuna allocazione nelle {weeks} settimane selezionate.</p>
          )}
          {groups.map(group => (
            <section key={group.team_id} className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">{group.team_name}</h3>
              <ul className="space-y-2">
                {group.projects.map(project => <ProjectRow key={project.project_id} project={project} />)}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
