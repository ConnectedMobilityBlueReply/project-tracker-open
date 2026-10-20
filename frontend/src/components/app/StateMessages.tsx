import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export function ErrorBanner({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span className="min-w-0">{children}</span>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Caricamento…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground', className)}>
      <Spinner label={label} />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  bordered = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-2 px-6 py-10 text-center',
      bordered && 'rounded-card border border-dashed border-border',
    )}>
      {icon && <span aria-hidden="true" className="mb-1 text-muted-foreground [&_svg]:size-6">{icon}</span>}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
