import { useState } from 'react';
import { Stack } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SectionCard } from '@/components/app/SectionCard';
import {
  EMPTY_DISABLE_DRAFT, isPhaseless, toDisablePayload, validateDisableDraft,
  type DisableDraft, type DisableErrors,
} from '@/lib/phasesMode';
import { hasErrors, type TaskFormErrors, type TaskFormState } from '@/lib/projectConfigModel';
import type { BillingType, Person, Project, SetPhasesRequest, TaskAllocation } from '../../types';
import { NONE } from './CatalogSelect';
import { PhaselessEditor } from './PhaselessEditor';
import type { TaskField } from './TasksSection';

interface PhasesSectionProps {
  project: Project;
  billingType: BillingType;
  persons: Person[];
  genForm: TaskFormState;
  genErrors: TaskFormErrors;
  failedField: string | null;
  onChangeGen: (patch: Partial<TaskFormState>) => void;
  onCommitGen: (field: TaskField) => void;
  onAddPerson: (personId: number, days: number) => Promise<boolean>;
  /** null = ok; stringa = messaggio d'errore da mostrare nel dialog di cambio persona. */
  onChangePerson: (personId: number, days: number) => Promise<string | null>;
  onRemoveAllocation: (allocation: TaskAllocation) => void;
  /** null = ok; stringa = messaggio d'errore da mostrare nel dialog. */
  onSetPhases: (request: SetPhasesRequest) => Promise<string | null>;
}

type OpenDialog = 'disable' | 'enable' | 'replace' | null;

/** Cambio persona in attesa di conferma; `settle` sblocca l'editor (true = cambio avvenuto). */
interface PendingReplacement { personId: number; days: number; settle: (replaced: boolean) => void }

export function PhasesSection(props: PhasesSectionProps) {
  const { project, persons, onSetPhases } = props;
  const phaseless = isPhaseless(project);
  const basket = !!project.scala_da_basket;
  const allocations = project.tasks?.find(task => task.task_type === 'GEN')?.allocations ?? [];
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [draft, setDraft] = useState<DisableDraft>(EMPTY_DISABLE_DRAFT);
  const [draftErrors, setDraftErrors] = useState<DisableErrors>({});
  const [replacement, setReplacement] = useState<PendingReplacement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // settle(false) è no-op se la promise è già risolta (dopo settle(true) nella conferma).
  const close = () => {
    replacement?.settle(false);
    setDialog(null); setDialogError(null); setDraftErrors({}); setReplacement(null);
  };

  const run = async (request: SetPhasesRequest) => {
    setBusy(true);
    const message = await onSetPhases(request);
    setBusy(false);
    if (message) setDialogError(message);
    else { close(); setDraft(EMPTY_DISABLE_DRAFT); }
  };

  const confirmDisable = () => {
    const errors = validateDisableDraft(draft);
    setDraftErrors(errors);
    if (!hasErrors(errors)) void run(toDisablePayload(draft));
  };

  const confirmReplace = async () => {
    if (!replacement) return;
    setBusy(true);
    const message = await props.onChangePerson(replacement.personId, replacement.days);
    setBusy(false);
    if (message) { setDialogError(message); return; }
    replacement.settle(true);
    close();
  };

  /** Apre il dialog di cambio persona; risolve true solo dopo la conferma riuscita, false se annullato. */
  const requestReplace = (personId: number, days: number) => new Promise<boolean>(settle => {
    setDialogError(null);
    setReplacement({ personId, days, settle });
    setDialog('replace');
  });

  return (
    <SectionCard
      title="Fasi"
      description={basket
        ? 'Il progetto scala dal basket: non ha fasi né stima, il riferimento è il basket.'
        : phaseless
        ? 'Il progetto non è diviso per fasi: le persone assegnate coprono implicitamente tutte le fasi.'
        : 'Disattiva le fasi per assegnare il progetto a una persona senza dividerlo in AF/AT/DEV/SIT/UAT.'}
      icon={<Stack aria-hidden="true" />}
    >
      <div className="flex items-center gap-3">
        <Switch
          id="uses-phases"
          checked={!phaseless}
          disabled={busy || basket}
          onCheckedChange={checked => { setDialogError(null); setDialog(checked ? 'enable' : 'disable'); }}
        />
        <label htmlFor="uses-phases" className="cursor-pointer font-medium text-foreground">Gestisci per fasi</label>
      </div>

      {phaseless && (
        <div className="mt-4 border-t border-border pt-4">
          <PhaselessEditor
            billingType={props.billingType}
            persons={persons}
            allocations={allocations}
            form={props.genForm}
            errors={props.genErrors}
            failedField={props.failedField}
            onChange={props.onChangeGen}
            onCommit={props.onCommitGen}
            onAddPerson={props.onAddPerson}
            onChangePerson={requestReplace}
            onRemoveAllocation={props.onRemoveAllocation}
            noEstimate={basket}
          />
        </div>
      )}

      <Dialog open={dialog === 'disable'} onOpenChange={open => { if (!open && !busy) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disattivare le fasi?</DialogTitle>
            <DialogDescription>
              Persona, periodo e giorni stimati sono facoltativi e si possono assegnare dopo. I task di fase vuoti verranno eliminati insieme ai loro giorni
              stimati. Se le fasi hanno già allocazioni, consuntivi, dipendenze o WBS l’operazione non è consentita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field hasError={!!draftErrors.person}>
              <FieldLabel>Persona assegnata (facoltativa)</FieldLabel>
              <Select
                value={draft.person_id || NONE}
                onValueChange={value => setDraft({ ...draft, person_id: value === NONE ? '' : value })}
              >
                <SelectTrigger className="w-full" aria-label="Persona assegnata"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nessuna per ora</SelectItem>
                  {persons.map(person => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {draftErrors.person && <FieldHint role="alert">{draftErrors.person}</FieldHint>}
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field hasError={!!draftErrors.plannedStart}>
                <FieldLabel>Data inizio</FieldLabel>
                <Input type="date" value={draft.planned_start} onChange={event => setDraft({ ...draft, planned_start: event.target.value })} />
                {draftErrors.plannedStart && <FieldHint role="alert">{draftErrors.plannedStart}</FieldHint>}
              </Field>
              <Field hasError={!!draftErrors.plannedEnd}>
                <FieldLabel>Data fine</FieldLabel>
                <Input type="date" value={draft.planned_end} onChange={event => setDraft({ ...draft, planned_end: event.target.value })} />
                {draftErrors.plannedEnd && <FieldHint role="alert">{draftErrors.plannedEnd}</FieldHint>}
              </Field>
              <Field hasError={!!draftErrors.estimatedDays}>
                <FieldLabel>Giorni stimati</FieldLabel>
                <Input type="number" min="0" step="0.5" value={draft.estimated_days} onChange={event => setDraft({ ...draft, estimated_days: event.target.value })} />
                {draftErrors.estimatedDays && <FieldHint role="alert">{draftErrors.estimatedDays}</FieldHint>}
              </Field>
            </div>
            {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>Annulla</Button>
            <Button disabled={busy} onClick={confirmDisable}>{busy ? 'Disattivo…' : 'Disattiva le fasi'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'enable'} onOpenChange={open => { if (!open && !busy) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Riattivare le fasi?</DialogTitle>
            <DialogDescription>
              L’assegnazione e la pianificazione attuali (persone, giorni stimati, date) verranno scartate: dovrai
              ricreare le fasi e allocare le persone. Se esistono ore pianificate, consuntivi, WBS o dipendenze l’operazione non è consentita.
            </DialogDescription>
          </DialogHeader>
          {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>Annulla</Button>
            <Button disabled={busy} onClick={() => void run({ uses_phases: true })}>{busy ? 'Riattivo…' : 'Riattiva le fasi'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'replace'} onOpenChange={open => { if (!open && !busy) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiare la persona assegnata?</DialogTitle>
            <DialogDescription>
              La persona attuale verrà rimossa insieme alla sua pianificazione settimanale. I consuntivi già registrati restano.
            </DialogDescription>
          </DialogHeader>
          {dialogError && <p role="alert" className="text-sm text-destructive">{dialogError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>Annulla</Button>
            <Button disabled={busy} onClick={() => void confirmReplace()}>{busy ? 'Cambio…' : 'Cambia persona'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
