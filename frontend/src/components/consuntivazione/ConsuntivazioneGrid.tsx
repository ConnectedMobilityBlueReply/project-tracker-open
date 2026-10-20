import { useRef, type ReactNode } from 'react';
import { format } from 'date-fns';
import type { RangeRow, TaskType } from '../../types';
import { TASK_LABELS } from '../../types';
import { cn } from '@/lib/utils';
import type { Density } from '../schedule/ScheduleToolbar';
import { weekHolidays, weeklyCapacityHours } from '../../lib/workingHours';
import { capacityFill, formatHours, isRowOverEstimate, rowTotalHours, weekTotalHours } from '../../lib/consuntivazioneGrid';
import { nextCell, type NavKey } from '../../lib/gridNav';
import { currentWeekIndex, uniformWeekEdges } from '../../lib/timelineGeometry';
import TimelineShell from '../timeline/TimelineShell';
import { SIDEBAR_COL, TOTAL_COL } from '../timeline/layout';
import ConsuntivazioneCell from './ConsuntivazioneCell';
import type { CellSaveState } from './ConsuntivazioneCell';

interface Props {
  rows: RangeRow[];
  /** Righe complete (confermate + bozze), non filtrate: base dei totali di capacità. */
  totalsRows: RangeRow[];
  weeks: string[];
  density: Density;
  saveStates: Record<string, CellSaveState>;
  cellErrors: Record<string, string>;
  emptyMessage: string;
  /** Controlli della sottobarra: frecce, Oggi, intervallo. */
  controls: ReactNode;
  /** Riga "Aggiungi attività" in coda alle righe. */
  addRow?: ReactNode;
  busy: boolean;
  onCommit: (row: RangeRow, weekStart: string, hours: number) => void;
  onOpenDetail: (row: RangeRow, weekStart: string) => void;
}

/** Larghezza fissa delle celle: si scrivono, quindi niente zoom. */
export const CONSUNTIVAZIONE_WEEK_WIDTH = 128;
const WEEK_CELL = 'shrink-0 border-r border-border';
const WEEK_STYLE = { width: CONSUNTIVAZIONE_WEEK_WIDTH };

export const cellKey = (rowKey: string, weekStart: string) => `${rowKey}|${weekStart}`;

function weekLabel(weekStart: string, totalHours: number): ReactNode {
  const [, month, day] = weekStart.split('-');
  const capacity = weeklyCapacityHours(weekStart);
  const holidays = weekHolidays(weekStart);
  const fill = capacityFill(totalHours, capacity);
  const capacityInfo = holidays.length > 0
    ? `${formatHours(totalHours)} di ${formatHours(capacity)} ore lavorabili — festivi: ${holidays.map(h => h.name).join(', ')}`
    : `${formatHours(totalHours)} di ${formatHours(capacity)} ore lavorabili`;
  return (
    <div className="px-1" title={capacityInfo}>
      <div>{day}/{month}</div>
      <div className={cn('tabular-nums', fill.over ? 'text-warning' : holidays.length > 0 ? 'text-warning' : '')}>
        <span aria-hidden="true">{formatHours(totalHours)}h / {formatHours(capacity)}h</span>
        <span className="sr-only">{capacityInfo}</span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn('h-full rounded-full', fill.over ? 'bg-warning' : 'bg-muted-foreground')}
          style={{ width: `${fill.pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ConsuntivazioneGrid({
  rows, totalsRows, weeks, density, saveStates, cellErrors, emptyMessage, controls, addRow, busy, onCommit, onOpenDetail,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const navigate = (row: number, col: number, key: NavKey) => {
    const target = nextCell({ row, col }, key, { rows: rows.length, cols: weeks.length });
    if (!target) return;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-cell-row="${target.row}"][data-cell-col="${target.col}"] button`)
      ?.focus();
  };

  return (
    <TimelineShell
      controls={controls}
      weeks={weeks}
      weekEdges={uniformWeekEdges(weeks.length, CONSUNTIVAZIONE_WEEK_WIDTH)}
      currentIndex={currentWeekIndex(weeks, format(new Date(), 'yyyy-MM-dd'))}
      sidebarLabel={(
        <div className="flex w-full justify-between gap-2">
          <span>Attività</span>
          <span>Stima / svolti</span>
        </div>
      )}
      weekLabel={week => weekLabel(week, weekTotalHours(totalsRows, week))}
      totalsLabel="Totale"
      isEmpty={addRow ? false : rows.length === 0}
      emptyMessage={emptyMessage}
      busy={busy}
    >
      <div ref={gridRef}>
        {rows.map((row, rowIndex) => (
          <div key={row.key} className="flex border-b border-border">
            <div className={cn(SIDEBAR_COL, 'flex items-center gap-2 px-3 py-2')}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{row.project_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {TASK_LABELS[row.task_type as TaskType] || row.task_type}
                  {row.wbs_item_name ? ` — ${row.wbs_item_name}` : ''}
                </div>
              </div>
              {!row.is_extra && (
                <div
                  className={`shrink-0 text-right text-xs tabular-nums ${isRowOverEstimate(row) ? 'text-warning' : 'text-muted-foreground'}`}
                  title={`stima ${formatHours(row.estimated_days)}gg · svolti ${formatHours(row.total_man_days)}gg`}
                >
                  {formatHours(row.estimated_days)} / {formatHours(row.total_man_days)}gg
                </div>
              )}
            </div>
            {weeks.map((week, colIndex) => {
              const key = cellKey(row.key, week);
              return (
                <div key={week} className={WEEK_CELL} style={WEEK_STYLE}>
                  <ConsuntivazioneCell
                    row={row}
                    weekStart={week}
                    density={density}
                    saveState={saveStates[key] ?? 'idle'}
                    errorMessage={cellErrors[key] ?? null}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                    onNavigate={navKey => navigate(rowIndex, colIndex, navKey)}
                    onCommit={onCommit}
                    onOpenDetail={onOpenDetail}
                  />
                </div>
              );
            })}
            <div className={cn(TOTAL_COL, 'px-3 py-2 text-right text-sm font-medium tabular-nums')}>
              {formatHours(rowTotalHours(row, weeks))}h
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && addRow && (
        <div className="px-3 py-6 text-sm text-muted-foreground">{emptyMessage}</div>
      )}
      {addRow}

      <div className="flex border-t-2 border-border bg-muted/30">
        <div className={cn(SIDEBAR_COL, 'bg-muted px-3 py-2 text-sm font-semibold')}>
          Totale settimana
        </div>
        {weeks.map(week => {
          const total = weekTotalHours(totalsRows, week);
          const capacity = weeklyCapacityHours(week);
          return (
            <div
              key={week}
              style={WEEK_STYLE}
              className={cn(WEEK_CELL, 'px-2 py-2 text-sm font-semibold tabular-nums', total > capacity ? 'text-warning' : 'text-foreground')}
            >
              {formatHours(total)}h / {formatHours(capacity)}h
            </div>
          );
        })}
        <div className={cn(TOTAL_COL, 'px-3 py-2')} />
      </div>
    </TimelineShell>
  );
}
