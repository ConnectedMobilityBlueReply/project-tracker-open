import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TONE_BADGE_VARIANT, type Tone } from '@/lib/statusTone';

/** Direzione B: chip pieni. Tema chiaro: testo bianco su fill scuri. Tema scuro: inchiostro scuro (--status-ink). Il colore sta nel chip, non nella riga. */
const SOLID_CLASS: Record<Tone, string> = {
  blue: 'bg-status-blue text-status-ink',
  orange: 'bg-status-orange text-status-ink',
  green: 'bg-status-green text-status-ink',
  red: 'bg-status-red text-status-ink',
  amber: 'bg-status-amber text-status-ink',
  purple: 'bg-status-purple text-status-ink',
  neutral: 'bg-status-neutral text-status-ink',
};

interface StatusBadgeProps {
  tone: Tone;
  appearance?: 'dot' | 'soft' | 'solid';
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

export function StatusBadge({ tone, appearance = 'solid', size = 'md', className, children }: StatusBadgeProps) {
  const solid = appearance === 'solid';
  return (
    <Badge
      variant={TONE_BADGE_VARIANT[tone] ?? TONE_BADGE_VARIANT.neutral}
      dot={appearance === 'dot'}
      size={size}
      pill
      className={cn(solid && SOLID_CLASS[tone], className)}
    >
      {children}
    </Badge>
  );
}
