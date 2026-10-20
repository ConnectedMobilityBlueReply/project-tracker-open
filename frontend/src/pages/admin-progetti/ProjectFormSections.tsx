import { Info, Receipt } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Field, FieldHint, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionCard } from '@/components/app/SectionCard';
import { ProjectTile } from '@/components/app/ProjectTile';
import { PROJECT_ICON_KEYS } from '@/lib/projectIconKeys';
import { areaPatch, type ProjectForm, type ProjectFormErrors } from '@/lib/projectConfigModel';
import { PROJECT_STATUS_OPTIONS, type BillingType, type OptionKind, type OptionValue } from '../../types';
import { CatalogSelect, NONE } from './CatalogSelect';

export type ProjectField = keyof ProjectForm;

interface SectionProps {
  form: ProjectForm;
  errors: ProjectFormErrors;
  /** Campo del progetto il cui salvataggio è fallito (dalla coda di autosave). */
  failedField: string | null;
  onChange: (patch: Partial<ProjectForm>) => void;
  /** Valida e salva; `patch` per i controlli che cambiano e salvano in un colpo (select, switch). */
  onCommit: (field: ProjectField, patch?: Partial<ProjectForm>) => void;
}

const SAVE_FAILED = 'Non salvato: riprova dalla testata.';

export function GeneralSection({
  form, errors, failedField, onChange, onCommit, options,
}: SectionProps & { options: Record<OptionKind, OptionValue[]> }) {
  const failed = (field: ProjectField) => failedField === field;
  return (
    <SectionCard title="Generale" icon={<Info aria-hidden="true" />}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field className="md:col-span-3" hasError={!!errors.name || failed('name')} required>
          <FieldLabel>Nome progetto</FieldLabel>
          <Input
            value={form.name}
            onChange={event => onChange({ name: event.target.value })}
            onBlur={() => onCommit('name')}
          />
          {(errors.name || failed('name')) && <FieldHint role="alert">{errors.name ?? SAVE_FAILED}</FieldHint>}
        </Field>
        <Field className="md:col-span-3" hasError={failed('description')}>
          <FieldLabel>Descrizione attività</FieldLabel>
          <Textarea
            rows={2}
            className="w-full"
            value={form.description}
            onChange={event => onChange({ description: event.target.value })}
            onBlur={() => onCommit('description')}
          />
        </Field>
        <Field hasError={failed('status')}>
          <FieldLabel>Stato</FieldLabel>
          <Select value={form.status} onValueChange={status => onCommit('status', { status })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_STATUS_OPTIONS.map(option => <SelectItem value={option} key={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <CatalogSelect
          label="Società"
          value={form.societa}
          options={options.societa}
          hasError={failed('societa')}
          onChange={societa => onCommit('societa', { societa })}
          emptyHint="Nessuna società nel catalogo. Aggiungila da Opzioni → Società."
        />
        <CatalogSelect
          label="Area"
          value={form.area}
          options={options.area}
          hasError={failed('area')}
          onChange={area => onCommit('area', areaPatch(area, form.billing_type))}
          emptyHint="Nessuna area nel catalogo. Aggiungila da Opzioni → Area."
        />
        <CatalogSelect
          className="md:col-span-2"
          label="PM riferimento cliente"
          value={form.pm_riferimento_cliente}
          options={options.pm}
          hasError={failed('pm_riferimento_cliente')}
          onChange={pm => onCommit('pm_riferimento_cliente', { pm_riferimento_cliente: pm })}
          emptyHint="Nessun PM nel catalogo. Aggiungilo da Opzioni → PM."
        />
        <Field hasError={failed('icon')}>
          <FieldLabel>Icona</FieldLabel>
          <Select value={form.icon || NONE} onValueChange={value => onCommit('icon', { icon: value === NONE ? '' : value })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Iniziale del nome</SelectItem>
              {PROJECT_ICON_KEYS.map((key, index) => (
                <SelectItem value={key} key={key}>
                  <ProjectTile id={index + 1} name={key} icon={key} size="sm" />
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </SectionCard>
  );
}

interface OfferSectionProps extends SectionProps {
  statusOfferta: OptionValue[];
  basketNames: string[];
  /** Messaggio del server se il salvataggio di billing_type è fallito. */
  billingError: string | null;
  /** Somma dei giorni dei task abilitati e differenza rispetto alla stima (null = stima vuota). */
  estimate: { taskTotal: number; diff: number | null };
  /** Progetti T&M selezionabili come padre (vedi parentCandidates). */
  parentOptions: { id: number; name: string }[];
  /** Il progetto ha sotto progetti: non può avere a sua volta un padre. */
  hasChildren: boolean;
  /** Messaggio del server se il salvataggio di parent_project_id è fallito. */
  parentError: string | null;
}

const formatDays = (days: number) => days.toLocaleString('it-IT', { maximumFractionDigits: 2 });

function EstimateHint({ estimate }: { estimate: OfferSectionProps['estimate'] }) {
  const { taskTotal, diff } = estimate;
  if (diff === null || diff === 0) {
    return <FieldHint>Somma task: {formatDays(taskTotal)} gg{diff === 0 ? ' · allineata' : ''}</FieldHint>;
  }
  return (
    <p className="text-xs text-warning-strong" aria-live="polite">
      Somma task: {formatDays(taskTotal)} gg · {diff > 0 ? '+' : '−'}{formatDays(Math.abs(diff))} gg rispetto alla stima
    </p>
  );
}

export function OfferSection({
  form, errors, failedField, onChange, onCommit, statusOfferta, basketNames, estimate, billingError,
  parentOptions, hasChildren, parentError,
}: OfferSectionProps) {
  const failed = (field: ProjectField) => failedField === field;
  const basketIsOrphan = form.basket !== '' && !basketNames.includes(form.basket);
  const isChild = form.parent_project_id !== '';
  // Con un padre già impostato il select resta attivo, così l'utente può scollegare e correggere.
  const parentLocked = hasChildren || (!isChild && form.billing_type !== 'tm');
  const parentIsOrphan = isChild
    && !parentOptions.some(option => String(option.id) === form.parent_project_id);
  const parentHint = hasChildren ? 'Ha sotto progetti: non può avere un progetto padre.'
    : parentLocked ? 'Disponibile solo per i progetti Time & Material.'
    : isChild ? 'Il consuntivo confluisce nel plafond e nella fatturazione del padre.'
    : 'Collega il progetto a una macro attività Time & Material.';
  return (
    <SectionCard title="Offerta" description="Dati commerciali e stima complessiva" icon={<Receipt aria-hidden="true" />}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field hasError={!!errors.billingType || failed('billing_type')}>
          <FieldLabel>Modalità</FieldLabel>
          <Select
            value={form.billing_type}
            disabled={isChild}
            onValueChange={value => onCommit('billing_type', {
              billing_type: value as BillingType,
              ...(value === 'tm' ? { scala_da_basket: false, basket: '', exclude_from_actuals: false } : {}),
            })}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {!isChild && <SelectItem value="turnkey">Turn Key</SelectItem>}
              <SelectItem value="tm">Time &amp; Material</SelectItem>
            </SelectContent>
          </Select>
          {(errors.billingType || failed('billing_type'))
            ? <FieldHint role="alert">{errors.billingType ?? billingError ?? SAVE_FAILED}</FieldHint>
            : <FieldHint>{isChild ? 'Sotto progetto: sempre Time & Material.' : form.billing_type === 'tm' ? 'Fatturato a consuntivo, mese per mese.' : 'Budget = stima + estensioni.'}</FieldHint>}
        </Field>
        <Field hasError={!!errors.parentProject || failed('parent_project_id')}>
          <FieldLabel>Progetto padre (T&amp;M)</FieldLabel>
          <Select
            value={form.parent_project_id || NONE}
            disabled={parentLocked}
            onValueChange={value => onCommit('parent_project_id', { parent_project_id: value === NONE ? '' : value })}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nessuno</SelectItem>
              {parentIsOrphan && <SelectItem value={form.parent_project_id}>Progetto #{form.parent_project_id}</SelectItem>}
              {parentOptions.map(option => <SelectItem value={String(option.id)} key={option.id}>{option.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {(errors.parentProject || failed('parent_project_id'))
            ? <FieldHint role="alert">{errors.parentProject ?? parentError ?? SAVE_FAILED}</FieldHint>
            : <FieldHint>{parentHint}</FieldHint>}
        </Field>
        <Field hasError={failed('codice_offerta')}>
          <FieldLabel>Codice offerta</FieldLabel>
          <Input
            placeholder="Es. OFF-2025-001"
            value={form.codice_offerta}
            onChange={event => onChange({ codice_offerta: event.target.value })}
            onBlur={() => onCommit('codice_offerta')}
          />
          {failed('codice_offerta') && <FieldHint role="alert">{SAVE_FAILED}</FieldHint>}
        </Field>
        <CatalogSelect
          label="Status offerta"
          value={form.status_offerta}
          options={statusOfferta}
          hasError={failed('status_offerta')}
          onChange={value => onCommit('status_offerta', { status_offerta: value })}
          emptyHint="Nessuno status offerta nel catalogo. Aggiungilo da Opzioni → Status Offerta."
        />
        {!isChild && !form.scala_da_basket && (
          <Field hasError={!!errors.estimateDays || failed('estimate_days')}>
            <FieldLabel>{form.billing_type === 'tm' ? 'Plafond ordine (gg)' : 'Stima giorni'}</FieldLabel>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.estimate_days}
              onChange={event => onChange({ estimate_days: event.target.value })}
              onBlur={() => onCommit('estimate_days')}
            />
            {errors.estimateDays ? <FieldHint role="alert">{errors.estimateDays}</FieldHint> : <EstimateHint estimate={estimate} />}
          </Field>
        )}
        <Field hasError={!!errors.dailyRate || failed('daily_rate')} required>
          <FieldLabel>Tariffa giornaliera (€)</FieldLabel>
          <Input
            type="number"
            min="0"
            max="10000"
            step="0.01"
            inputMode="decimal"
            value={form.daily_rate}
            onChange={event => onChange({ daily_rate: event.target.value })}
            onBlur={() => onCommit('daily_rate')}
          />
          {(errors.dailyRate || failed('daily_rate'))
            ? <FieldHint role="alert">{errors.dailyRate ?? SAVE_FAILED}</FieldHint>
            : <FieldHint>Usata per i valori in € del Prospetto Economico.</FieldHint>}
        </Field>
        <div className="flex min-h-10 items-center gap-3 md:col-span-1 md:self-end">
          <Switch
            id="scala-da-basket"
            disabled={form.billing_type === 'tm'}
            checked={form.scala_da_basket}
            onCheckedChange={checked => onCommit('scala_da_basket', { scala_da_basket: checked, basket: checked ? form.basket : '', ...(checked ? { estimate_days: '' } : {}) })}
          />
          <label htmlFor="scala-da-basket" className="cursor-pointer text-sm font-medium text-foreground">
            Scala da basket{form.billing_type === 'tm' && <span className="block text-xs font-normal text-muted-foreground">Non disponibile per Time &amp; Material</span>}
          </label>
        </div>
        <div className="flex min-h-10 items-center gap-3 md:col-span-1 md:self-end">
          <Switch
            id="exclude-from-actuals"
            disabled={form.billing_type === 'tm'}
            checked={form.exclude_from_actuals}
            onCheckedChange={checked => onCommit('exclude_from_actuals', { exclude_from_actuals: checked })}
          />
          <label htmlFor="exclude-from-actuals" className="cursor-pointer text-sm font-medium text-foreground">
            Escludi dai consuntivi
            <span className="block text-xs font-normal text-muted-foreground">
              {form.billing_type === 'tm'
                ? 'Non disponibile per Time & Material'
                : 'Le ore registrate non contano nei giorni consuntivati.'}
            </span>
          </label>
        </div>
        {form.scala_da_basket && (
          <Field className="md:col-span-2" hasError={!!errors.basket || failed('basket')} required>
            <FieldLabel>Basket</FieldLabel>
            <Select value={form.basket || NONE} onValueChange={value => onCommit('basket', { basket: value === NONE ? '' : value })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Seleziona un basket…</SelectItem>
                {basketIsOrphan && <SelectItem value={form.basket}>{form.basket}</SelectItem>}
                {basketNames.map(basket => <SelectItem value={basket} key={basket}>{basket}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldHint role={errors.basket ? 'alert' : undefined}>
              {errors.basket ?? 'Le giornate consuntivate su questo progetto scalano dal basket selezionato.'}
            </FieldHint>
          </Field>
        )}
      </div>
    </SectionCard>
  );
}
