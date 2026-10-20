/**
 * Coda di autosave per la configurazione progetti.
 * Funzione pura senza React, separata dalla pagina per poterla testare con `node --test`.
 *
 * Regole:
 * - una sola richiesta in volo: le PUT sono a sostituzione completa, due richieste
 *   concorrenti potrebbero arrivare in ordine inverso e far vincere lo snapshot vecchio;
 * - per ogni `key` (risorsa: progetto, singolo task) resta in attesa solo l'ultimo job;
 * - un job fallito resta in coda: viene riprovato con `retry()` o alla prossima `push()`,
 *   ma non blocca le altre chiavi (un PUT su un task eliminato non ferma il progetto).
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveState {
  status: SaveStatus;
  savedAt: Date | null;
  failedKey: string | null;
  /** Ultimo campo modificato sulla risorsa fallita: la UI lo evidenzia. */
  failedField: string | null;
  error: string | null;
}

export interface SaveJob {
  key: string;
  field?: string;
  run: () => Promise<unknown>;
}

export interface AutosaveQueue {
  push(job: SaveJob): void;
  retry(): void;
  /** Si risolve quando la coda è ferma (salvata o in errore). */
  flush(): Promise<void>;
  /** Scarta job in attesa ed errore, ad esempio quando l'utente abbandona le modifiche. */
  discard(): void;
  /** Toglie una sola risorsa dalla coda, ad esempio un task appena eliminato. */
  drop(key: string): void;
  hasUnsaved(): boolean;
}

export const INITIAL_SAVE_STATE: SaveState = {
  status: 'idle', savedAt: null, failedKey: null, failedField: null, error: null,
};

const errorMessage = (err: unknown): string =>
  err instanceof Error && err.message ? err.message : 'Errore di salvataggio';

export function createAutosaveQueue(
  onChange: (state: SaveState) => void,
  now: () => Date = () => new Date(),
): AutosaveQueue {
  const pending = new Map<string, SaveJob>();
  let running: Promise<void> | null = null;
  let state: SaveState = INITIAL_SAVE_STATE;

  const emit = (patch: Partial<SaveState>) => {
    state = { ...state, ...patch };
    onChange(state);
  };

  const drain = async () => {
    // Ogni chiave fallita viene saltata per il resto del giro: le altre vanno comunque salvate.
    const failedThisRound = new Set<string>();
    let failure: Pick<SaveState, 'failedKey' | 'failedField' | 'error'> | null = null;
    for (;;) {
      const next = [...pending.entries()].find(([key]) => !failedThisRound.has(key));
      if (!next) break;
      const [key, job] = next;
      emit({ status: 'saving' });
      try {
        await job.run();
        // Rimuove solo se nel frattempo non è arrivato uno snapshot più recente.
        if (pending.get(key) === job) pending.delete(key);
      } catch (err) {
        // Superato da uno snapshot più recente: si prova subito quello.
        if (pending.get(key) !== job) continue;
        failedThisRound.add(key);
        failure = { failedKey: key, failedField: job.field ?? null, error: errorMessage(err) };
      }
    }
    if (failure) emit({ status: 'error', ...failure });
    else emit({ status: 'saved', savedAt: now(), failedKey: null, failedField: null, error: null });
  };

  const start = () => {
    if (running) return;
    running = drain().finally(() => { running = null; });
  };

  return {
    push(job) {
      pending.delete(job.key);
      pending.set(job.key, job);
      start();
    },
    retry() {
      if (pending.size > 0) start();
    },
    flush() {
      return running ?? Promise.resolve();
    },
    discard() {
      pending.clear();
      emit(INITIAL_SAVE_STATE);
    },
    drop(key) {
      pending.delete(key);
      if (state.failedKey === key) emit(INITIAL_SAVE_STATE);
    },
    hasUnsaved() {
      return pending.size > 0 || running !== null;
    },
  };
}
