import { utilization, utilizationLevel } from '../../lib/capacity';
import { UTILIZATION_TONE } from '../../lib/statusTone';
import { StatusBadge } from '../app/StatusBadge';

interface Props {
  allocated: number;
  available: number;
}

/** Percentuale quando c'è capacità; il conflitto quando non ce n'è. */
export default function UtilizationBadge({ allocated, available }: Props) {
  const level = utilizationLevel(allocated, available);
  const ratio = utilization(allocated, available);

  if (level === 'free' && allocated === 0 && available === 0) return null;

  const label = ratio === null
    ? `${allocated.toLocaleString('it-IT')} g su 0`
    : `${Math.round(ratio * 100)}%`;
  const title = ratio === null
    ? 'Allocazioni su una persona assente tutta la settimana'
    : `${allocated.toLocaleString('it-IT')} g allocati su ${available.toLocaleString('it-IT')} disponibili`;

  return (
    <span title={title} className="inline-flex">
      <StatusBadge tone={UTILIZATION_TONE[level]} appearance="soft">{label}</StatusBadge>
    </span>
  );
}
