// Mini-indicatore a 4 tacche della sidebar progetti.
import { signalLevel } from '@/lib/projectProgress';
import { consumptionTone } from '@/lib/statusTone';
import { cn } from '@/lib/utils';

const FILL = {
  info: 'bg-data-blue',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
} as const;

export function SignalBars({ pct }: { pct: number }) {
  const level = signalLevel(pct);
  const fill = FILL[consumptionTone(pct)];
  return (
    <span role="img" aria-label={`Avanzamento ${pct}%`} className="flex size-7 shrink-0 items-end justify-center gap-0.5 rounded-sm border border-border bg-card p-1.5">
      {[1, 2, 3, 4].map(step => (
        <span key={step} className={cn('w-1 rounded-sm', step <= level ? fill : 'bg-border')} style={{ height: `${step * 25}%` }} />
      ))}
    </span>
  );
}
