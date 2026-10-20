import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { completionTone } from '@/lib/statusTone';
import { relativeDue } from '@/lib/mieiTaskGroups';
import { cn } from '@/lib/utils';
import { TASK_LABELS, type TaskType, type WbsPersonTask, type WbsStatus } from '@/types';
import { StatusPill } from './StatusPill';

interface Props {
  item: WbsPersonTask;
  today: string;
  pct: number;
  saving: boolean;
  onStatusChange: (status: WbsStatus) => void;
  onPctChange: (value: number) => void;
  onPctCommit: () => void;
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Riga a due livelli: nome, poi progetto · attività · stima; a destra stato, %, scadenza. */
export function TaskRow({ item, today, pct, saving, onStatusChange, onPctChange, onPctCommit }: Props) {
  const due = item.planned_end ? relativeDue(item.planned_end, today) : null;
  const overdue = due?.overdue === true && item.status !== 'chiuso';
  return (
    <li className="flex flex-col gap-2 border-b border-border px-4 py-2.5 last:border-b-0 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-sm font-medium', item.status === 'chiuso' && 'text-muted-foreground line-through')}>
          {item.name}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {item.project_name} · {TASK_LABELS[item.task_type as TaskType] ?? item.task_type} · {item.estimated_days} gg stimati
        </div>
      </div>
      <div className="flex items-center gap-3 md:shrink-0">
        <StatusPill status={item.status} disabled={saving} label={`Stato di ${item.name}`} onChange={onStatusChange} />
        <div className="flex items-center gap-2">
          <Progress value={pct} size="sm" tone={completionTone(pct)} aria-label={`Avanzamento ${pct}%`} className="w-16" />
          <Input
            type="number" min={0} max={100} inputMode="numeric"
            value={pct}
            disabled={saving}
            aria-label={`Completamento percentuale di ${item.name}`}
            className="h-7 w-14 text-right tabular-nums"
            onChange={event => onPctChange(Number(event.target.value))}
            onBlur={onPctCommit}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
          />
        </div>
        <span
          className={cn('w-20 text-right text-xs tabular-nums', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}
          title={item.planned_start ? `Dal ${formatDate(item.planned_start)} al ${formatDate(item.planned_end)}` : formatDate(item.planned_end)}
        >
          {due?.label ?? '—'}
        </span>
      </div>
    </li>
  );
}
