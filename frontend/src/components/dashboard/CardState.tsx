import type { ReactNode } from 'react';
import { ErrorBanner } from '@/components/app/StateMessages';
import { SectionCard } from '@/components/app/SectionCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { Source } from './useDashboardData';

interface Props {
  title: string;
  sources: Source<unknown>[];
  /** Altezza dello skeleton: imita la card che sostituisce. */
  skeletonClassName?: string;
  children: () => ReactNode;
}

/** Card che dipende da una o più fonti: skeleton, errore con retry delle sole fonti fallite, o contenuto. */
export function CardState({ title, sources, skeletonClassName = 'h-48', children }: Props) {
  const failed = sources.filter(source => source.error != null);
  if (failed.length > 0) {
    return (
      <SectionCard title={title}>
        <ErrorBanner onRetry={() => failed.forEach(source => source.retry())}>{failed[0].error}</ErrorBanner>
      </SectionCard>
    );
  }
  if (sources.some(source => source.loading || source.data == null)) {
    return (
      <SectionCard title={title}>
        <div role="status" aria-label={`Caricamento ${title}`}>
          <Skeleton className={`w-full ${skeletonClassName}`} />
        </div>
      </SectionCard>
    );
  }
  return <>{children()}</>;
}
