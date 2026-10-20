import { notchFill } from '@/lib/dashboardModel';

const TONE_COLOR = {
  green: 'var(--data-green)',
  blue: 'var(--data-blue)',
} as const;

export function NotchBar({ value, tone, notches = 30, label }: {
  value: number;
  tone: 'green' | 'blue';
  notches?: number;
  label: string;
}) {
  const count = Number.isFinite(notches) ? Math.max(0, Math.floor(notches)) : 30;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const filled = notchFill(safeValue, count);

  return (
    <div role="img" aria-label={`${label}: ${Math.round(safeValue)}%`} className="flex w-full gap-0.5">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="h-3 min-w-0 flex-1 rounded-sm"
          style={{ backgroundColor: index < filled ? TONE_COLOR[tone] : 'var(--muted)' }}
        />
      ))}
    </div>
  );
}
