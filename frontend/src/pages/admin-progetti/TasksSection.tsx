import { useState } from 'react';
import { CaretDown, ListChecks, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, FieldHint, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionCard } from '@/components/app/SectionCard';
import { cn } from '@/lib/utils';
import { resolveAllocationDays } from '@/lib/phasesMode';
import type { TaskFormErrors, TaskFormState, TaskFormsState } from '@/lib/projectConfigModel';
import {
  TASK_LABELS, TASK_TYPES,
  type Person, type Project, type TaskAllocation, type TaskDependency, type TaskType,
} from '../../types';
import { NONE } from './CatalogSelect';

export const TASK_STATUS_LABELS: Record<string, string> = {
  not_started: 'Non iniziato',
  in_progress: 'In corso',
  completed: 'Completato',
};

export type TaskField = 'planned_start' | 'planned_end' | 'estimated_days' | 'status';

/** Chiave del campo fallito nella coda di autosave, es. `task:DEV.planned_end`. */
export const taskFieldKey = (taskType: TaskType, field: TaskField) => `task:${taskType}.${field}`;

export interface TasksSectionHandlers {
  onToggle: (taskType: TaskType, enabled: boolean) => void;
  onChange: (taskType: TaskType, patch: Partial<TaskFormState>) => void;
  onCommit: (taskType: TaskType, field: TaskField, patch?: Partial<TaskFormState>) => void;
  onAddAllocation: (taskType: TaskType, personId: number, days: number) => Promise<boolean>;
  onRemoveAllocation: (taskType: TaskType, allocation: TaskAllocation) => void;
  onAddDependency: (taskType: TaskType, predecessorTaskId: number) => Promise<boolean>;
  onRemoveDependency: (dependency: TaskDependency, predecessorLabel: string) => void;
}

interface TasksSectionProps extends TasksSectionHandlers {
  project: Project;
  persons: Person[];
  taskForms: TaskFormsState;
  taskErrors: Partial<Record<TaskType, TaskFormErrors>>;
  failedField: string | null;
  busyTask: TaskType | null;
}

const shortDate = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' });
const formatDate = (value: string) => (value ? shortDate.format(new Date(`${value}T00:00:00`)) : '—');

const defaultTaskForm = (): TaskFormState => ({
  enabled: false, status: 'not_started', planned_start: '', planned_end: '', estimated_days: '',
});

export function TasksSection(props: TasksSectionProps) {
  return (
    <SectionCard
      title="Task e allocazioni"
      description="Attiva un task per crearlo: puoi allocare persone subito."
      icon={<ListChecks aria-hidden="true" />}
    >
      <div className="space-y-2">
        {TASK_TYPES.map(taskType => <TaskRow key={taskType} taskType={taskType} {...props} />)}
      </div>
    </SectionCard>
  );
}

function TaskRow({
  taskType, project, persons, taskForms, taskErrors, failedField, busyTask,
  onToggle, onChange, onCommit, onAddAllocation, onRemoveAllocation, onAddDependency, onRemoveDependency,
}: TasksSectionProps & { taskType: TaskType }) {
  const form = taskForms[taskType] ?? defaultTaskForm();
  const errors = taskErrors[taskType] ?? {};
  const task = project.tasks?.find(t => t.task_type === taskType);
  const allocations = task?.allocations ?? [];
  const [expanded, setExpanded] = useState(false);
  const isOpen = form.enabled && (expanded || !form.task_id);
  const label = TASK_LABELS[taskType];
  const bodyId = `task-${taskType}-body`;
  const failed = (field: TaskField) => failedField === taskFieldKey(taskType, field);

  return (
    <div className={cn('overflow-hidden rounded-xl border', form.enabled ? 'border-brand/35' : 'border-border')}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <Switch
          id={`task-${taskType}`}
          checked={form.enabled}
          disabled={busyTask === taskType}
          onCheckedChange={checked => {
            onToggle(taskType, checked);
            if (checked) setExpanded(true);
          }}
        />
        <label htmlFor={`task-${taskType}`} className="min-w-0 flex-1 cursor-pointer font-medium text-foreground">
          {label} <span className="text-xs font-normal text-muted-foreground">{taskType}</span>
        </label>
        {form.enabled && (
          <>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{formatDate(form.planned_start)} → {formatDate(form.planned_end)}</span>
              <span>{form.estimated_days || 0} gg</span>
              <span>{allocations.length} {allocations.length === 1 ? 'persona' : 'persone'}</span>
              <span className="rounded-full border border-border px-2 text-xs text-foreground">
                {TASK_STATUS_LABELS[form.status] ?? form.status}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              iconOnly
              size="sm"
              aria-expanded={isOpen}
              aria-controls={bodyId}
              aria-label={`${isOpen ? 'Comprimi' : 'Espandi'} ${label}`}
              onClick={() => setExpanded(open => !open)}
            >
              <CaretDown aria-hidden="true" className={cn('size-4 transition-transform duration-200', isOpen && 'rotate-180')} />
            </Button>
          </>
        )}
      </div>

      {isOpen && (
        <div id={bodyId} className="space-y-4 border-t border-border bg-muted/40 px-4 py-4 sm:pl-16">
          {busyTask === taskType && !form.task_id ? (
            <p role="status" className="text-sm text-muted-foreground">Creazione del task…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field hasError={failed('planned_start')}>
                  <FieldLabel>Data inizio</FieldLabel>
                  <Input
                    type="date"
                    value={form.planned_start}
                    onChange={event => onChange(taskType, { planned_start: event.target.value })}
                    onBlur={() => onCommit(taskType, 'planned_start')}
                  />
                </Field>
                <Field hasError={!!errors.plannedEnd || failed('planned_end')}>
                  <FieldLabel>Data fine</FieldLabel>
                  <Input
                    type="date"
                    value={form.planned_end}
                    onChange={event => onChange(taskType, { planned_end: event.target.value })}
                    onBlur={() => onCommit(taskType, 'planned_end')}
                  />
                  {errors.plannedEnd && <FieldHint role="alert">{errors.plannedEnd}</FieldHint>}
                </Field>
                <Field hasError={!!errors.estimatedDays || failed('estimated_days')}>
                  <FieldLabel>Giorni stimati</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.estimated_days}
                    onChange={event => onChange(taskType, { estimated_days: event.target.value })}
                    onBlur={() => onCommit(taskType, 'estimated_days')}
                  />
                  {errors.estimatedDays && <FieldHint role="alert">{errors.estimatedDays}</FieldHint>}
                </Field>
                <Field hasError={failed('status')}>
                  <FieldLabel>Stato</FieldLabel>
                  <Select value={form.status} onValueChange={status => onCommit(taskType, 'status', { status })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_STATUS_LABELS).map(([value, text]) => (
                        <SelectItem key={value} value={value}>{text}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <AllocationsEditor
                taskType={taskType}
                allocations={allocations}
                persons={persons}
                onAdd={onAddAllocation}
                onRemove={onRemoveAllocation}
              />
              {form.task_id && (
                <DependenciesEditor
                  taskType={taskType}
                  project={project}
                  taskForms={taskForms}
                  dependencies={task?.dependencies ?? []}
                  onAdd={onAddDependency}
                  onRemove={onRemoveDependency}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AllocationsEditor({
  taskType, allocations, persons, onAdd, onRemove, label: labelOverride, addLabel = 'Aggiungi', canRemove = true, replacedDays, noEstimate = false,
}: {
  taskType: TaskType;
  allocations: TaskAllocation[];
  persons: Person[];
  onAdd: TasksSectionHandlers['onAddAllocation'];
  onRemove: TasksSectionHandlers['onRemoveAllocation'];
  /** Nome mostrato nelle aria-label al posto dell'etichetta della fase (es. "questo progetto"). */
  label?: string;
  addLabel?: string;
  /** false nasconde i pulsanti di rimozione (ultima persona di un progetto senza fasi). */
  canRemove?: boolean;
  /** Cambio persona: giorni della persona sostituita, usati se il campo "Giorni" è vuoto. */
  replacedDays?: number | null;
  /** Progetto a basket: nessun giorno stimato per persona. */
  noEstimate?: boolean;
}) {
  const [personId, setPersonId] = useState('');
  const [days, setDays] = useState('');
  const [adding, setAdding] = useState(false);
  const allocated = new Set(allocations.map(a => a.person_id));
  const available = persons.filter(p => !allocated.has(p.id));
  const label = labelOverride ?? TASK_LABELS[taskType];

  const add = async () => {
    setAdding(true);
    const ok = await onAdd(taskType, Number(personId), resolveAllocationDays(days, replacedDays));
    setAdding(false);
    if (ok) { setPersonId(''); setDays(''); }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Persone allocate</p>
      {allocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna persona allocata</p>
      ) : (
        <ul className="space-y-1.5">
          {allocations.map(allocation => (
            <li key={allocation.id} className="flex items-center gap-3 rounded-lg border border-border bg-card py-1 pr-1 pl-3">
              <span className="flex-1 text-sm text-foreground">{allocation.person_name}</span>
              {!noEstimate && <span className="text-xs text-muted-foreground">{allocation.estimated_days} gg</span>}
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  iconOnly
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Rimuovi allocazione di ${allocation.person_name}`}
                  onClick={() => onRemove(taskType, allocation)}
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 ? (
        <div className="flex gap-2">
          <Select value={personId || NONE} onValueChange={value => setPersonId(value === NONE ? '' : value)}>
            <SelectTrigger className="flex-1" aria-label={`Persona da allocare su ${label}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Aggiungi persona…</SelectItem>
              {available.map(person => <SelectItem value={String(person.id)} key={person.id}>{person.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {!noEstimate && <Input
            type="number"
            min="0"
            step="0.125"
            className="w-24"
            placeholder="Giorni"
            aria-label={`Giorni da allocare su ${label}`}
            value={days}
            onChange={event => setDays(event.target.value)}
          />}
          <Button type="button" variant="outline" size="sm" disabled={!personId || adding} onClick={() => void add()}>
            {adding ? 'Aggiungo…' : addLabel}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Tutte le persone sono già allocate</p>
      )}
    </div>
  );
}

function DependenciesEditor({
  taskType, project, taskForms, dependencies, onAdd, onRemove,
}: {
  taskType: TaskType;
  project: Project;
  taskForms: TaskFormsState;
  dependencies: TaskDependency[];
  onAdd: TasksSectionHandlers['onAddDependency'];
  onRemove: TasksSectionHandlers['onRemoveDependency'];
}) {
  const [predecessor, setPredecessor] = useState('');
  const existing = new Set(dependencies.map(d => d.predecessor_task_id));
  const candidates = TASK_TYPES.filter(other => {
    const otherId = taskForms[other]?.task_id;
    return other !== taskType && taskForms[other]?.enabled && otherId && !existing.has(otherId);
  });
  const labelOf = (taskId: number) => {
    const predecessorTask = project.tasks?.find(t => t.id === taskId);
    return predecessorTask ? TASK_LABELS[predecessorTask.task_type] ?? predecessorTask.task_type : `#${taskId}`;
  };

  if (dependencies.length === 0 && candidates.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Dipende da (fine → inizio)</p>
      {dependencies.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {dependencies.map(dependency => {
            const predecessorLabel = labelOf(dependency.predecessor_task_id);
            return (
              <li key={dependency.id} className="flex items-center gap-1 rounded-full border border-border bg-card py-0.5 pr-0.5 pl-3 text-sm">
                {predecessorLabel}
                <Button
                  type="button"
                  variant="ghost"
                  iconOnly
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Rimuovi dipendenza da ${predecessorLabel}`}
                  onClick={() => onRemove(dependency, predecessorLabel)}
                >
                  <X aria-hidden="true" className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {candidates.length > 0 && (
        <div className="flex gap-2">
          <Select value={predecessor || NONE} onValueChange={value => setPredecessor(value === NONE ? '' : value)}>
            <SelectTrigger className="flex-1" aria-label={`Predecessore di ${TASK_LABELS[taskType]}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Aggiungi predecessore…</SelectItem>
              {candidates.map(other => (
                <SelectItem value={String(taskForms[other]!.task_id)} key={other}>{TASK_LABELS[other]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!predecessor}
            onClick={() => void onAdd(taskType, Number(predecessor)).then(ok => ok && setPredecessor(''))}
          >
            Aggiungi
          </Button>
        </div>
      )}
    </div>
  );
}
