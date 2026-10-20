import { Field, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { isSinglePerson } from '@/lib/phasesMode';
import type { TaskFormErrors, TaskFormState } from '@/lib/projectConfigModel';
import type { BillingType, Person, TaskAllocation } from '../../types';
import { AllocationsEditor, taskFieldKey, type TaskField } from './TasksSection';

interface PhaselessEditorProps {
  billingType: BillingType;
  persons: Person[];
  allocations: TaskAllocation[];
  form: TaskFormState;
  errors: TaskFormErrors;
  failedField: string | null;
  onChange: (patch: Partial<TaskFormState>) => void;
  onCommit: (field: TaskField) => void;
  onAddPerson: (personId: number, days: number) => Promise<boolean>;
  /** T&M: richiede conferma e invia replace=true. Risolve true solo a cambio confermato, false se annullato. */
  onChangePerson: (personId: number, days: number) => Promise<boolean>;
  onRemoveAllocation: (allocation: TaskAllocation) => void;
  /** Progetto a basket: niente giorni stimati, il riferimento è il basket. */
  noEstimate?: boolean;
}

/** Pianificazione (inizio, fine, giorni) e persone di un progetto senza fasi: vivono sul task GEN implicito. */
export function PhaselessEditor({
  billingType, persons, allocations, form, errors, failedField,
  onChange, onCommit, onAddPerson, onChangePerson, onRemoveAllocation, noEstimate = false,
}: PhaselessEditorProps) {
  const single = isSinglePerson(billingType);
  // Cambio con conferma solo se c'è già una persona: la prima assegnazione T&M è un normale POST.
  const replacing = single && allocations.length > 0;
  const failed = (field: TaskField) => failedField === taskFieldKey('GEN', field);

  return (
    <div className="space-y-4">
      <div className={noEstimate ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'grid grid-cols-1 gap-3 sm:grid-cols-3'}>
        <Field hasError={failed('planned_start')}>
          <FieldLabel>Data inizio</FieldLabel>
          <Input
            type="date"
            value={form.planned_start}
            onChange={event => onChange({ planned_start: event.target.value })}
            onBlur={() => onCommit('planned_start')}
          />
        </Field>
        <Field hasError={!!errors.plannedEnd || failed('planned_end')}>
          <FieldLabel>Data fine</FieldLabel>
          <Input
            type="date"
            value={form.planned_end}
            onChange={event => onChange({ planned_end: event.target.value })}
            onBlur={() => onCommit('planned_end')}
          />
          {errors.plannedEnd && <FieldHint role="alert">{errors.plannedEnd}</FieldHint>}
        </Field>
        {!noEstimate && <Field hasError={!!errors.estimatedDays || failed('estimated_days')}>
          <FieldLabel>Giorni stimati</FieldLabel>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={form.estimated_days}
            onChange={event => onChange({ estimated_days: event.target.value })}
            onBlur={() => onCommit('estimated_days')}
          />
          {errors.estimatedDays && <FieldHint role="alert">{errors.estimatedDays}</FieldHint>}
        </Field>}
      </div>
      <AllocationsEditor
        taskType="GEN"
        label="questo progetto"
        allocations={allocations}
        persons={persons}
        onAdd={(_taskType, personId, days) => (replacing ? onChangePerson(personId, days) : onAddPerson(personId, days))}
        onRemove={(_taskType, allocation) => onRemoveAllocation(allocation)}
        addLabel={replacing ? 'Cambia persona' : 'Aggiungi'}
        replacedDays={replacing ? allocations[0]?.estimated_days : undefined}
        noEstimate={noEstimate}
      />
      {single && (
        <p className="text-sm text-muted-foreground">
          Un progetto Time &amp; Material senza fasi ha una sola persona assegnata.
        </p>
      )}
    </div>
  );
}
