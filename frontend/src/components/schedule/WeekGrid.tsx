import type { ReactNode } from 'react';
import { EmptyState } from '../app/StateMessages';

/** Una colonna della griglia: una settimana, o piu' se aggregate. */
export interface WeekColumn {
  key: string;
  weeks: string[];
}

/**
 * Larghezze e bordi delle tre fasce della griglia. Vivono qui e non nelle
 * righe perche' sono l'unica cosa che deve restare identica fra Pianificazione
 * e Consuntivazione: se una riga le ridefinisse per conto suo, le due pagine
 * divergerebbero al primo ritocco.
 */
export const STICKY_COL = 'sticky left-0 z-10 w-56 shrink-0 border-r';
export const WEEK_COL = 'w-40 shrink-0 border-r';
export const TOTAL_COL = 'w-32 shrink-0';

interface WeekGridProps {
  columns: WeekColumn[];
  /** Intestazione della colonna sinistra. */
  headerLabel: ReactNode;
  /** Intestazione di una colonna settimana. */
  columnLabel: (column: WeekColumn) => ReactNode;
  /** Intestazione della colonna totali; assente = niente colonna totali. */
  totalsLabel?: ReactNode;
  /** Evidenzia l'intestazione della colonna corrente; assente = nessuna evidenza (Consuntivazione). */
  isCurrentColumn?: (column: WeekColumn) => boolean;
  /** Vero quando non c'e' nessuna riga: rende `emptyMessage` al posto del guscio. */
  isEmpty: boolean;
  emptyMessage: string;
  /** Le righe. Ognuna si disegna da sola usando STICKY_COL / WEEK_COL / TOTAL_COL. */
  children: ReactNode;
}

export default function WeekGrid({
  columns, headerLabel, columnLabel, totalsLabel, isCurrentColumn, isEmpty, emptyMessage, children,
}: WeekGridProps) {
  if (isEmpty) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card shadow-xs">
      <div className="min-w-max">
        <div className="flex border-b bg-topbar">
          <div className={`${STICKY_COL} bg-topbar px-3 py-2 text-sm font-medium`}>
            {headerLabel}
          </div>
          {columns.map(column => (
            <div
              key={column.key}
              className={`${WEEK_COL} px-2 py-2 text-xs font-medium ${
                isCurrentColumn?.(column) ? 'border-b-2 border-primary text-primary' : ''
              }`}
            >
              {columnLabel(column)}
            </div>
          ))}
          {totalsLabel != null && (
            <div className={`${TOTAL_COL} px-3 py-2 text-right text-xs font-medium`}>
              {totalsLabel}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
