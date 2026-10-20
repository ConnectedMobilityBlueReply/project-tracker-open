import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import type { TaskGroup, TaskGroupKey } from '@/lib/mieiTaskGroups';
import { cn } from '@/lib/utils';

interface Props<T> {
  groups: TaskGroup<T>[];
  renderItem: (item: T) => ReactNode;
}

const COLLAPSED_BY_DEFAULT: readonly TaskGroupKey[] = ['closed'];

/** Gruppi comprimibili; i gruppi vuoti non si mostrano. */
export function TaskGroupList<T>({ groups, renderItem }: Props<T>) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<TaskGroupKey>>(() => new Set(COLLAPSED_BY_DEFAULT));
  const toggle = (key: TaskGroupKey) => setCollapsed(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return (
    <div className="divide-y divide-border">
      {groups.filter(group => group.items.length > 0).map(group => {
        const isOpen = !collapsed.has(group.key);
        return (
          <section key={group.key} aria-labelledby={`group-${group.key}`}>
            <button
              type="button"
              id={`group-${group.key}`}
              aria-expanded={isOpen}
              onClick={() => toggle(group.key)}
              className={cn(
                'flex w-full items-center gap-2 bg-muted/40 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide',
                group.key === 'overdue' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {isOpen ? <CaretDown aria-hidden="true" /> : <CaretRight aria-hidden="true" />}
              {group.label}
              <span className="tabular-nums">({group.items.length})</span>
            </button>
            {isOpen && <ul>{group.items.map(renderItem)}</ul>}
          </section>
        );
      })}
    </div>
  );
}
