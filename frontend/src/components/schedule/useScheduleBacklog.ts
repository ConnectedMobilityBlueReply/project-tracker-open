import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { getScheduleBacklog, upsertAllocationWeek } from '../../api';
import type { BacklogItem, ScheduleData } from '../../types';
import type { ScheduleRowModel } from '../../lib/scheduleRows';
import { applyAssignment, applyToBacklog, freeDays, planAssignment } from '../../lib/scheduleBacklog';
import { newPlaceholderId } from './useScheduleData';

const BACKLOG_KEY = 'schedule.backlog';

// Lo storage può essere bloccato (policy aziendale, cookie disabilitati): in quel caso il pannello resta chiuso e lo stato vive in memoria.
function readBacklogOpen(): boolean {
  try {
    return localStorage.getItem(BACKLOG_KEY) === 'open';
  } catch {
    return false;
  }
}

function writeBacklogOpen(next: boolean): void {
  try {
    localStorage.setItem(BACKLOG_KEY, next ? 'open' : 'closed');
  } catch {
    // Preferenza non persistita: vale per la sessione corrente.
  }
}

interface ScheduleContext {
  data: ScheduleData | null;
  setData: (next: ScheduleData) => void;
  reloadSchedule: () => Promise<void>;
  setRowErrors: Dispatch<SetStateAction<Record<string, string>>>;
}

/**
 * Backlog "Da assegnare": elenco, selezione e assegnazione a una settimana.
 * Ottimistico come moveAllocation/extendAllocation: griglia e backlog si
 * aggiornano subito; un fallimento ripristina entrambi e scrive l'errore
 * sulla riga della persona (stesso `rowErrors`).
 */
export function useScheduleBacklog(enabled: boolean, schedule: ScheduleContext) {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Falso fino al primo caricamento concluso: senza, il pannello mostrerebbe "· 0" e "Niente da assegnare." a vuoto.
  const [loaded, setLoaded] = useState(!enabled);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpenState] = useState(readBacklogOpen);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Un'assegnazione alla volta: `man_days` è assoluto, calcolato su stato ottimistico che il server non ha ancora confermato.
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const reload = useCallback((): Promise<void> => {
    if (!enabled) return Promise.resolve();
    setLoading(true);
    setLoadError(null);
    return getScheduleBacklog()
      .then(next => {
        setItems(next);
        // Se l'item è sparito (residuo 0, o assegnato da altra scheda) la selezione non deve riattivarsi quando ricompare.
        setSelectedId(current => (next.some(entry => entry.task_allocation_id === current) ? current : null));
      })
      .catch((err: Error) => setLoadError(err.message || 'Caricamento non riuscito'))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [enabled]);

  useEffect(() => { void reload(); }, [reload]);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    writeBacklogOpen(next);
    if (!next) setSelectedId(null);
  };

  const selected = items.find(entry => entry.task_allocation_id === selectedId) ?? null;

  const assign = async (row: ScheduleRowModel, week: string) => {
    if (inFlight.current) return;
    const { data } = schedule;
    if (!data || !selected) return;
    const free = freeDays(row.person, week, data.allocations, data.time_off, data.other_team_load ?? []);
    const plan = planAssignment(selected, week, data.allocations, free);
    if (!plan) return;

    const previousData = data;
    const previousItems = items;
    schedule.setData({
      ...data,
      allocations: applyAssignment(data.allocations, selected, week, plan, newPlaceholderId()),
    });
    setItems(applyToBacklog(items, selected.task_allocation_id, plan.addedDays));
    schedule.setRowErrors(current => {
      const next = { ...current };
      delete next[row.key];
      return next;
    });

    inFlight.current = true;
    setPending(true);
    try {
      await upsertAllocationWeek({
        task_allocation_id: selected.task_allocation_id,
        week_start: week,
        man_days: plan.manDays,
      });
      await Promise.all([schedule.reloadSchedule(), reload()]);
    } catch (err) {
      schedule.setData(previousData);
      setItems(previousItems);
      schedule.setRowErrors(current => ({
        ...current,
        [row.key]: (err as Error).message || 'Assegnazione non riuscita',
      }));
      // Un fallimento a metà lascia il server in uno stato che il rollback non descrive: la verità la porta il ricaricamento.
      await Promise.all([schedule.reloadSchedule(), reload()]);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return {
    items, loading, loaded, loadError, open, setOpen, selected, select: setSelectedId, assign, pending, reload,
  };
}
