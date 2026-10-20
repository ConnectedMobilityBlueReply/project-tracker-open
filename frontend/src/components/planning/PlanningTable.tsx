import { useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { User, WbsPlanningItem, WbsProgressPatch } from '../../types';
import { completionTone } from '../../lib/statusTone';
import {
  canEditPriority, canEditProgress, groupByPeriod, isOverdue, PERIOD_GROUP_LABELS, type PeriodGroup,
} from '../../lib/planningModel';
import { GROUP_ACCENT } from './planningStyles';
import { formatDue, OwnerAvatar, PriorityCell, StatusCell, taskLabel } from './PlanningCells';

export interface PlanningViewProps {
  items: WbsPlanningItem[];
  today: string;
  user: User | null;
  rowErrors: Record<number, string>;
  onPatch: (id: number, patch: WbsProgressPatch) => void;
}

const HEAD = 'px-2 py-2 text-center text-xs font-medium text-muted-foreground';
const COL = 'h-10 border-l border-border p-0 text-center text-sm';

export default function PlanningTable({ items, today, user, rowErrors, onPatch }: PlanningViewProps) {
  const [openClosed, setOpenClosed] = useState(false);
  const groups = groupByPeriod(items, today);

  return (
    <div className="space-y-8">
      {groups.map(group => {
        const accent = GROUP_ACCENT[group.key];
        const collapsed = group.key === 'closed' && !openClosed;
        return (
          <section key={group.key} aria-labelledby={`planning-group-${group.key}`}>
            <GroupTitle group={group.key} count={group.items.length} collapsible={group.key === 'closed'}
              collapsed={collapsed} onToggle={() => setOpenClosed(open => !open)} className={accent.text} />
            {!collapsed && (
              <div className="overflow-x-auto rounded-card border border-border bg-card">
                <table className="w-full min-w-[56rem] border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className={cn(HEAD, 'sticky left-0 z-10 bg-card text-left pl-5')}>WBS</th>
                      <th scope="col" className={cn(HEAD, 'w-20')}>Owner</th>
                      <th scope="col" className={cn(HEAD, 'w-44')}>Timeline</th>
                      <th scope="col" className={cn(HEAD, 'w-32')}>Stato</th>
                      <th scope="col" className={cn(HEAD, 'w-28')}>Scadenza</th>
                      <th scope="col" className={cn(HEAD, 'w-28')}>Priorità</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map(item => (
                      <tr key={item.id} className="border-b border-border last:border-b-0">
                        <th scope="row" className="sticky left-0 z-10 h-10 bg-card p-0 text-left font-normal">
                          <div className="flex h-full items-stretch">
                            <span aria-hidden="true" className={cn('w-1 shrink-0', accent.bar)} />
                            <div className="min-w-0 px-4 py-1.5">
                              <div className="truncate text-sm">{item.name}</div>
                              <div className="truncate text-xs text-muted-foreground">{taskLabel(item)}</div>
                              {rowErrors[item.id] && <div role="alert" className="text-xs text-destructive">{rowErrors[item.id]}</div>}
                            </div>
                          </div>
                        </th>
                        <td className={COL}><div className="flex justify-center"><OwnerAvatar name={item.assignee_person_name} /></div></td>
                        <td className={cn(COL, 'px-3')}>
                          <Progress value={item.completion_pct} size="sm" tone={completionTone(item.completion_pct)}
                            aria-label={`Avanzamento ${item.completion_pct}%`}
                            title={!item.planned_start && !item.planned_end
                              ? `${item.completion_pct}%`
                              : `${formatDue(item.planned_start)} → ${formatDue(item.planned_end)} · ${item.completion_pct}%`} />
                        </td>
                        <td className={COL}>
                          <StatusCell item={item} editable={canEditProgress(user, item)} onChange={status => onPatch(item.id, { status })} />
                        </td>
                        <td className={cn(COL, isOverdue(item, today) && 'font-medium text-destructive')}>{formatDue(item.planned_end)}</td>
                        <td className={COL}>
                          <PriorityCell item={item} editable={canEditPriority(user)} onChange={priority => onPatch(item.id, { priority })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function GroupTitle({ group, count, collapsible, collapsed, onToggle, className }: {
  group: PeriodGroup;
  count: number;
  collapsible: boolean;
  collapsed: boolean;
  onToggle: () => void;
  className: string;
}) {
  const label = `${PERIOD_GROUP_LABELS[group]} (${count})`;
  return (
    <h2 id={`planning-group-${group}`} className={cn('mb-2 text-lg font-semibold', className)}>
      {collapsible ? (
        <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="inline-flex items-center gap-1.5">
          <CaretRight aria-hidden="true" className={cn('size-4 transition-transform', !collapsed && 'rotate-90')} />
          {label}
        </button>
      ) : label}
    </h2>
  );
}
