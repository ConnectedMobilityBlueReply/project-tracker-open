import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WBS_STATUS_LABELS, type WbsPlanningItem } from '../../types';
import { ganttSpan, ganttWindow, groupByProject } from '../../lib/planningModel';
import {
  centerScrollLeft, currentWeekIndex, GANTT_WEEK_WIDTH, isoWeekNumber, uniformWeekEdges, type GanttZoom,
} from '../../lib/timelineGeometry';
import { projectColor } from '../../lib/scheduleModel';
import TimelineShell from '../timeline/TimelineShell';
import { SIDEBAR_COL } from '../timeline/layout';
import { STATUS_BAR } from './planningStyles';
import { formatDue, taskLabel } from './PlanningCells';

const ZOOMS: readonly GanttZoom[] = ['month', 'quarter', 'year'];
const ZOOM_LABELS: Record<GanttZoom, string> = { month: 'Mese', quarter: 'Trimestre', year: 'Anno' };

/** Sola lettura: una barra per WBS da inizio a fine, riempita al completamento. */
export default function PlanningGantt({ items, today }: { items: WbsPlanningItem[]; today: string }) {
  const [zoom, setZoom] = useState<GanttZoom>('quarter');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { weeks, undated, outside } = useMemo(() => ganttWindow(items, today), [items, today]);
  const groups = useMemo(() => groupByProject(items.filter(item => ganttSpan(item, weeks) != null)), [items, weeks]);
  const weekWidth = GANTT_WEEK_WIDTH[zoom];
  const trackWidth = weeks.length * weekWidth;
  const weekEdges = useMemo(() => uniformWeekEdges(weeks.length, weekWidth), [weeks.length, weekWidth]);
  const currentIndex = currentWeekIndex(weeks, today);

  useEffect(() => {
    const container = scrollRef.current;
    if (container == null || currentIndex < 0) return;
    container.scrollLeft = centerScrollLeft(weekEdges, currentIndex, container.clientWidth);
  }, [currentIndex, weekEdges]);

  const controls = (
    <div className="flex items-center gap-1">
      {ZOOMS.map(option => (
        <Button key={option} size="sm" variant={option === zoom ? 'secondary' : 'ghost'} aria-pressed={option === zoom} onClick={() => setZoom(option)}>
          {ZOOM_LABELS[option]}
        </Button>
      ))}
      {undated > 0 && <span className="ml-3 text-xs text-muted-foreground">{undated} WBS senza date non mostrate</span>}
      {outside > 0 && <span className="ml-3 text-xs text-muted-foreground">{outside} WBS fuori dalla finestra non mostrate</span>}
    </div>
  );

  return (
    <TimelineShell
      controls={controls}
      weeks={weeks}
      weekEdges={weekEdges}
      currentIndex={currentIndex}
      sidebarLabel="WBS"
      weekLabel={week => (zoom === 'month' ? format(new Date(`${week}T00:00:00`), 'd MMM', { locale: it }) : `W${isoWeekNumber(week)}`)}
      isEmpty={groups.length === 0}
      emptyMessage="Nessuna WBS con date da mostrare."
      scrollRef={scrollRef}
    >
      {groups.map(group => (
        <Fragment key={group.projectId}>
          <div className="flex h-9 border-b border-border">
            <div className={cn(SIDEBAR_COL, 'flex items-center gap-2 px-3 text-sm font-medium')}>
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: projectColor(group.projectId, group.projectColor) }} />
              <span className="truncate">{group.projectName}</span>
            </div>
            <div className="shrink-0 bg-muted/30" style={{ width: trackWidth }} />
          </div>
          {group.items.map(item => {
            const span = ganttSpan(item, weeks);
            if (span == null) return null;
            const label = `${item.name}: ${WBS_STATUS_LABELS[item.status]}, ${item.completion_pct}%, dal ${formatDue(item.planned_start)} al ${formatDue(item.planned_end)}`;
            return (
              <div key={item.id} className="flex h-10 border-b border-border">
                <div className={cn(SIDEBAR_COL, 'flex min-w-0 flex-col justify-center pl-7 pr-3')}>
                  <span className="truncate text-xs">{item.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{taskLabel(item)}</span>
                </div>
                <div className="relative shrink-0" style={{ width: trackWidth }}>
                  <div
                    role="img"
                    aria-label={label}
                    title={label}
                    className="absolute inset-y-2.5 overflow-hidden rounded-md bg-muted"
                    style={{ left: span.startIndex * weekWidth, width: span.length * weekWidth }}
                  >
                    <div className={cn('h-full', STATUS_BAR[item.status])} style={{ width: `${item.completion_pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </Fragment>
      ))}
    </TimelineShell>
  );
}
