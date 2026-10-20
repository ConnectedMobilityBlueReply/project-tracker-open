import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  footerTone?: 'neutral' | 'success';
  headingLevel?: 'h2' | 'h3';
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  icon,
  actions,
  footer,
  footerTone = 'neutral',
  headingLevel: Heading = 'h2',
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  return (
    <section className={cn('overflow-hidden rounded-card border border-border bg-card shadow-xs', className)}>
      <header className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
        {icon && (
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground shadow-xs [&_svg]:size-5">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Heading className="text-lg font-semibold leading-tight text-foreground">{title}</Heading>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
      {footer && (
        <footer
          className={cn(
            'border-t px-5 py-3 text-sm',
            footerTone === 'success' ? 'border-success/20 bg-banner-success text-success-strong' : 'border-border text-muted-foreground',
          )}
        >
          {footer}
        </footer>
      )}
    </section>
  );
}
