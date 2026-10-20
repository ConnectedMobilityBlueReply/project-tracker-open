import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { BarSegment } from '../../lib/timelineBars';
import { barGeometry } from '../../lib/timelineGeometry';
import { formatGgU } from '../../lib/units';

interface GanttBarsProps {
  segments: BarSegment[];
  /** Bordi delle settimane, `weekCount + 1` posizioni (vedi `weekEdges`). */
  weekEdges: number[];
  tone: 'primary' | 'neutral' | 'selected';
  /** Chi/che cosa rappresenta la riga, per aria-label e tooltip. */
  subject: string;
  onOpenWeek: (week: string) => void;
}

const dayLabel = (week: string) => format(new Date(`${week}T00:00:00`), 'd MMM', { locale: it });

/**
 * Livello barre di una riga del Gantt. Ogni settimana dentro una barra e' un
 * pulsante a se': il clic sa gia' la settimana e la tastiera funziona con Tab.
 */
export default function GanttBars({ segments, weekEdges, tone, subject, onOpenWeek }: GanttBarsProps) {
  return (
    <div className="relative shrink-0" style={{ width: weekEdges[weekEdges.length - 1] }}>
      {segments.map(segment => {
        const { left, width } = barGeometry(weekEdges, segment.startIndex, segment.weeks.length);
        const color = segment.overCapacity
          ? 'border border-destructive/50 bg-destructive/15 text-destructive'
          : tone === 'selected'
            ? 'bg-foreground text-background'
            : tone === 'primary'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted-foreground/25 text-foreground';
        return (
          <div
            key={segment.startIndex}
            className={cn('absolute inset-y-1.5 flex overflow-hidden rounded-md', color)}
            style={{ left, width }}
          >
            {segment.weeks.map(({ week, hours }, offset) => (
              <button
                key={week}
                type="button"
                style={{ width: barGeometry(weekEdges, segment.startIndex + offset, 1).width }}
                className="h-full shrink-0 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                title={`${dayLabel(week)}: ${formatGgU(hours)}`}
                aria-label={`Apri settimana del ${dayLabel(week)}, ${subject}, ${formatGgU(hours)}`}
                onClick={event => { event.stopPropagation(); onOpenWeek(week); }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
