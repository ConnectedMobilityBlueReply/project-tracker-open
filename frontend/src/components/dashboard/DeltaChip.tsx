import { ArrowDown, ArrowUp } from '@phosphor-icons/react';

export function DeltaChip({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (value == null || !Number.isFinite(value)) return null;

  const rounded = Math.round(value * 10) / 10 || 0; // -0 diventa 0
  const positive = rounded >= 0;
  const neutral = rounded === 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  const formatted = `${positive && !neutral ? '+' : ''}${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1, useGrouping: true }).format(rounded)}${suffix}`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium tabular-nums ${neutral ? 'bg-muted text-muted-foreground' : positive ? 'bg-delta-success text-success-strong' : 'bg-destructive/10 text-destructive-strong'}`}
    >
      {!neutral && <Icon aria-hidden="true" className="size-3.5" />}
      {formatted}
    </span>
  );
}
