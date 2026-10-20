import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TONE_BADGE_VARIANT, type Tone } from '@/lib/statusTone';

/** Il viola dei chip è il brand dell'app (stesso di button/hover), non il magenta di --purple. */
const SOFT_OVERRIDE: Partial<Record<Tone, string>> = {
  purple: 'bg-brand/10 text-brand-strong',
};

interface StatusBadgeProps {
  tone: Tone;
  appearance?: 'dot' | 'soft';
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}

export function StatusBadge({ tone, appearance = 'soft', size = 'md', className, children }: StatusBadgeProps) {
  return (
    <Badge
      variant={TONE_BADGE_VARIANT[tone] ?? TONE_BADGE_VARIANT.neutral}
      dot={appearance === 'dot'}
      size={size}
      pill
      className={cn(appearance === 'soft' && SOFT_OVERRIDE[tone], className)}
    >
      {children}
    </Badge>
  );
}
