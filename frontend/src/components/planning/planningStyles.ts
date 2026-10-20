import type { WbsPriority, WbsStatus } from '../../types';
import type { PeriodGroup } from '../../lib/planningModel';

/** Celle tinte a tutta altezza come nel reference "Team planning": solo token, mai hex. */
export const STATUS_CELL: Record<WbsStatus, string> = {
  aperto: 'bg-orange/15 text-foreground',
  in_corso: 'bg-info/15 text-info-strong',
  chiuso: 'bg-success/15 text-success-strong',
};

export const STATUS_BAR: Record<WbsStatus, string> = {
  aperto: 'bg-orange',
  in_corso: 'bg-info',
  chiuso: 'bg-success',
};

export const PRIORITY_CELL: Record<WbsPriority, string> = {
  high: 'bg-purple/15 text-purple',
  medium: 'bg-info/15 text-info-strong',
  low: 'bg-muted text-foreground',
};

export const GROUP_ACCENT: Record<PeriodGroup, { bar: string; text: string }> = {
  overdue: { bar: 'bg-destructive', text: 'text-destructive-strong' },
  this_month: { bar: 'bg-primary', text: 'text-primary' },
  next_month: { bar: 'bg-purple', text: 'text-purple' },
  later: { bar: 'bg-teal', text: 'text-teal' },
  no_date: { bar: 'bg-muted-foreground', text: 'text-muted-foreground' },
  closed: { bar: 'bg-success', text: 'text-success-strong' },
};
