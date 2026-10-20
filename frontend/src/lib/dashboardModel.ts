import type { DashboardMonthlyRow, DashboardWbsStatus, WbsStatus } from '../types';
import { WBS_STATUS_LABELS } from '../types.ts';

const MONTH_LABELS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** Percentuale intera 0–100; 0 se il totale non è positivo o i valori non sono finiti. */
export function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export interface WbsSegment { key: WbsStatus; label: string; count: number; share: number }

export function wbsSegments(counts: DashboardWbsStatus): WbsSegment[] {
  const order: WbsStatus[] = ['in_corso', 'aperto', 'chiuso'];
  return order.map(key => {
    const count = counts[key];
    return { key, label: WBS_STATUS_LABELS[key], count, share: counts.total > 0 ? (count / counts.total) * 100 : 0 };
  });
}

/** Mesi `YYYY-MM` dal più vecchio al corrente. */
export function lastMonths(todayIso: string, count: number): string[] {
  const [y, m] = todayIso.slice(0, 7).split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export interface MonthPoint { month: string; label: string; planned: number; actual: number; residual: number }

const round1 = (v: number) => Math.round(v * 10) / 10;

export function monthlyTrack(rows: readonly DashboardMonthlyRow[], projectId: number | null, months: readonly string[]): MonthPoint[] {
  return months.map(month => {
    const inMonth = rows.filter(r => r.month === month && (projectId == null || r.project_id === projectId));
    const planned = round1(inMonth.reduce((s, r) => s + r.planned_days, 0));
    const actual = round1(inMonth.reduce((s, r) => s + r.actual_days, 0));
    return { month, label: MONTH_LABELS[Number(month.slice(5, 7)) - 1], planned, actual, residual: round1(Math.max(0, planned - actual)) };
  });
}

export interface TrackDelta { current: number; previous: number; deltaPct: number | null }

export function trackDelta(points: readonly MonthPoint[]): TrackDelta {
  const current = points.at(-1)?.actual ?? 0;
  const previous = points.at(-2)?.actual ?? 0;
  return { current, previous, deltaPct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
}

export function trackBanner(delta: TrackDelta): string {
  if (delta.deltaPct == null) {
    return delta.current > 0 ? `${delta.current.toLocaleString('it-IT')} gg consuntivati questo mese.` : 'Nessun consuntivo registrato negli ultimi due mesi.';
  }
  if (delta.deltaPct === 0) return 'Consuntivo stabile rispetto al mese precedente.';
  if (delta.deltaPct > 0) return `Consuntivo in crescita: +${delta.deltaPct.toLocaleString('it-IT', { useGrouping: true })}% rispetto al mese precedente.`;
  return `Consuntivo in calo: ${delta.deltaPct.toLocaleString('it-IT', { useGrouping: true })}% rispetto al mese precedente.`;
}

export interface ProgressSummary { progressPct: number; budgetPct: number; progressDeltaPts: number }

/** Contesto del banner: ore del mese e stima totale (0 = nessuna stima di allocazione). */
export interface ProgressBannerContext { currentMonthActual: number; estimatedDays: number }

export function progressSummary(
  projects: readonly { estimated_days: number; actual_days: number }[],
  listed: readonly { total_actual_days?: number; total_stima?: number }[],
  currentMonthActual: number,
): ProgressSummary {
  const estimated = projects.reduce((s, p) => s + p.estimated_days, 0);
  const actual = projects.reduce((s, p) => s + p.actual_days, 0);
  const withStima = listed.filter(p => (p.total_stima ?? 0) > 0);
  return {
    progressPct: pct(actual, estimated),
    budgetPct: pct(withStima.reduce((s, p) => s + (p.total_actual_days ?? 0), 0), withStima.reduce((s, p) => s + (p.total_stima ?? 0), 0)),
    progressDeltaPts: pct(currentMonthActual, estimated),
  };
}

export function progressBanner(summary: ProgressSummary, context?: ProgressBannerContext): string {
  if (summary.progressDeltaPts > 0) return `+${summary.progressDeltaPts} punti di avanzamento nel mese corrente.`;
  if (context && context.currentMonthActual > 0) {
    return context.estimatedDays > 0
      ? 'Meno di 1 punto di avanzamento nel mese corrente.'
      : 'Nessuna stima di allocazione: avanzamento non calcolabile.';
  }
  return 'Nessun avanzamento registrato nel mese corrente.';
}

export function notchFill(percentage: number, notches: number): number {
  if (!Number.isFinite(percentage)) return 0;
  return Math.max(0, Math.min(notches, Math.round((percentage / 100) * notches)));
}

export interface TimelineWeek { start: string; label: string }

/** Lunedì delle settimane che toccano il mese di `todayIso`. */
export function monthWeeks(todayIso: string): TimelineWeek[] {
  const [y, m] = todayIso.slice(0, 7).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const monday = new Date(first);
  monday.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const weeks: TimelineWeek[] = [];
  for (let d = monday; d <= last; d = new Date(d.getTime() + 7 * 86_400_000)) {
    const iso = d.toISOString().slice(0, 10);
    weeks.push({ start: iso, label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}` });
  }
  return weeks;
}

export interface TimelineRow<P> { project: P; startIndex: number; span: number }

export function timelineRows<P extends { start_date: string | null; end_date: string | null }>(
  projects: readonly P[],
  weeks: readonly TimelineWeek[],
): TimelineRow<P>[] {
  if (weeks.length === 0) return [];
  const rangeStart = weeks[0].start;
  const lastWeek = new Date(`${weeks.at(-1)!.start}T00:00:00Z`);
  const rangeEnd = new Date(lastWeek.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
  const indexOf = (iso: string) => {
    let index = 0;
    weeks.forEach((w, i) => { if (w.start <= iso) index = i; });
    return index;
  };
  return projects
    .filter(p => p.start_date && p.end_date && p.start_date <= rangeEnd && p.end_date >= rangeStart)
    .map(p => {
      const startIndex = p.start_date! < rangeStart ? 0 : indexOf(p.start_date!);
      const endIndex = p.end_date! > rangeEnd ? weeks.length - 1 : indexOf(p.end_date!);
      return { project: p, startIndex, span: Math.max(1, endIndex - startIndex + 1) };
    });
}

export function filterDashboardProjects<
  P extends { name: string; status: string; societa: string | null; area: string | null; codice_offerta: string | null; tasks: readonly { task_type: string }[] },
>(projects: readonly P[], query: string, status: string): P[] {
  const q = query.trim().toLocaleLowerCase('it');
  return projects.filter(p => {
    if (status !== 'all' && p.status !== status) return false;
    if (!q) return true;
    const haystack = [p.name, p.societa, p.area, p.codice_offerta, ...p.tasks.map(t => t.task_type)]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('it');
    return haystack.includes(q);
  });
}

export const NEAR_ESTIMATE_RATIO = 0.9;
export const BURN_AHEAD_POINTS = 15;
const CLOSED_STATUS = 'concluso';
/** A consuntivo la stima non è un tetto: le regole sul budget non si applicano. */
const NO_ESTIMATE_CAP_STATUS = 'lavorato a consuntivo';

export type WatchSignal = 'overEstimate' | 'nearEstimate' | 'overdue' | 'burnAhead';
export type WatchSeverity = 'danger' | 'warning';

export const WATCH_SIGNAL_LABEL: Record<WatchSignal, string> = {
  overEstimate: 'Sopra stima',
  nearEstimate: 'In esaurimento',
  overdue: 'Scaduto',
  burnAhead: 'Consumo più veloce del tempo',
};

export const WATCH_SIGNAL_SEVERITY: Record<WatchSignal, WatchSeverity> = {
  overEstimate: 'danger',
  nearEstimate: 'warning',
  overdue: 'danger',
  burnAhead: 'warning',
};

export interface WatchInput {
  name: string;
  status: string;
  estimated_days: number;
  actual_days: number;
  start_date: string | null;
  end_date: string | null;
}

export interface WatchItem<P> {
  project: P;
  signals: WatchSignal[];
  severity: WatchSeverity;
}

function dayMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function signalsOf(project: WatchInput, todayIso: string): WatchSignal[] {
  const signals: WatchSignal[] = [];
  const today = todayIso.slice(0, 10);
  const end = project.end_date?.slice(0, 10) || null;
  const start = project.start_date?.slice(0, 10) || null;
  const budgeted = project.status !== NO_ESTIMATE_CAP_STATUS && project.estimated_days > 0;
  const burnPct = budgeted ? (project.actual_days / project.estimated_days) * 100 : 0;
  const overEstimate = budgeted && project.actual_days > project.estimated_days;

  if (overEstimate) signals.push('overEstimate');
  else if (budgeted && project.actual_days >= NEAR_ESTIMATE_RATIO * project.estimated_days) signals.push('nearEstimate');
  if (end != null && end < today) signals.push('overdue');
  if (budgeted && !overEstimate && start != null && end != null && dayMs(end) > dayMs(start)) {
    const elapsedPct = Math.min(100, Math.max(0, ((dayMs(today) - dayMs(start)) / (dayMs(end) - dayMs(start))) * 100));
    if (burnPct > elapsedPct + BURN_AHEAD_POINTS) signals.push('burnAhead');
  }
  return signals;
}

/** Progetti su cui un PM dovrebbe intervenire. Il "consumo più veloce" è un proxy: ignora l'avanzamento reale. */
export function watchlist<P extends WatchInput>(projects: readonly P[], todayIso: string): WatchItem<P>[] {
  return projects
    .filter(project => project.status !== CLOSED_STATUS)
    .map(project => {
      const signals = signalsOf(project, todayIso);
      const severity: WatchSeverity = signals.some(s => WATCH_SIGNAL_SEVERITY[s] === 'danger') ? 'danger' : 'warning';
      return { project, signals, severity };
    })
    .filter(item => item.signals.length > 0)
    .sort((a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1)
      || a.project.name.localeCompare(b.project.name, 'it'));
}
