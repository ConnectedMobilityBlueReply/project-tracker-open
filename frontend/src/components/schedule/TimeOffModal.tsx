import { useState } from 'react';
import { createTimeOff, deleteTimeOff, updateTimeOff } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { isPureManager } from '../../auth/activeTeam';
import type { SchedulePerson, TimeOffEntry, TimeOffType } from '../../types';
import { TIME_OFF_TYPES } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

interface Props {
  open: boolean;
  entry: TimeOffEntry | null;
  defaultPersonId: number | null;
  persons: SchedulePerson[];
  onClose: () => void;
  onSaved: () => void;
}

export default function TimeOffModal({
  open, entry, defaultPersonId, persons, onClose, onSaved,
}: Props) {
  const { account } = useAuth();
  // Il backend rifiuta la riassegnazione di un'assenza esistente da parte del manager puro (400).
  const personLocked = entry != null && account != null && isPureManager(account);
  const [personId, setPersonId] = useState<number>(
    entry?.person_id ?? defaultPersonId ?? persons[0]?.id ?? 0);
  const [startDate, setStartDate] = useState(entry?.start_date ?? '');
  const [endDate, setEndDate] = useState(entry?.end_date ?? '');
  const [type, setType] = useState<TimeOffType>(entry?.type ?? 'ferie');
  const [tentative, setTentative] = useState(entry?.tentative ?? false);
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Riallinea i campi a ogni apertura. La chiave porta dentro `open` e non solo
   * l'id: con il solo id, chiudere e riaprire lo stesso modulo lascia la chiave
   * invariata, il blocco non riparte e la modale ripropone i valori digitati e
   * annullati — e, alla prima apertura, un `personId` calcolato quando l'elenco
   * delle persone era ancora vuoto.
   */
  const [lastKey, setLastKey] = useState<string | null>(null);
  const openKey = open ? String(entry?.id ?? null) : null;
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (open) {
      setPersonId(entry?.person_id ?? defaultPersonId ?? persons[0]?.id ?? 0);
      setStartDate(entry?.start_date ?? '');
      setEndDate(entry?.end_date ?? '');
      setType(entry?.type ?? 'ferie');
      setTentative(entry?.tentative ?? false);
      setNotes(entry?.notes ?? '');
      setError(null);
    }
  }

  const save = async () => {
    if (!startDate || !endDate) {
      setError('Indicare data di inizio e di fine');
      return;
    }
    if (endDate < startDate) {
      setError('La data di fine non può precedere quella di inizio');
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      person_id: personId,
      start_date: startDate,
      end_date: endDate,
      type,
      tentative,
      notes: notes.trim() === '' ? null : notes.trim(),
    };
    try {
      if (entry) {
        await updateTimeOff(entry.id, payload);
      } else {
        await createTimeOff(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Salvataggio non riuscito');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await deleteTimeOff(entry.id);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Cancellazione non riuscita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{entry ? 'Modifica assenza' : 'Nuova assenza'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Persona</span>
            <select
              value={personId}
              disabled={personLocked}
              onChange={event => setPersonId(Number(event.target.value))}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {persons.map(person => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Dal</span>
              <Input
                type="date"
                value={startDate}
                onChange={event => setStartDate(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Al</span>
              <Input
                type="date"
                value={endDate}
                onChange={event => setEndDate(event.target.value)}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Tipo</span>
            <select
              value={type}
              onChange={event => setType(event.target.value as TimeOffType)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              {TIME_OFF_TYPES.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tentative}
              onChange={event => setTentative(event.target.checked)}
            />
            Provvisoria
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Note</span>
            <Input value={notes} onChange={event => setNotes(event.target.value)} />
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          {entry && (
            <Button variant="destructive" onClick={remove} disabled={saving}>Elimina</Button>
          )}
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvataggio…' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
