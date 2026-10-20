import { ArrowRight, ClipboardText, DotsThree } from '@phosphor-icons/react';
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
import { SEGMENT_COLOR, StripedSegmentBar } from '@/components/dashboard/StripedSegmentBar';
import { wbsSegments } from '@/lib/dashboardModel';
import type { DashboardWbsStatus } from '@/types';


const formatCount = (value: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(value);

export function OverallTasksCard({ wbs }: { wbs: DashboardWbsStatus }) {
  const segments = wbsSegments(wbs);

  return (
    <SectionCard
      icon={<ClipboardText />}
      title="Attività WBS"
      description={`Distribuite su ${formatCount(wbs.projects)} progetti.`}
      actions={(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" iconOnly aria-label="Altre azioni attività WBS">
              <DotsThree aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link to="/miei-task">Apri I miei task</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      footer={(
        <Link to="/miei-task" className="inline-flex items-center gap-2 font-medium underline-offset-4 hover:underline">
          Vedi le attività <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    >
      {wbs.total === 0 ? (
        <EmptyState bordered={false} title="Nessuna attività WBS" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-muted-foreground">Attività</span>
            <span className="text-3xl font-semibold tabular-nums text-foreground">{formatCount(wbs.total)}</span>
          </div>
          <StripedSegmentBar segments={segments} />
          <ul className="space-y-2">
            {segments.map(segment => (
              <li key={segment.key} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: SEGMENT_COLOR[segment.key] }} />
                <span className="min-w-0 flex-1 text-muted-foreground">{segment.label}</span>
                <strong className="tabular-nums text-foreground">{formatCount(segment.count)}</strong>
                <span className="text-muted-foreground">attività</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
