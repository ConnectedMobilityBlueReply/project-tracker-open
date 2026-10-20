import type { RangeRow } from '../types';
import { daysToHours } from './units.ts';

export type CellKind = 'empty' | 'planned' | 'logged' | 'extra';

export interface CellState {
  kind: CellKind;
  loggedHours: number;
  plannedHours: number;
  /** Consuntivato meno assegnato, in ore. Zero per le celle senza assegnazione. */
  deltaHours: number;
  isOver: boolean;
  hasNote: boolean;
  entryId: number | null;
  notes: string | null;
}

const EMPTY: CellState = {
  kind: 'empty',
  loggedHours: 0,
  plannedHours: 0,
  deltaHours: 0,
  isOver: false,
  hasNote: false,
  entryId: null,
  notes: null,
};

/** Lo stato di una cella. Una settimana assente dalla mappa e' `empty`, non zero. */
export function cellState(row: RangeRow, weekStart: string): CellState {
  const cell = row.weeks[weekStart];
  if (cell == null) return EMPTY;

  const loggedHours = daysToHours(cell.man_days);
  const plannedHours = daysToHours(cell.planned_days);
  const hasNote = cell.notes != null && cell.notes.trim() !== '';

  // Una voce extra non ha assegnazione: il delta non e' definito, non e' zero.
  if (row.is_extra) {
    return { kind: 'extra', loggedHours, plannedHours: 0, deltaHours: 0,
             isOver: false, hasNote, entryId: cell.entry_id, notes: cell.notes };
  }
  if (loggedHours === 0) {
    return { kind: plannedHours > 0 ? 'planned' : 'empty', loggedHours, plannedHours,
             deltaHours: 0, isOver: false, hasNote, entryId: cell.entry_id, notes: cell.notes };
  }
  const deltaHours = loggedHours - plannedHours;
  // Sforamento solo se c'e' un'assegnazione da sforare: senza, la cella mostra
  // le ore senza allarme, altrimenti si accenderebbe su ogni consuntivo quando
  // allocation_weeks e' poco popolata.
  return { kind: 'logged', loggedHours, plannedHours, deltaHours,
           isOver: plannedHours > 0 && deltaHours > 0, hasNote, entryId: cell.entry_id, notes: cell.notes };
}

/** Ore consuntivate da tutte le righe in una settimana. */
export function weekTotalHours(rows: RangeRow[], weekStart: string): number {
  return rows.reduce((total, row) => total + daysToHours(row.weeks[weekStart]?.man_days ?? 0), 0);
}

/** Ore consuntivate da una riga nelle sole settimane visibili. */
export function rowTotalHours(row: RangeRow, weeks: string[]): number {
  return weeks.reduce((total, week) => total + daysToHours(row.weeks[week]?.man_days ?? 0), 0);
}

/**
 * Il superamento della stima si misura sul consuntivato di sempre, non
 * sull'intervallo a schermo: e' una proprieta' dell'attivita', non della
 * finestra che si sta guardando.
 */
export function isRowOverEstimate(row: RangeRow): boolean {
  if (row.is_extra) return false;
  return row.estimated_days > 0 && row.total_man_days > row.estimated_days;
}

/** Accetta sia la virgola sia il punto: la tastiera italiana produce la virgola. */
export function parseHours(raw: string): number | null {
  const normalised = raw.trim().replace(',', '.');
  if (normalised === '') return 0;
  const value = Number(normalised);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Ore in stringa localizzata (virgola), senza decimali superflui. */
export function formatHours(hours: number): string {
  return String(Number(hours.toFixed(2))).replace('.', ',');
}

/** Riempimento della barra di capacità in header. Capacità 0 (settimana tutta festiva) non divide. */
export function capacityFill(totalHours: number, capacityHours: number): { pct: number; over: boolean } {
  if (capacityHours <= 0) return totalHours > 0 ? { pct: 100, over: true } : { pct: 0, over: false };
  return {
    pct: Math.min(100, Math.max(0, (totalHours / capacityHours) * 100)),
    over: totalHours > capacityHours,
  };
}
