import { X } from '@phosphor-icons/react';
import type { BacklogItem } from '../../types';
import type { AssignmentHint } from '../../lib/scheduleBacklog';
import { projectColor } from '../../lib/scheduleModel';
import { Button } from '../ui/button';

interface Props {
  items: BacklogItem[];
  loading: boolean;
  error: string | null;
  selectedId: number | null;
  hint: AssignmentHint | null;
  onSelect: (id: number | null) => void;
  onRetry: () => void;
  onClose: () => void;
}

const days = (value: number) => value.toLocaleString('it-IT');

function hintText(hint: AssignmentHint, item: BacklogItem): string {
  switch (hint) {
    case 'months': return 'Passa alla scala Settimane per assegnare.';
    case 'person-hidden': return `${item.person_name} è nascosta dai filtri attivi: toglili per assegnare.`;
    case 'row-collapsed': return `Espandi la riga di ${item.person_name} per assegnare.`;
    case 'no-free-week': return 'Nessuna settimana libera nel periodo visibile: sposta il periodo.';
    case 'ready': return `Clicca “+N g” su una settimana libera di ${item.person_name}. Esc per annullare.`;
  }
}

export default function BacklogPanel({ items, loading, error, selectedId, hint, onSelect, onRetry, onClose }: Props) {
  const selected = items.find(entry => entry.task_allocation_id === selectedId) ?? null;
  const message = selected && hint ? hintText(hint, selected) : null;

  return (
    <aside className="w-64 shrink-0 space-y-2 rounded-card border border-border bg-card p-3 shadow-xs" aria-label="Da assegnare">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Da assegnare</h2>
        <Button variant="ghost" iconOnly aria-label="Chiudi il pannello" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div role="alert" className="space-y-1 text-xs text-destructive">
          <p>Caricamento non riuscito: {error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>Riprova</Button>
        </div>
      )}

      {!error && loading && items.length === 0 && (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      )}

      {!error && !loading && items.length === 0 && (
        <p className="text-xs text-muted-foreground">Niente da assegnare.</p>
      )}

      {/* Sempre montata: le live region annunciano i cambi di contenuto solo se l'elemento esiste già. */}
      <p role="status" aria-live="polite" className={message ? 'rounded-sm bg-accent px-2 py-1 text-xs' : 'text-xs'}>
        {message}
      </p>

      <ul className="space-y-1">
        {items.map(item => {
          const isSelected = item.task_allocation_id === selectedId;
          return (
            <li key={item.task_allocation_id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(isSelected ? null : item.task_allocation_id)}
                className={`w-full space-y-0.5 rounded-sm border px-2 py-1.5 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
                  isSelected ? 'border-primary bg-accent' : 'border-border hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: projectColor(item.project_id, item.project_color) }}
                  />
                  <span className="truncate font-medium">{item.project_name}</span>
                </span>
                <span className="block truncate text-muted-foreground">{item.task_type} · {item.person_name}</span>
                <span className="block tabular-nums">
                  {days(item.remaining_days)} g da assegnare di {days(item.estimated_days)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
