import type { TimeOffEntry } from '../../types';
import { isOff, weekdaysOf } from '../../lib/capacity';

interface Props {
  personId: number;
  weeks: string[];
  timeOff: TimeOffEntry[];
  onOpen?: (entry: TimeOffEntry) => void;
}

/**
 * Banda diagonale sui giorni di assenza. Le colonne sono settimanali, quindi
 * la banda copre la frazione della cella corrispondente ai giorni assenti.
 */
export default function TimeOffBand({ personId, weeks, timeOff, onOpen }: Props) {
  const days = weeks.flatMap(weekdaysOf);
  const offDays = days.filter(day => isOff(personId, day, timeOff));
  if (offDays.length === 0) return null;

  const coverage = Math.round((offDays.length / days.length) * 100);

  // L'assenza da aprire è quella che copre il primo giorno assente della cella.
  // Con più assenze sovrapposte si modifica la prima: la modale mostra comunque
  // le date reali, quindi l'utente vede subito quale ha aperto.
  const entry = timeOff.find(item =>
    item.person_id === personId
    && item.start_date <= offDays[0] && offDays[0] <= item.end_date) ?? null;

  const style = {
    width: `${coverage}%`,
    backgroundImage: 'var(--schedule-timeoff-hatch)',
  };
  const title = `${offDays.length} giorni di assenza`;

  if (!onOpen || !entry) {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0"
           style={style} title={title} />
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      title={title}
      aria-label={`Modifica l’assenza dal ${entry.start_date} al ${entry.end_date}`}
      className="absolute inset-y-0 left-0 cursor-pointer"
      style={style}
    />
  );
}
