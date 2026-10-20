import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { ArrowsOut, ArrowsIn } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { barGeometry, SIDEBAR_WIDTH } from '../../lib/timelineGeometry';
import { shouldExitFullscreen } from '../../lib/overlayGuards';
import { EmptyState } from '../app/StateMessages';
import TimelineHeader from './TimelineHeader';
import { TimelineSubbar } from './TimelineToolbar';

interface TimelineShellProps {
  /** Controlli della sottobarra (frecce, Oggi, intervallo, zoom). Lo schermo intero lo aggiunge lo shell. */
  controls: ReactNode;
  weeks: string[];
  /** Bordi delle settimane, `weeks.length + 1` posizioni (vedi `weekEdges`/`uniformWeekEdges`). */
  weekEdges: number[];
  /** Indice della settimana corrente in `weeks`, -1 se fuori intervallo. */
  currentIndex: number;
  sidebarLabel: ReactNode;
  weekLabel: (week: string) => ReactNode;
  totalsLabel?: ReactNode;
  /** Mesi ridimensionabili dall'utente: vedi `TimelineHeader`. */
  onResizeMonth?: (monthKey: string, width: number | null) => void;
  isEmpty: boolean;
  emptyMessage: string;
  busy?: boolean;
  /** Il contenitore con lo scroll, per chi deve centrare Oggi. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Righe: ognuna usa `SIDEBAR_COL` e colonne posizionate su `weekEdges`. */
  children: ReactNode;
}

const todayCenter = (edges: number[], index: number) => {
  const { left, width } = barGeometry(edges, index, 1);
  return left + width / 2;
};

/**
 * Cornice in stile Plane: un solo contenitore con scroll, pannello sinistro
 * `sticky left-0` e header `sticky top-0`. Nessuna sincronia fra scroll diversi.
 */
export default function TimelineShell({
  controls, weeks, weekEdges, currentIndex, sidebarLabel, weekLabel, totalsLabel, onResizeMonth,
  isEmpty, emptyMessage, busy = false, scrollRef, children,
}: TimelineShellProps) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Esc spetta prima a chi lo usa: un dialog aperto (EntryModal), una cella che
      // annulla la bozza (defaultPrevented), un Select aperto. Solo il resto esce.
      const target = event.target instanceof Element ? event.target : null;
      const exit = shouldExitFullscreen({
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        insideListbox: target?.closest('[role="listbox"]') != null,
        hasOpenDialog: document.querySelector('[role="dialog"]') != null,
      });
      if (exit) setFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  return (
    // z-40: sotto i dialog (z-50), che devono restare utilizzabili in schermo intero.
    <div className={fullscreen ? 'fixed inset-0 z-40 flex flex-col bg-canvas p-4' : 'flex flex-col'}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-card shadow-xs">
        <TimelineSubbar>
          {controls}
          <Button
            variant="outline"
            iconOnly
            className="ml-auto"
            aria-label={fullscreen ? 'Esci da schermo intero' : 'Schermo intero'}
            aria-pressed={fullscreen}
            onClick={() => setFullscreen(value => !value)}
          >
            {fullscreen ? <ArrowsIn className="h-4 w-4" /> : <ArrowsOut className="h-4 w-4" />}
          </Button>
        </TimelineSubbar>

        {isEmpty ? (
          <EmptyState title={emptyMessage} bordered={false} />
        ) : (
          <div
            ref={scrollRef}
            aria-busy={busy}
            className={cn(
              'relative min-h-0 flex-1 overflow-auto',
              !fullscreen && 'max-h-[calc(100vh-14rem)]',
              busy && 'opacity-60',
            )}
          >
            <div className="relative min-w-max">
              <TimelineHeader
                weeks={weeks}
                weekEdges={weekEdges}
                currentIndex={currentIndex}
                sidebarLabel={sidebarLabel}
                weekLabel={weekLabel}
                totalsLabel={totalsLabel}
                onResizeMonth={onResizeMonth}
              />
              {currentIndex >= 0 && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 top-0 z-[5] w-px bg-primary/60"
                  style={{ left: SIDEBAR_WIDTH + todayCenter(weekEdges, currentIndex) }}
                />
              )}
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
