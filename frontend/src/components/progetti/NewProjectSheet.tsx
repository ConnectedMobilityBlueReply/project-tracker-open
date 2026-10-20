import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldHint, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  EMPTY_PROJECT_FORM,
  toCreatePayload,
  validateProjectForm,
  type ProjectCreateErrors,
  type ProjectCreateForm,
} from '@/lib/projectCreateForm';
import { createProject } from '../../api';
import type { OptionValue, Project } from '../../types';

const NONE = '__none__';

interface NewProjectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societaOptions: readonly OptionValue[];
  areaOptions: readonly OptionValue[];
  pmOptions: readonly OptionValue[];
  onCreated: (project: Project) => void;
}

/** Creazione di un progetto con i soli campi noti subito; il resto si configura in admin. */
export function NewProjectSheet({ open, onOpenChange, societaOptions, areaOptions, pmOptions, onCreated }: NewProjectSheetProps) {
  const [form, setForm] = useState<ProjectCreateForm>(EMPTY_PROJECT_FORM);
  const [errors, setErrors] = useState<ProjectCreateErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = <K extends keyof ProjectCreateForm>(field: K, value: ProjectCreateForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) {
      setForm(EMPTY_PROJECT_FORM);
      setErrors({});
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validateProjectForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const project = await createProject(toCreatePayload(form));
      setForm(EMPTY_PROJECT_FORM);
      onCreated(project);
    } catch {
      setSubmitError('Errore nella creazione del progetto');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const optionSelect = (field: 'societa' | 'area' | 'pm', label: string, options: readonly OptionValue[]) => (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={form[field] || NONE} onValueChange={value => setField(field, value === NONE ? '' : value)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— nessuna —</SelectItem>
          {options.map(option => <SelectItem key={option.id} value={option.value}>{option.value}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Nuovo progetto</SheetTitle>
        </SheetHeader>
        <form onSubmit={event => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetBody className="space-y-4">
            <Field hasError={!!errors.name}>
              <FieldLabel>Nome *</FieldLabel>
              <Input autoFocus value={form.name} onChange={event => setField('name', event.target.value)} placeholder="Nome del progetto" />
              {errors.name && <FieldHint role="alert">{errors.name}</FieldHint>}
            </Field>
            {optionSelect('societa', 'Società', societaOptions)}
            {optionSelect('area', 'Area', areaOptions)}
            {optionSelect('pm', 'PM riferimento cliente', pmOptions)}
            <Field hasError={!!errors.estimate_days}>
              <FieldLabel>Stima giorni</FieldLabel>
              <Input type="number" min="0" step="0.5" value={form.estimate_days} onChange={event => setField('estimate_days', event.target.value)} placeholder="es. 30" />
              {errors.estimate_days && <FieldHint role="alert">{errors.estimate_days}</FieldHint>}
            </Field>
            <Field>
              <FieldLabel>Descrizione</FieldLabel>
              <Textarea rows={3} value={form.description} onChange={event => setField('description', event.target.value)} placeholder="Descrizione opzionale" />
            </Field>
            {submitError && <FieldHint role="alert" hasError>{submitError}</FieldHint>}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Annulla</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creazione…' : 'Crea progetto'}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
