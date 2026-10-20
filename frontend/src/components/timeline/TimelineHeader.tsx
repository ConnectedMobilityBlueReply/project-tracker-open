import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { clampMonthWidth, monthSpans } from '../../lib/timelineGeometry';
import { SIDEBAR_COL, TOTAL_COL } from './layout';

/** Passo in px delle frecce sulla maniglia di un mese. */
const RESIZE_STEP = 16;

interface TimelineHeaderProps {
  weeks: string[];
  /** Bordi delle settimane, `weeks.length + 1` posizioni (vedi `weekEdges`). */
  weekEdges: number[];
  currentIndex: number;
  sidebarLabel: ReactNode;
  weekLabel: (week: string) => ReactNode;
  totalsLabel?: ReactNode;
  /** Se presente, ogni mese ha una maniglia; `null` torna alla larghezza di default. */
  onResizeMonth?: (monthKey: string, width: number | null) => void;
}

interface MonthResizeHandleProps {
  label: string;
  width: number;
  onResize: (width: number | null) => void;
}

/** Bordo destro trascinabile di un mese. Frecce ←/→ da tastiera, doppio clic azzera. */
function MonthResizeHandle({ label, width, onResize }: MonthResizeHandleProps) {
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    handle.setPointerCapture(event.pointerId);
    const move = (moveEvent: globalThis.PointerEvent) => onResize(clampMonthWidth(width + moveEvent.clientX - startX));
    const stop = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.key === 'ArrowRight' ? RESIZE_STEP : event.key === 'ArrowLeft' ? -RESIZE_STEP : 0;
    if (delta === 0) return;
    event.preventDefault();
    onResize(clampMonthWidth(width + delta));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Larghezza colonna ${label}`}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      title="Trascina per ridimensionare, doppio clic per ripristinare"
      className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onResize(null)}
    />
  );
}

/** Riga mese sopra, riga settimana sotto; settimana corrente evidenziata. */
export default function TimelineHeader({
  weeks, weekEdges, currentIndex, sidebarLabel, weekLabel, totalsLabel, onResizeMonth,
}: TimelineHeaderProps) {
  let firstWeek = 0;
  const months = monthSpans(weeks).map(span => {
    const width = weekEdges[firstWeek + span.weekCount] - weekEdges[firstWeek];
    firstWeek += span.weekCount;
    return { ...span, width };
  });

  return (
    <div className="sticky top-0 z-20 flex border-b border-border bg-muted">
      <div className={cn(SIDEBAR_COL, 'z-30 flex items-end bg-muted px-3 py-2 text-xs font-medium text-muted-foreground')}>
        {sidebarLabel}
      </div>
      <div className="shrink-0">
        <div className="flex border-b border-border">
          {months.map(month => (
            <div
              key={month.key}
              style={{ width: month.width }}
              title={month.label}
              className="relative shrink-0 truncate border-r border-border px-2 py-1 text-xs font-medium capitalize text-foreground"
            >
              {month.label}
              {onResizeMonth && (
                <MonthResizeHandle
                  label={month.label}
                  width={month.width}
                  onResize={width => onResizeMonth(month.key, width)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex">
          {weeks.map((week, index) => (
            <div
              key={week}
              style={{ width: weekEdges[index + 1] - weekEdges[index] }}
              aria-current={index === currentIndex ? 'date' : undefined}
              className={cn(
                'shrink-0 overflow-hidden border-r border-border px-1 py-1 text-[11px] text-muted-foreground',
                index === currentIndex && 'bg-primary/10 font-semibold text-foreground',
              )}
            >
              {weekLabel(week)}
            </div>
          ))}
        </div>
      </div>
      {totalsLabel != null && (
        <div className={cn(TOTAL_COL, 'flex items-end justify-end px-3 py-2 text-xs font-medium text-muted-foreground')}>
          {totalsLabel}
        </div>
      )}
    </div>
  );
}
