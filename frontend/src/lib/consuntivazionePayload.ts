import { hoursToDays } from './units.ts';

/**
 * Costruzione del payload per `upsertTimeEntry`. Funzione pura, separata
 * dalla pagina per poterla testare con `node --test` — la conversione
 * ore→giorni in scrittura è il punto più rischioso della griglia (una doppia
 * conversione o una conversione mancante produce numeri plausibili ma
 * sbagliati), quindi va oltre `hoursToDays` fatta una volta sola qui, non
 * ripetuta nei tre punti di chiamata.
 *
 * `upsertTimeEntry` è un upsert completo: chi chiama deve continuare a
 * passare le ore correnti quando salva solo la nota, altrimenti le ore
 * vengono rimandate indietro azzerate. `personId` deve continuare a venire
 * da `AuthContext`, mai dall'URL — questa funzione si limita a riportarlo
 * nel payload cosi' com'e', senza leggerlo da nessuna altra fonte.
 */

export interface TimeEntryPayloadInput {
  personId: number;
  taskId: number;
  weekStart: string;
  hours: number;
  wbsItemId?: number | null;
  notes?: string | null;
}

export interface TimeEntryPayload {
  person_id: number;
  task_id: number;
  week_start: string;
  man_days: number;
  wbs_item_id?: number;
  notes?: string;
}

export function buildTimeEntryPayload(input: TimeEntryPayloadInput): TimeEntryPayload {
  return {
    person_id: input.personId,
    task_id: input.taskId,
    week_start: input.weekStart,
    man_days: hoursToDays(input.hours),
    ...(input.wbsItemId != null ? { wbs_item_id: input.wbsItemId } : {}),
    ...(input.notes != null ? { notes: input.notes } : {}),
  };
}
