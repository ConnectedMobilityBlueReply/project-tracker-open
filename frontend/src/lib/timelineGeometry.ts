import { addMonths, format, getISOWeek, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';

/**
 * Geometria della timeline in stile Plane: da lista di lunedi' a pixel.
 * Funzioni pure, separate dai componenti per poterle testare con
 * `node --test` — stesso motivo di `consuntivazioneRange.ts`.
 */

export type GanttZoom = 'month' | 'quarter' | 'year';

/**
 * Larghezza in px di una colonna settimana per livello di zoom del Gantt.
 * Con `month` si vede un solo mese (4-5 colonne), quindi le colonne sono larghe.
 */
export const GANTT_WEEK_WIDTH: Record<GanttZoom, number> = { month: 180, quarter: 24, year: 12 };

/** Larghezza in px del pannello sinistro sticky (`w-72`). */
export const SIDEBAR_WIDTH = 288;

const parseIso = (iso: string): Date => new Date(`${iso}T00:00:00`);

export interface MonthSpan {
  /** `yyyy-MM` del mese. */
  key: string;
  /** Etichetta header, es. "set 2026". */
  label: string;
  weekCount: number;
}

/** Raggruppa settimane consecutive per mese del loro lunedi'. */
export function monthSpans(weeks: string[]): MonthSpan[] {
  const spans: MonthSpan[] = [];
  for (const week of weeks) {
    const key = week.slice(0, 7);
    const last = spans[spans.length - 1];
    if (last?.key === key) {
      spans[spans.length - 1] = { ...last, weekCount: last.weekCount + 1 };
    } else {
      spans.push({ key, label: format(parseIso(week), 'MMM yyyy', { locale: it }), weekCount: 1 });
    }
  }
  return spans;
}

/**
 * Larghezza colonna perche' `weekCount` settimane riempiano l'area timeline
 * (viewport meno pannello sinistro), mai sotto `minWidth`. Arrotonda per difetto.
 */
export function fillWeekWidth(viewportWidth: number, weekCount: number, minWidth: number): number {
  if (viewportWidth <= 0 || weekCount <= 0) return minWidth;
  return Math.max(minWidth, Math.floor((viewportWidth - SIDEBAR_WIDTH) / weekCount));
}

/** Le settimane il cui lunedi' cade nel mese `monthKey` (`yyyy-MM`), come in `monthSpans`. */
export function weeksOfMonth(weeks: string[], monthKey: string): string[] {
  return weeks.filter(week => week.startsWith(monthKey));
}

/** `monthKey` (`yyyy-MM`) spostato di `delta` mesi, anche oltre l'anno. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  return format(addMonths(parseIso(`${monthKey}-01`), delta), 'yyyy-MM');
}

/** Lunedi' (`yyyy-MM-dd`) della settimana che contiene `day`. */
export function mondayOf(day: string): string {
  return format(startOfWeek(parseIso(day), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/** Indice in `weeks` della settimana che contiene `today`; -1 se fuori intervallo. */
export function currentWeekIndex(weeks: string[], today: string): number {
  return weeks.indexOf(mondayOf(today));
}

/** Numero di settimana ISO del lunedi', per l'header ("W38"). */
export function isoWeekNumber(week: string): number {
  return getISOWeek(parseIso(week));
}

/** Larghezza minima in px di un mese ridimensionato dall'utente. */
export const MIN_MONTH_WIDTH = 24;

export const clampMonthWidth = (width: number): number => Math.max(MIN_MONTH_WIDTH, width);

/**
 * Bordi orizzontali delle settimane: `n + 1` posizioni in px, la settimana `i`
 * va da `edges[i]` a `edges[i + 1]`. Un mese presente in `monthWidths`
 * (`yyyy-MM` -> px) divide la sua larghezza fra le sue settimane; gli altri
 * usano `weekWidth`. Il mese di una settimana e' quello del lunedi', come in `monthSpans`.
 */
export function weekEdges(weeks: string[], weekWidth: number, monthWidths: Record<string, number>): number[] {
  const weeksPerMonth = new Map(monthSpans(weeks).map(span => [span.key, span.weekCount]));
  const edges = [0];
  for (const week of weeks) {
    const key = week.slice(0, 7);
    const custom = monthWidths[key];
    const width = custom == null ? weekWidth : custom / (weeksPerMonth.get(key) ?? 1);
    edges.push(edges[edges.length - 1] + width);
  }
  return edges;
}

/** Bordi di `count` settimane tutte larghe `weekWidth`. */
export function uniformWeekEdges(count: number, weekWidth: number): number[] {
  return Array.from({ length: count + 1 }, (_, index) => index * weekWidth);
}

/** Posizione orizzontale di un tratto di `length` settimane che parte a `startIndex`. */
export function barGeometry(
  edges: number[], startIndex: number, length: number,
): { left: number; width: number } {
  const left = edges[startIndex];
  return { left, width: edges[startIndex + length] - left };
}

/**
 * `scrollLeft` che porta la settimana `index` al centro dell'area timeline
 * visibile: il pannello sinistro sticky ne copre `SIDEBAR_WIDTH`. Mai negativo.
 */
export function centerScrollLeft(edges: number[], index: number, viewportWidth: number): number {
  const { left, width } = barGeometry(edges, index, 1);
  const visible = Math.max(viewportWidth - SIDEBAR_WIDTH, width);
  return Math.max(0, left + width / 2 - visible / 2);
}
