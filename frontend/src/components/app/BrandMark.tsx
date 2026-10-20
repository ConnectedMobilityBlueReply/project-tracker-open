import { Kanban } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export function BrandMark({ wordmark = true, className }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-tile text-white shadow-xs [&_svg]:size-5">
        <Kanban />
      </span>
      {wordmark && <span className="truncate font-display text-lg font-semibold tracking-tight text-foreground">Project Tracker</span>}
    </span>
  );
}
