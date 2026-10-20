import { UTILIZATION_TONE } from '../../lib/statusTone';
import type { UtilizationLevel } from '../../lib/capacity';
import { StatusBadge } from '../app/StatusBadge';

const LEVELS: { level: UtilizationLevel; label: string }[] = [
  { level: 'free', label: 'Libero (0%)' },
  { level: 'under', label: 'Sotto capacità (<100%)' },
  { level: 'full', label: 'Al limite (100%)' },
  { level: 'over', label: 'Sovraccarico (>100%)' },
  { level: 'conflict', label: 'Assente con lavoro' },
];

export default function ScheduleLegend() {
  return (
    <div role="group" className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-label="Legenda">
      {LEVELS.map(({ level, label }) => (
        <StatusBadge key={level} tone={UTILIZATION_TONE[level]} appearance="soft">{label}</StatusBadge>
      ))}
      <span>+N g: giorni da assegnare dal backlog</span>
      <span>Altri team: giorni già allocati su progetti di altri team</span>
    </div>
  );
}
