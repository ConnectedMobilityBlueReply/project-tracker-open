import { useEffect, useState } from 'react';
import { getAllocationTotals, getProjectTasks, upsertAllocationWeek } from '../../api';
import type { ProjectTask, ScheduleAllocation } from '../../types';
import { allocationCeiling } from '../../lib/scheduleRows';
import { daysToHours, hoursToDays } from '../../lib/units';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

interface Props {
  open: boolean;
  allocation: ScheduleAllocation | null;
  onClose: () => void;
  onSaved: () => void;
}

const INVALID_HOURS_MESSAGE = 'Inserire un numero di ore maggiore o uguale a zero';

/**
 * Modifica delle ore e del flag provvisorio di un'allocazione esistente. La
 * creazione parte dalla cella vuota e passa da AssignModal, che sa scegliere
 * progetto e attività.
 */
export default function AllocationModal({ open, allocation, onClose, onSaved }: Props) {
  const [hours, setHours] = useState('');
  const [tentative, setTentative] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [totals, setTotals] = useState<Record<number, number>>({});

  const reset = (next: ScheduleAllocation | null) => {
    setHours(next ? String(daysToHours(next.man_days)).replace('.', ',') : '');
    setTentative(next?.tentative ?? false);
    setError(null);
  };

  /**
   * Riallinea i campi a ogni apertura. La chiave porta dentro `open` e non solo
   * l'id: con il solo id, chiudere e riaprire la stessa card lascia la chiave
   * invariata, il blocco non riparte e la modale ripropone il valore digitato e
   * annullato — mostrandolo come se fosse quello salvato.
   */
  const [lastKey, setLastKey] = useState<string | null>(null);
  const currentId = allocation?.id ?? null;
  const openKey = open ? String(currentId) : null;
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (open) reset(allocation);
  }

  // Il tetto della stima vive nel progetto, non nell'allocazione settimanale:
  // due letture all'apertura della modale, non nel percorso caldo della griglia.
  useEffect(() => {
    if (!open || !allocation) return;
    void Promise.all([
      getProjectTasks(allocation.project_id),
      getAllocationTotals(allocation.project_id),
    ])
      .then(([loadedTasks, loadedTotals]) => {
        setTasks(loadedTasks);
        setTotals(Object.fromEntries(loadedTotals.map(t => [t.task_allocation_id, t.total_days])));
      })
      .catch(() => { setTasks([]); setTotals({}); });
  }, [open, allocation]);

  const ceiling = allocation ? allocationCeiling(tasks, totals, allocation.task_allocation_id) : null;
  const enteredHours = Number(hours.trim().replace(',', '.'));
  // Il totale già include la settimana in modifica: si sostituisce, non si somma.
  const projectedDays = ceiling && Number.isFinite(enteredHours)
    ? ceiling.allocatedDays - allocation!.man_days + hoursToDays(enteredHours)
    : (ceiling?.allocatedDays ?? 0);
  const isOverEstimate = ceiling != null
    && ceiling.estimatedDays > 0
    && projectedDays > ceiling.estimatedDays;

  const save = async () => {
    if (!allocation) return;
    const raw = hours.trim();
    const parsed = Number(raw.replace(',', '.'));
    if (raw === '' || !Number.isFinite(parsed) || parsed < 0) {
      setError(INVALID_HOURS_MESSAGE);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await upsertAllocationWeek({
        task_allocation_id: allocation.task_allocation_id,
        week_start: allocation.week_start,
        man_days: hoursToDays(parsed),
        tentative,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Salvataggio non riuscito');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {allocation ? allocation.project_name : 'Allocazione'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Settimana del {allocation?.week_start}
          </p>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Ore</span>
            <Input
              value={hours}
              onChange={event => setHours(event.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
            <span className="text-xs text-muted-foreground">
              Zero cancella l’allocazione della settimana.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tentative}
              onChange={event => setTentative(event.target.checked)}
            />
            Provvisoria
          </label>

          {ceiling && (
            <p className={`text-sm ${isOverEstimate ? 'text-warning' : 'text-muted-foreground'}`}>
              assegnato {daysToHours(projectedDays)}h / stimato {daysToHours(ceiling.estimatedDays)}h
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} disabled={saving || !allocation}>
            {saving ? 'Salvataggio…' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
