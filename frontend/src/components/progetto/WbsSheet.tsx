import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  EMPTY_WBS_FORM, toWbsPayload, validateWbsForm, wbsToForm,
  type WbsField, type WbsFieldErrors, type WbsFormState,
} from '@/lib/wbsForm';
import { formatWbsDateName, parseWbsDateList } from '../../lib/wbsDateList';
import { createWbsItem, updateWbsItem } from '../../api';
import { TASK_LABELS, WBS_STATUS_LABELS, WBS_STATUS_OPTIONS, type ProjectTask, type TaskType, type WbsItem, type WbsStatus } from '../../types';

const NO_ASSIGNEE = '__none__';

export type WbsSheetMode =
  | { kind: 'add' }
  | { kind: 'edit'; item: WbsItem }
  | { kind: 'dates' };

interface Person { id: number; name: string }

interface WbsSheetProps {
  open: boolean;
  mode: WbsSheetMode;
  tasks: readonly ProjectTask[];
  persons: readonly Person[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

const taskLabel = (task: ProjectTask) => TASK_LABELS[task.task_type as TaskType] || task.task_type;

function TaskSelect({ tasks, value, onChange }: { tasks: readonly ProjectTask[]; value: number | null; onChange: (id: number) => void }) {
  return (
    <Select value={value === null ? '' : String(value)} onValueChange={next => onChange(Number(next))}>
      <SelectTrigger><SelectValue placeholder="Seleziona task" /></SelectTrigger>
      <SelectContent>{tasks.map(task => <SelectItem key={task.id} value={String(task.id)}>{taskLabel(task)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function ComponentForm({ mode, tasks, persons, inFlight, onClose, onSaved }: {
  mode: Exclude<WbsSheetMode, { kind: 'dates' }>;
  tasks: readonly ProjectTask[];
  persons: readonly Person[];
  inFlight: MutableRefObject<boolean>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const editing = mode.kind === 'edit';
  const [form, setForm] = useState<WbsFormState>(() => (mode.kind === 'edit' ? wbsToForm(mode.item) : EMPTY_WBS_FORM));
  const [taskId, setTaskId] = useState<number | null>(tasks[0]?.id ?? null);
  const [errors, setErrors] = useState<WbsFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setField = <K extends keyof WbsFormState>(field: K, value: WbsFormState[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validateWbsForm(form, { editing, taskId });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (mode.kind === 'edit') await updateWbsItem(mode.item.id, toWbsPayload(form, null));
      else await createWbsItem(toWbsPayload(form, taskId));
      await onSaved();
      onClose();
    } catch {
      setSaveError('Errore nel salvataggio del componente WBS');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const field = (name: WbsField, label: string, control: React.ReactNode) => (
    <Field hasError={!!errors[name]}>
      <FieldLabel>{label}</FieldLabel>
      {control}
      {errors[name] && <FieldHint role="alert">{errors[name]}</FieldHint>}
    </Field>
  );

  return (
    <form onSubmit={event => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col" noValidate>
      <SheetBody className="space-y-4">
        {!editing && field('task', 'Task *', <TaskSelect tasks={tasks} value={taskId} onChange={id => { setTaskId(id); setErrors(current => ({ ...current, task: undefined })); }} />)}
        {field('name', 'Nome componente *', <Input autoFocus={!editing} value={form.name} onChange={event => setField('name', event.target.value)} />)}
        {field('estimated_days', 'Giorni stimati *', <Input type="number" min="0" step="0.5" value={form.estimated_days} onChange={event => setField('estimated_days', event.target.value)} />)}
        {field('assignee_person_id', 'Assegnato a', (
          <Select value={form.assignee_person_id || NO_ASSIGNEE} onValueChange={value => setField('assignee_person_id', value === NO_ASSIGNEE ? '' : value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ASSIGNEE}>— nessuno —</SelectItem>
              {persons.map(person => <SelectItem key={person.id} value={String(person.id)}>{person.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        {field('status', 'Stato', (
          <Select value={form.status} onValueChange={value => setField('status', value as WbsStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{WBS_STATUS_OPTIONS.map(status => <SelectItem key={status} value={status}>{WBS_STATUS_LABELS[status]}</SelectItem>)}</SelectContent>
          </Select>
        ))}
        {field('completion_pct', 'Completamento (%) *', <Input type="number" min="0" max="100" value={form.completion_pct} onChange={event => setField('completion_pct', event.target.value)} />)}
        <div className="grid grid-cols-2 gap-3">
          {field('planned_start', 'Data inizio', <Input type="date" value={form.planned_start} onChange={event => setField('planned_start', event.target.value)} />)}
          {field('planned_end', 'Data fine', <Input type="date" value={form.planned_end} onChange={event => setField('planned_end', event.target.value)} />)}
        </div>
        {field('description', 'Descrizione', <Textarea rows={3} value={form.description} onChange={event => setField('description', event.target.value)} />)}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva'}</Button>
      </SheetFooter>
    </form>
  );
}

function DateListForm({ tasks, inFlight, onClose, onSaved }: { tasks: readonly ProjectTask[]; inFlight: MutableRefObject<boolean>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [dateList, setDateList] = useState('');
  const [taskId, setTaskId] = useState<number | null>(tasks[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const parsed = useMemo(() => parseWbsDateList(dateList), [dateList]);
  const valid = parsed.filter(item => item.valid && item.date !== null);

  const handleCreate = async () => {
    if (taskId === null || valid.length === 0 || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      for (const item of valid) {
        const date = item.date as string;
        await createWbsItem({
          task_id: taskId,
          name: `Attività ${formatWbsDateName(date)}`,
          estimated_days: 0,
          completion_pct: 0,
          status: 'aperto',
          planned_start: date,
          planned_end: date,
          assignee_person_id: null,
        });
      }
      await onSaved();
      onClose();
    } catch {
      setSaveError('Errore nella creazione delle attività WBS dall’elenco date');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-4">
        <p className="text-xs text-muted-foreground">Inserisci una data per riga. Sono accettati i formati dd/MM/yyyy e yyyy-MM-dd.</p>
        <Textarea
          autoFocus
          rows={6}
          value={dateList}
          onChange={event => setDateList(event.target.value)}
          placeholder={'- 15/09/2026\n* 2026-09-16\n• 31/09/2026'}
          aria-label="Elenco date per attività WBS"
        />
        {parsed.length > 0 && (
          <div className="space-y-1" aria-live="polite">
            <p className="text-xs font-medium text-muted-foreground">Anteprima ({valid.length} valide, {parsed.length - valid.length} scartate)</p>
            <ul className="grid gap-1 text-xs sm:grid-cols-2">
              {parsed.map((item, index) => (
                <li key={`${item.source}-${index}`} className={item.valid ? 'text-success' : 'text-destructive'}>
                  <span aria-hidden="true">{item.valid ? '✓' : '⚠'}</span> {item.source}
                  {!item.valid && <span className="ml-1">(formato o data non valida)</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field>
          <FieldLabel>Task di appartenenza</FieldLabel>
          <TaskSelect tasks={tasks} value={taskId} onChange={setTaskId} />
        </Field>
        <p className="text-xs text-muted-foreground">Le attività resteranno senza assegnatario. Potrai assegnarle dalla tabella WBS.</p>
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annulla</Button>
        <Button type="button" onClick={() => void handleCreate()} disabled={saving || taskId === null || valid.length === 0}>
          {saving ? 'Creazione…' : valid.length > 0 ? `Crea ${valid.length} attività` : 'Crea attività'}
        </Button>
      </SheetFooter>
    </div>
  );
}

const TITLES: Record<WbsSheetMode['kind'], string> = {
  add: 'Nuovo componente WBS',
  edit: 'Modifica componente WBS',
  dates: 'Aggiungi da elenco date',
};

/** Pannello laterale per aggiungere, modificare o popolare da elenco date i componenti WBS. */
export function WbsSheet({ open, mode, tasks, persons, onOpenChange, onSaved }: WbsSheetProps) {
  // ref condiviso con i form: Esc, scrim e X non chiudono il pannello mentre un salvataggio e in corso
  const inFlight = useRef(false);
  const close = () => onOpenChange(false);
  const handleOpenChange = (next: boolean) => {
    if (!next && inFlight.current) return;
    onOpenChange(next);
  };
  // key sul form di modifica: senza, riaprire un altro componente durante l'animazione di uscita riusa il form precedente
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent aria-describedby={undefined} size="lg">
        <SheetHeader>
          <SheetTitle>{TITLES[mode.kind]}</SheetTitle>
        </SheetHeader>
        {mode.kind === 'dates'
          ? <DateListForm tasks={tasks} inFlight={inFlight} onClose={close} onSaved={onSaved} />
          : <ComponentForm key={mode.kind === 'edit' ? `edit-${mode.item.id}` : 'add'} mode={mode} tasks={tasks} persons={persons} inFlight={inFlight} onClose={close} onSaved={onSaved} />}
      </SheetContent>
    </Sheet>
  );
}
