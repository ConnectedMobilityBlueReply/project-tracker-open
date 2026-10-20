/**
 * Barre del Gantt di Timeline Team: le settimane consecutive con ore di una
 * riga diventano un segmento. Funzione pura, testata con `node --test`.
 */

export interface BarWeek {
  week: string;
  hours: number;
}

export interface BarSegment {
  /** Indice in `weeks` della prima settimana del segmento. */
  startIndex: number;
  weeks: BarWeek[];
  totalHours: number;
  /** Almeno una settimana supera `capacityHours`. Falso se la capacita' manca o e' 0. */
  overCapacity: boolean;
}

/**
 * @param weeks lunedi' visibili, in ordine
 * @param hoursOf ore della riga nella settimana (0 se nessuna)
 * @param capacityHours ore settimanali disponibili; assente o 0 = nessun controllo
 */
export function buildSegments(
  weeks: string[], hoursOf: (week: string) => number, capacityHours?: number,
): BarSegment[] {
  const checkCapacity = capacityHours != null && capacityHours > 0;
  const segments: BarSegment[] = [];
  let open: BarWeek[] = [];
  let openStart = 0;

  const close = () => {
    if (open.length === 0) return;
    segments.push({
      startIndex: openStart,
      weeks: open,
      totalHours: open.reduce((sum, item) => sum + item.hours, 0),
      overCapacity: checkCapacity && open.some(item => item.hours > capacityHours),
    });
    open = [];
  };

  weeks.forEach((week, index) => {
    const hours = hoursOf(week);
    if (hours > 0) {
      if (open.length === 0) openStart = index;
      open = [...open, { week, hours }];
    } else {
      close();
    }
  });
  close();
  return segments;
}
