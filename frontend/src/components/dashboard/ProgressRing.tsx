export function ProgressRing({ value, size = 24 }: { value: number; size?: number }) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const deg = safeValue * 3.6;

  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--foreground) ${deg}deg, var(--muted) 0)`,
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 3px))',
      }}
    />
  );
}
