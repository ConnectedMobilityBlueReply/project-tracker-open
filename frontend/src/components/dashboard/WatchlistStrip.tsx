import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/app/StatusBadge';
import { SectionCard } from '@/components/app/SectionCard';
import { Button } from '@/components/ui/button';
import { WATCH_SIGNAL_LABEL, WATCH_SIGNAL_SEVERITY, watchlist } from '@/lib/dashboardModel';
import type { DashboardProject } from '@/types';

const VISIBLE = 5;
const BURN_AHEAD_HINT = 'Giorni consumati in percentuale più alti del tempo trascorso di oltre 15 punti. Non considera l\'avanzamento reale.';

export function WatchlistStrip({ projects, today }: { projects: DashboardProject[]; today: string }) {
  const [expanded, setExpanded] = useState(false);
  const items = watchlist(projects, today);
  const shown = expanded ? items : items.slice(0, VISIBLE);

  return (
    <SectionCard title="Da guardare">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun progetto da guardare.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {shown.map(({ project, signals }) => (
              <li key={project.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link to={`/progetti/${project.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {project.name}
                </Link>
                {signals.map(signal => (
                  <span key={signal} title={signal === 'burnAhead' ? BURN_AHEAD_HINT : undefined}>
                    <StatusBadge tone={WATCH_SIGNAL_SEVERITY[signal] === 'danger' ? 'red' : 'orange'} size="sm">
                      {WATCH_SIGNAL_LABEL[signal]}
                    </StatusBadge>
                  </span>
                ))}
              </li>
            ))}
          </ul>
          {items.length > VISIBLE && (
            <Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded(e => !e)}>
              {expanded ? 'Mostra meno' : `Vedi tutti (${items.length})`}
            </Button>
          )}
        </>
      )}
    </SectionCard>
  );
}
