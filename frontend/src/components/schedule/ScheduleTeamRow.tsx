import type { TeamColumnTotal } from '../../lib/scheduleBacklog';
import UtilizationBadge from './UtilizationBadge';
import { STICKY_COL, WEEK_COL } from './WeekGrid';

/** Riga di sintesi: utilizzo complessivo del team per colonna, sempre in cima alla griglia. */
export default function ScheduleTeamRow({ totals }: { totals: TeamColumnTotal[] }) {
  return (
    <div role="group" className="flex border-b bg-topbar" aria-label="Utilizzo del team">
      <div className={`${STICKY_COL} bg-topbar px-3 py-2 text-sm font-semibold`}>Team</div>
      {totals.map(total => (
        <div key={total.key} className={`${WEEK_COL} flex items-center justify-end px-2 py-2`}>
          <UtilizationBadge allocated={total.allocated} available={total.available} />
        </div>
      ))}
    </div>
  );
}
