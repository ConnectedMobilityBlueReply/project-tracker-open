export interface ParsedWbsDateLine {
  source: string;
  date: string | null;
  valid: boolean;
}

const DATE_PATTERNS = [
  /^(\d{2})\/(\d{2})\/(\d{4})$/,
  /^(\d{4})-(\d{2})-(\d{2})$/,
] as const;

function toIsoDate(year: number, month: number, day: number): string | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null;

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function parseDate(value: string): string | null {
  for (const [index, pattern] of DATE_PATTERNS.entries()) {
    const match = value.match(pattern);
    if (!match) continue;

    const [first, second, third] = match.slice(1).map(Number);
    return index === 0
      ? toIsoDate(third, second, first)
      : toIsoDate(first, second, third);
  }
  return null;
}

export function parseWbsDateList(input: string): ParsedWbsDateLine[] {
  return input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(source => {
      const value = source.replace(/^[-*•]\s*/, '').trim();
      const date = parseDate(value);
      return { source, date, valid: date !== null };
    });
}

export function formatWbsDateName(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}
