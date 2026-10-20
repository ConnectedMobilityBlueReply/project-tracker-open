import type { BuPerson, BuWeek } from '../../types';
import type { UtilizationLevel } from '@/lib/capacity';
import {
  formatDays, formatIsoShort, segmentPercents, weekAllocated, weekAvailable, weekHasTimeOff, weekLevel,
} from '@/lib/buModel';
import { cn } from '@/lib/utils';

interface BuGridProps {
  people: readonly BuPerson[];
  onSelect: (person: BuPerson) => void;
}

const LEVEL_RING: Record<UtilizationLevel, string> = {
  free: '',
  under: '',
  full: '',
  over: 'ring-2 ring-destructive',
  conflict: 'ring-2 ring-amber-500',
};

function Legend() {
  const items = [
    { color: 'bg-sky-500', label: 'T&M' },
    { color: 'bg-emerald-500', label: 'Turn Key' },
    { color: 'bg-slate-400', label: 'Altro' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 px-3 py-2 text-xs text-muted-foreground">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2.5 rounded-sm', item.color)} />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-sm ring-2 ring-destructive" />
        Sovrallocata
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-sm ring-2 ring-amber-500" />
        Allocata su chi è assente
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />
        Assenza nella settimana
      </span>
    </div>
  );
}

function Cell({ person, week }: { person: BuPerson; week: BuWeek }) {
  const available = weekAvailable(person, week.week_start);
  const share = segmentPercents(week, available);
  const absent = weekHasTimeOff(person, week.week_start);
  const label = `${person.name}, settimana del ${formatIsoShort(week.week_start)}: `
    + `T&M ${formatDays(week.tm_days)}, Turn Key ${formatDays(week.turnkey_days)}, `
    + `altro ${formatDays(week.other_days)}; disponibili ${formatDays(available)}`
    + (absent ? ', assenza' : '');
  return (
    <td className="px-1 py-1.5">
      <div
        role="img"
        aria-label={label}
        title={label}
        className={cn(
          'relative mx-auto flex h-5 w-12 overflow-hidden rounded bg-muted',
          LEVEL_RING[weekLevel(person, week)],
          available === 0 && weekAllocated(week) === 0 && 'opacity-50',
        )}
      >
        <div className="bg-sky-500" style={{ width: `${share.tm}%` }} />
        <div className="bg-emerald-500" style={{ width: `${share.turnkey}%` }} />
        <div className="bg-slate-400" style={{ width: `${share.other}%` }} />
        {absent && <span aria-hidden="true" className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-foreground" />}
      </div>
    </td>
  );
}

export default function BuGrid({ people, onSelect }: BuGridProps) {
  if (people.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nessuna persona da mostrare.</p>;
  }
  const weekStarts = people[0].weeks.map(week => week.week_start);
  return (
    <div className="overflow-x-auto">
      <Legend />
      <table className="min-w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground">Persona</th>
            {weekStarts.map(weekStart => (
              <th key={weekStart} scope="col" className="px-1 py-2 text-center font-medium tabular-nums text-muted-foreground">
                {formatIsoShort(weekStart)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map(person => (
            <tr key={person.person_id}>
              <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-medium text-foreground">
                <button type="button" onClick={() => onSelect(person)} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  {person.name}
                </button>
              </th>
              {person.weeks.map(week => <Cell key={week.week_start} person={person} week={week} />)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
