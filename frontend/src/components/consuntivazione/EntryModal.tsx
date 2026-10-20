import { useState } from 'react';
import type { RangeRow } from '../../types';
import { cellState, formatHours, parseHours } from '../../lib/consuntivazioneGrid';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

interface Props {
  open: boolean;
  row: RangeRow | null;
  weekStart: string | null;
  onClose: () => void;
  onSave: (row: RangeRow, weekStart: string, hours: number, notes: string) => Promise<void>;
  onDelete: (entryId: number) => Promise<void>;
}

const INVALID_HOURS_MESSAGE = 'Inserire un numero di ore maggiore o uguale a zero';

export default function EntryModal({ open, row, weekStart, onClose, onSave, onDelete }: Props) {
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // L'eliminazione è irreversibile: un secondo passaggio esplicito, come nelle
  // schermate di configurazione progetto (es. ProgettoDettaglio, AdminPersone),
  // invece di cancellare al primo click sul pulsante Elimina.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Riallinea i campi a ogni apertura. La chiave porta dentro `open` e non solo
  // la cella: senza, chiudere e riaprire la stessa cella lascerebbe la chiave
  // invariata e la modale riproporrebbe il valore digitato e annullato.
  const [lastKey, setLastKey] = useState<string | null>(null);
  const openKey = open && row && weekStart ? `${row.key}-${weekStart}` : null;
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (open && row && weekStart) {
      const state = cellState(row, weekStart);
      setHours(formatHours(state.loggedHours));
      setNotes(state.notes ?? '');
      setError(null);
      setConfirmingDelete(false);
    }
  }

  const state = row && weekStart ? cellState(row, weekStart) : null;

  const save = async () => {
    if (!row || !weekStart) return;
    const parsed = parseHours(hours);
    if (parsed == null) { setError(INVALID_HOURS_MESSAGE); return; }
    setSaving(true);
    try {
      await onSave(row, weekStart, parsed, notes);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Salvataggio non riuscito');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (state?.entryId == null) return;
    setSaving(true);
    try {
      await onDelete(state.entryId);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Eliminazione non riuscita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Dettaglio consuntivazione</DialogTitle>
          </DialogHeader>
          {row && weekStart && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {row.project_name} — {row.task_type}
                {row.wbs_item_name ? ` — ${row.wbs_item_name}` : ''} — settimana del {weekStart}
              </p>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="entry-hours">Ore</label>
                <Input id="entry-hours" value={hours} onChange={e => setHours(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="entry-notes">Note</label>
                <Input id="entry-notes" value={notes} onChange={e => setNotes(e.target.value)}
                       placeholder="Opzionale…" />
              </div>
              {error && !confirmingDelete && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>
          )}
          <DialogFooter>
            {state?.entryId != null && (
              <Button type="button" variant="outline" onClick={() => setConfirmingDelete(true)} disabled={saving}>
                Elimina
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
            <Button type="button" onClick={save} disabled={saving}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingDelete} onOpenChange={next => { if (!next && !saving) setConfirmingDelete(false); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Elimina consuntivazione</DialogTitle>
          </DialogHeader>
          {row && weekStart && (
            <p className="text-sm text-muted-foreground">
              Stai per eliminare le ore consuntivate per {row.project_name} — {row.task_type}
              {row.wbs_item_name ? ` — ${row.wbs_item_name}` : ''} nella settimana del {weekStart}.
              L'operazione non è reversibile.
            </p>
          )}
          {error && confirmingDelete && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={saving}>
              Annulla
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={saving}>
              {saving ? 'Eliminazione…' : 'Elimina'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
