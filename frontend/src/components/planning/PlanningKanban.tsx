import { useState, type DragEvent } from 'react';
import { DotsThree } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { WBS_PRIORITY_LABELS, WBS_STATUS_LABELS, type WbsPlanningItem, type WbsStatus } from '../../types';
import { completionTone } from '../../lib/statusTone';
import { canEditProgress, isOverdue, kanbanColumns, KANBAN_STATUSES } from '../../lib/planningModel';
import { PRIORITY_CELL, STATUS_BAR } from './planningStyles';
import { formatDue, OwnerAvatar, taskLabel } from './PlanningCells';
import type { PlanningViewProps } from './PlanningTable';

const DRAG_TYPE = 'application/x-wbs-id';

/**
 * Drag HTML5 come scorciatoia da mouse; il menu "Sposta in…" è la via accessibile
 * (tastiera, touch: il drag nativo non funziona su touch).
 */
export default function PlanningKanban({ items, today, user, rowErrors, onPatch }: PlanningViewProps) {
  const columns = kanbanColumns(items);
  const [dropTarget, setDropTarget] = useState<WbsStatus | null>(null);

  function onDrop(event: DragEvent, status: WbsStatus) {
    event.preventDefault();
    setDropTarget(null);
    const id = Number(event.dataTransfer.getData(DRAG_TYPE));
    const item = items.find(i => i.id === id);
    if (item && item.status !== status && canEditProgress(user, item)) onPatch(id, { status });
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {KANBAN_STATUSES.map(status => (
        <section
          key={status}
          aria-label={`${WBS_STATUS_LABELS[status]}, ${columns[status].length} WBS`}
          onDragOver={event => { if (event.dataTransfer.types.includes(DRAG_TYPE)) { event.preventDefault(); setDropTarget(status); } }}
          onDragLeave={() => setDropTarget(current => (current === status ? null : current))}
          onDrop={event => onDrop(event, status)}
          className={cn('flex min-h-40 flex-col gap-2 rounded-card border border-border bg-muted/30 p-3', dropTarget === status && 'ring-2 ring-primary')}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden="true" className={cn('size-2.5 rounded-full', STATUS_BAR[status])} />
            {WBS_STATUS_LABELS[status]}
            <span className="ml-auto tabular-nums text-muted-foreground">{columns[status].length}</span>
          </h2>
          {columns[status].map(item => (
            <KanbanCard key={item.id} item={item} today={today} editable={canEditProgress(user, item)}
              error={rowErrors[item.id]} onMove={next => onPatch(item.id, { status: next })} />
          ))}
        </section>
      ))}
    </div>
  );
}

function KanbanCard({ item, today, editable, error, onMove }: {
  item: WbsPlanningItem;
  today: string;
  editable: boolean;
  error?: string;
  onMove: (status: WbsStatus) => void;
}) {
  return (
    <article
      draggable={editable}
      onDragStart={event => { event.dataTransfer.setData(DRAG_TYPE, String(item.id)); event.dataTransfer.effectAllowed = 'move'; }}
      className={cn('space-y-2 rounded-lg border border-border bg-card p-3 shadow-xs', editable && 'cursor-grab active:cursor-grabbing')}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{item.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{taskLabel(item)}</p>
        </div>
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={`Sposta ${item.name}`}>
                <DotsThree aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {KANBAN_STATUSES.filter(status => status !== item.status).map(status => (
                <DropdownMenuItem key={status} onSelect={() => onMove(status)}>
                  Sposta in {WBS_STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <Progress value={item.completion_pct} size="sm" tone={completionTone(item.completion_pct)} aria-label={`Avanzamento ${item.completion_pct}%`} />
      <div className="flex items-center gap-2 text-xs">
        <OwnerAvatar name={item.assignee_person_name} />
        <span className={cn('rounded-md px-1.5 py-0.5 font-medium', PRIORITY_CELL[item.priority])}>{WBS_PRIORITY_LABELS[item.priority]}</span>
        <span className={cn('ml-auto tabular-nums', isOverdue(item, today) ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {formatDue(item.planned_end)}
        </span>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </article>
  );
}
