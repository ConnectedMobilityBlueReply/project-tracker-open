function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function clampPercentage(value: unknown): number {
  const numeric = toFiniteNumber(value);
  if (numeric == null) return 0;
  return Math.min(100, Math.max(0, numeric));
}
