import { Fragment, useState, type ReactNode, type RefObject } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { Person } from '../../types';
import { daysToHours, formatGgU } from '../../lib/units';
import { buildSegments } from '../../lib/timelineBars';
import { isoWeekNumber, type GanttZoom } from '../../lib/timelineGeometry';
import TimelineShell from './TimelineShell';
import GanttBars from './GanttBars';
import { SIDEBAR_COL } from './layout';

export interface GanttTaskRow {
  taskId: number;
  /** "Progetto · Attività". */
  label: string;
  weeks: Record<string, number>;
}

export interface GanttPersonRow {
  person: Person;
  weekTotals: Map<string, number>;
  tasks: GanttTaskRow[];
}

interface TeamGanttProps {
  rows: GanttPersonRow[];
  weeks: string[];
  /** Bordi delle settimane, `weeks.length + 1` posizioni (vedi `weekEdges`). */
  weekEdges: number[];
  onResizeMonth: (monthKey: string, width: number | null) => void;
  zoom: GanttZoom;
  currentIndex: number;
  expanded: Set<number>;
  onToggle: (personId: number) => void;
  onOpenWeek: (personId: number, week: string) => void;
  controls: ReactNode;
  emptyMessage: string;
  busy: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
}

const sumHours = (values: Iterable<number>) => Array.from(values).reduce((sum, value) => sum + value, 0);
const totalText = (hours: number) => (hours > 0 ? formatGgU(hours) : '—');

function weekLabelFor(zoom: GanttZoom) {
  return (week: string): ReactNode => {
    if (zoom === 'year') return null;
    const number = isoWeekNumber(week);
    if (zoom === 'quarter') return <span className="block text-center tabular-nums">{number}</span>;
    return (
      <div className="text-center leading-tight">
        <div className="tabular-nums">W{number}</div>
        <div>{week.slice(8)}</div>
      </div>
    );
  };
}

/** Gantt di sola consultazione: un clic su una settimana apre la Settimanale. */
export default function TeamGantt({
  rows, weeks, weekEdges, onResizeMonth, zoom, currentIndex, expanded, onToggle, onOpenWeek, controls, emptyMessage, busy, scrollRef,
}: TeamGanttProps) {
  // Riga attivita' evidenziata con un clic; un secondo clic la rilascia.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  return (
    <TimelineShell
      controls={controls}
      weeks={weeks}
      weekEdges={weekEdges}
      onResizeMonth={onResizeMonth}
      currentIndex={currentIndex}
      sidebarLabel={(
        <div className="flex w-full justify-between gap-2">
          <span>Persona</span>
          <span>Totale</span>
        </div>
      )}
      weekLabel={weekLabelFor(zoom)}
      isEmpty={rows.length === 0}
      emptyMessage={emptyMessage}
      busy={busy}
      scrollRef={scrollRef}
    >
      {rows.map(({ person, weekTotals, tasks }) => {
        const isExpanded = expanded.has(person.id);
        return (
          <Fragment key={person.id}>
            <div className="flex h-9 border-b border-border">
              <button
                type="button"
                className={cn(SIDEBAR_COL, 'flex items-center gap-2 px-3 text-left text-sm font-medium hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}
                onClick={() => onToggle(person.id)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Comprimi' : 'Espandi'} attività di ${person.name}`}
              >
                <CaretRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                <span className="min-w-0 flex-1 truncate">{person.name}</span>
              </button>
              <GanttBars
                segments={buildSegments(weeks, week => weekTotals.get(week) ?? 0, daysToHours(person.weekly_capacity_days))}
                weekEdges={weekEdges}
                tone="primary"
                subject={person.name}
                onOpenWeek={week => onOpenWeek(person.id, week)}
              />
            </div>
            {isExpanded && tasks.map(task => {
              const key = `${person.id}_${task.taskId}`;
              const isSelected = selectedKey === key;
              return (
                <div
                  key={key}
                  className={cn('flex h-8 cursor-pointer border-b border-border', isSelected && 'bg-muted')}
                  aria-selected={isSelected}
                  onClick={() => setSelectedKey(isSelected ? null : key)}
                >
                  <div className={cn(SIDEBAR_COL, 'flex items-center gap-2 pl-9 pr-3 text-xs', isSelected ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                    <span className="min-w-0 flex-1 truncate">{task.label}</span>
                    <span className="shrink-0 tabular-nums">{totalText(sumHours(Object.values(task.weeks)))}</span>
                  </div>
                  <GanttBars
                    segments={buildSegments(weeks, week => task.weeks[week] ?? 0)}
                    weekEdges={weekEdges}
                    tone={isSelected ? 'selected' : 'neutral'}
                    subject={`${person.name}, ${task.label}`}
                    onOpenWeek={week => onOpenWeek(person.id, week)}
                  />
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </TimelineShell>
  );
}
