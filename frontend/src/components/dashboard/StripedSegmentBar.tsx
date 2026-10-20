import type { WbsSegment } from '@/lib/dashboardModel';

export const SEGMENT_COLOR: Record<WbsSegment['key'], string> = {
  in_corso: 'var(--data-blue)',
  aperto: 'var(--data-orange)',
  chiuso: 'var(--data-green)',
};

const STRIPES = 'repeating-linear-gradient(135deg, var(--stripe-highlight) 0 4px, transparent 4px 9px)';

export function StripedSegmentBar({ segments }: { segments: readonly WbsSegment[] }) {
  const visible = segments.filter(segment => segment.count > 0);
  if (visible.length === 0) return <div className="h-6 rounded-full bg-muted" aria-hidden="true" />;

  return (
    <div className="flex h-6 gap-1" aria-hidden="true">
      {visible.map(segment => (
        <div
          key={segment.key}
          className="h-full rounded-full"
          style={{ width: `${segment.share}%`, backgroundColor: SEGMENT_COLOR[segment.key], backgroundImage: STRIPES }}
        />
      ))}
    </div>
  );
}
