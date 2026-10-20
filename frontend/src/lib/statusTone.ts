import type { WbsStatus } from '../types';
import type { UtilizationLevel } from './capacity.ts';

/** Tono cromatico di un dato: si traduce in variante Badge o tono Progress, mai in hex. */
export type Tone = 'blue' | 'orange' | 'green' | 'red' | 'amber' | 'purple' | 'neutral';

export const WBS_STATUS_TONE: Record<WbsStatus, Tone> = {
  aperto: 'neutral',
  in_corso: 'blue',
  chiuso: 'green',
};

export function projectStatusTone(status: string): Tone {
  switch (status) {
    case 'active':
    case 'in lavorazione': return 'blue';
    case 'concluso': return 'green';
    case 'lavorato a consuntivo': return 'purple';
    case 'da lavorare':
    default: return 'neutral';
  }
}

export const UTILIZATION_TONE: Record<UtilizationLevel, Tone> = {
  free: 'neutral',
  under: 'green',
  full: 'amber',
  over: 'red',
  conflict: 'red',
};

export const TONE_BADGE_VARIANT = {
  blue: 'info',
  orange: 'orange',
  green: 'success',
  red: 'destructive',
  amber: 'warning',
  purple: 'purple',
  neutral: 'secondary',
} as const satisfies Record<Tone, string>;

export type ProgressTone = 'info' | 'success' | 'warning' | 'destructive';

/** Consumo di budget/stima: oltre il 100% è sforamento. */
export function consumptionTone(pct: number): ProgressTone {
  if (pct > 100) return 'destructive';
  if (pct >= 80) return 'warning';
  return 'info';
}

/** Completamento (es. % WBS): il 100% è un traguardo, non un allarme. */
export function completionTone(pct: number): ProgressTone {
  return pct >= 100 ? 'success' : 'info';
}
