import type { RangeRow, TaskType } from '../types';
import { TASK_LABELS } from '../types.ts';
import { isRowOverEstimate } from './consuntivazioneGrid.ts';

/**
 * Ricerca testuale e filtro delle righe della griglia di Consuntivazione.
 * Funzione pura, separata dalla pagina per poterla testare con `node --test`
 * — stesso motivo per cui `consuntivazioneRange.ts` esiste accanto a
 * `Consuntivazione.tsx`.
 */

export type RowFilter = 'all' | 'with-days' | 'over-budget';

/**
 * Filtra le righe per testo di ricerca (progetto, attività, componente WBS)
 * e per `rowFilter`. "Sopra stima" riusa `isRowOverEstimate`, la stessa
 * funzione che colora la riga nella griglia, non una ricostruzione locale.
 */
export function filterRows(
  rows: RangeRow[],
  weeks: string[],
  query: string,
  rowFilter: RowFilter,
): RangeRow[] {
  const normalisedQuery = query.trim().toLowerCase();
  return rows.filter(row => {
    if (normalisedQuery !== '') {
      const haystack = [
        row.project_name,
        TASK_LABELS[row.task_type as TaskType] || row.task_type,
        row.wbs_item_name ?? '',
      ].join(' ').toLowerCase();
      if (!haystack.includes(normalisedQuery)) return false;
    }
    if (rowFilter === 'with-days') return weeks.some(week => (row.weeks[week]?.man_days ?? 0) > 0);
    if (rowFilter === 'over-budget') return isRowOverEstimate(row);
    return true;
  });
}
