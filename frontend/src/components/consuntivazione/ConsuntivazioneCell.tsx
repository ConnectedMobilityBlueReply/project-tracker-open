import { useState } from 'react';
import type { RangeRow } from '../../types';
import { cellState, formatHours, parseHours } from '../../lib/consuntivazioneGrid';
import type { NavKey } from '../../lib/gridNav';
import type { Density } from '../schedule/ScheduleToolbar';

export type CellSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  row: RangeRow;
  weekStart: string;
  density: Density;
  saveState: CellSaveState;
  errorMessage: string | null;
  rowIndex: number;
  colIndex: number;
  onNavigate: (key: NavKey) => void;
  onCommit: (row: RangeRow, weekStart: string, hours: number) => void;
  onOpenDetail: (row: RangeRow, weekStart: string) => void;
}

const INVALID_HOURS_MESSAGE = 'Inserire un numero di ore maggiore o uguale a zero';

export default function ConsuntivazioneCell({
  row, weekStart, density, saveState, errorMessage, rowIndex, colIndex, onNavigate, onCommit, onOpenDetail,
}: Props) {
  const state = cellState(row, weekStart);
  const [draft, setDraft] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const editing = draft != null;
  const cellHeight = density === 'compact' ? 'min-h-[40px]' : 'min-h-[56px]';
  // Identifica l'attivita' e la settimana: senza, uno screen reader sente la
  // stessa etichetta per ogni riga della colonna.
  const cellLabel = `${row.project_name} — ${row.task_type}${
    row.wbs_item_name ? ` — ${row.wbs_item_name}` : ''
  }, settimana del ${weekStart}`;

  const commit = () => {
    if (draft == null) return;
    const hours = parseHours(draft);
    if (hours == null) {
      setDraft(null);
      setLocalError(INVALID_HOURS_MESSAGE);
      return;
    }
    setDraft(null);
    setLocalError(null);
    if (hours === state.loggedHours) return;
    onCommit(row, weekStart, hours);
  };

  const tone = saveState === 'error'
    ? 'bg-destructive/10'
    : state.isOver
      ? 'bg-warning/10'
      : '';

  const alertMessage = localError ?? (saveState === 'error' ? errorMessage : null);

  return (
    <div
      className={`group relative w-full ${cellHeight} ${tone}`}
      data-cell-row={rowIndex}
      data-cell-col={colIndex}
      onDoubleClick={() => { setDraft(null); onOpenDetail(row, weekStart); }}
    >
      {editing ? (
        <input
          autoFocus
          aria-label={`Modifica ore di ${cellLabel}`}
          className="h-6 w-full bg-transparent px-2 py-1 text-sm tabular-nums outline-none"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={event => {
            // blur() committa: un commit() diretto doppierebbe il salvataggio, perche' il focus
            // sulla cella sotto rilancia onBlur con la bozza ancora impostata.
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); onNavigate('Enter'); }
            if (event.key === 'Escape') { event.preventDefault(); setDraft(null); }
          }}
          onFocus={event => event.target.select()}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setLocalError(null); setDraft(formatHours(state.loggedHours)); }}
          onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              onNavigate(event.key);
            }
          }}
          aria-label={`Modifica ore di ${cellLabel}`}
          className="h-full w-full px-2 py-1 text-left text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className={
            state.kind === 'empty' || state.kind === 'planned'
              ? 'text-muted-foreground'
              : state.isOver ? 'text-warning' : 'text-primary'
          }>
            {state.kind === 'empty' && '—'}
            {state.kind === 'planned' && `0h / ${formatHours(state.plannedHours)}h`}
            {state.kind === 'extra' && `${formatHours(state.loggedHours)}h`}
            {state.kind === 'logged' && `${formatHours(state.loggedHours)}h / ${formatHours(state.plannedHours)}h`}
          </span>
        </button>
      )}

      {!editing && (
        <button
          type="button"
          onClick={() => onOpenDetail(row, weekStart)}
          aria-label={`Apri dettaglio di ${cellLabel}`}
          className="absolute left-1 top-1 rounded text-[10px] leading-none text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-60"
        >
          ⋯
        </button>
      )}

      {state.hasNote && !editing && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-muted-foreground"
              aria-label="Contiene una nota" />
      )}
      {saveState === 'saving' && (
        <span className="absolute bottom-1 right-1 text-xs text-muted-foreground" role="status">…</span>
      )}
      {alertMessage && (
        <span className="absolute bottom-1 left-1 right-1 truncate text-xs text-destructive" role="alert">
          {alertMessage}
        </span>
      )}
    </div>
  );
}
