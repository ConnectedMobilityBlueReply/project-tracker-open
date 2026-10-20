import type { MonthPoint } from '@/lib/dashboardModel';

const SERIES = [
  { key: 'residual', label: 'Residuo', color: 'var(--data-orange)' },
  { key: 'actual', label: 'Consuntivato', color: 'var(--data-blue)' },
  { key: 'planned', label: 'Pianificato', color: 'var(--data-green)' },
] as const;

const formatDays = (value: number) => `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value)} gg`;

export function MonthBars({ points }: { points: readonly MonthPoint[] }) {
  const values = points.flatMap(point => [point.residual, point.actual, point.planned]).filter(Number.isFinite);
  const max = Math.max(0, ...values);
  const height = (value: number) => `${max > 0 && Number.isFinite(value) ? Math.max(0, value) / max * 100 : 0}%`;

  return (
    <div>
      {points.length === 0 && <p className="text-sm text-muted-foreground">Nessun dato disponibile</p>}
      <div className="flex h-36" aria-hidden="true">
        {points.map((point, index) => (
          <div key={point.month} className={`flex min-w-0 flex-1 flex-col ${index > 0 ? 'border-l border-border' : ''}`}>
            <div className="flex min-h-0 flex-1 items-end justify-center gap-0.5 px-1">
              {SERIES.map(series => (
                <span
                  key={series.key}
                  className="min-w-0 max-w-3 flex-1 rounded-t-sm"
                  style={{ height: height(point[series.key]), backgroundColor: series.color }}
                />
              ))}
            </div>
            <span className="truncate pt-1 text-center text-xs text-muted-foreground">{point.label}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Andamento mensile in giorni</caption>
        <thead>
          <tr><th scope="col">Mese</th>{SERIES.map(series => <th key={series.key} scope="col">{series.label}</th>)}</tr>
        </thead>
        <tbody>
          {points.map(point => (
            <tr key={point.month}>
              <th scope="row">{point.label}</th>
              {SERIES.map(series => <td key={series.key}>{formatDays(point[series.key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
