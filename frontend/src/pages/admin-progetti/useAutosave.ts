import { useEffect, useMemo, useRef, useState } from 'react';
import { createAutosaveQueue, INITIAL_SAVE_STATE, type AutosaveQueue, type SaveState } from '@/lib/autosaveQueue';

// Coda della pagina montata (al massimo una): il cambio team deve poterla svuotare prima di
// cambiare l'header X-Team-Id, altrimenti i job in attesa partirebbero sul team sbagliato.
let mounted: { queue: AutosaveQueue; hasLocalChanges: () => boolean } | null = null;

/** Salva ciò che è in coda; true se non resta nulla di non salvato (nessuna pagina = true). */
export async function settleAutosave(): Promise<boolean> {
  if (!mounted) return true;
  await mounted.queue.flush();
  return !mounted.queue.hasUnsaved() && !mounted.hasLocalChanges();
}

/**
 * Collega la coda di autosave a React e avvisa il browser se si chiude la pagina con
 * salvataggi in corso o falliti. `hasLocalChanges` copre ciò che non è in coda
 * (campi non validi, valori digitati ma non ancora usciti dal focus).
 */
export function useAutosave(hasLocalChanges: () => boolean) {
  const [state, setState] = useState<SaveState>(INITIAL_SAVE_STATE);
  const queue = useMemo(() => createAutosaveQueue(setState), []);
  const hasLocalChangesRef = useRef(hasLocalChanges);
  hasLocalChangesRef.current = hasLocalChanges;

  useEffect(() => {
    const entry = { queue, hasLocalChanges: () => hasLocalChangesRef.current() };
    mounted = entry;
    return () => { if (mounted === entry) mounted = null; };
  }, [queue]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.hasUnsaved() || hasLocalChangesRef.current()) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [queue]);

  return { state, queue };
}
