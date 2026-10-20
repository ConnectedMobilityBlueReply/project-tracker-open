import { useState } from 'react';
import { CurrencyEur, Users, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionCard } from '@/components/app/SectionCard';
import type { BillingType, OptionValue, Project, ProjectExtension, PartnerAllocation } from '../../types';
import { NONE } from './CatalogSelect';

const days = (value?: number) => `${(value ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 3 })} gg`;

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" iconOnly size="sm" className="text-destructive hover:text-destructive" aria-label={label} onClick={onClick}>
      <X aria-hidden="true" className="size-4" />
    </Button>
  );
}

interface PartnerSectionProps {
  project: Project;
  partnerOptions: OptionValue[];
  onAdd: (societa: string, giornate: number) => Promise<boolean>;
  onRemove: (allocation: PartnerAllocation) => void;
}

export function PartnerSection({ project, partnerOptions, onAdd, onRemove }: PartnerSectionProps) {
  const [societa, setSocieta] = useState('');
  const [giornate, setGiornate] = useState('');
  const [saving, setSaving] = useState(false);
  const rows = project.partner_allocations ?? [];

  const add = async () => {
    setSaving(true);
    const ok = await onAdd(societa, Number(giornate));
    setSaving(false);
    if (ok) { setSocieta(''); setGiornate(''); }
  };

  return (
    <SectionCard
      title="Giornate altri partner"
      description="Giornate assegnate ad altre società partner: escluse da grafici e statistiche, incluse nel totale complessivo."
      icon={<Users aria-hidden="true" />}
      footer={(
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-foreground">
          <span>Totale altri partner: <strong>{days(project.total_partner_days)}</strong></span>
          <span>Totale stima: <strong>{days(project.total_stima)}</strong></span>
          <span>Totale stima propria: <strong>{days(project.total_stima_own)}</strong></span>
        </div>
      )}
    >
      {rows.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">Nessuna giornata assegnata ad altri partner</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {rows.map(row => (
            <li key={row.id} className="flex items-center gap-3 rounded-lg border border-border bg-background py-1 pr-1 pl-3">
              <span className="flex-1 text-sm text-foreground">{row.societa}</span>
              <span className="text-xs text-muted-foreground">{days(row.giornate)}</span>
              <RemoveButton label={`Rimuovi giornate partner per ${row.societa}`} onClick={() => onRemove(row)} />
            </li>
          ))}
        </ul>
      )}
      {partnerOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessuna società partner nel catalogo. Aggiungila da Opzioni → Altri partner.</p>
      ) : (
        <div className="flex gap-2">
          <Select value={societa || NONE} onValueChange={value => setSocieta(value === NONE ? '' : value)}>
            <SelectTrigger className="flex-1" aria-label="Società partner"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Società partner…</SelectItem>
              {partnerOptions.map(option => <SelectItem value={option.value} key={option.id}>{option.value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="0"
            step="0.5"
            className="w-28"
            placeholder="Giorni"
            aria-label="Giorni altri partner"
            value={giornate}
            onChange={event => setGiornate(event.target.value)}
          />
          <Button type="button" variant="outline" size="sm" disabled={!societa || !giornate || Number(giornate) < 0 || saving} onClick={() => void add()}>
            {saving ? 'Aggiungo…' : 'Aggiungi'}
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

export interface ExtensionDraft {
  codice_offerta: string;
  giornate: string;
  status_offerta: string;
}

const EMPTY_DRAFT: ExtensionDraft = { codice_offerta: '', giornate: '', status_offerta: '' };

interface ExtensionsSectionProps {
  billingType: BillingType;
  extensions: ProjectExtension[];
  statusOptions: OptionValue[];
  /** `id` null = nuova estensione. */
  onSave: (id: number | null, draft: ExtensionDraft) => Promise<boolean>;
  onRemove: (extension: ProjectExtension) => void;
}

export function ExtensionsSection({ billingType, extensions, statusOptions, onSave, onRemove }: ExtensionsSectionProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ExtensionDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const total = extensions.reduce((sum, extension) => sum + extension.giornate, 0);
  const isValid = draft.giornate !== '' && Number(draft.giornate) >= 0;

  const reset = () => { setEditingId(null); setDraft(EMPTY_DRAFT); };
  const save = async () => {
    setSaving(true);
    const ok = await onSave(editingId, draft);
    setSaving(false);
    if (ok) reset();
  };

  return (
    <SectionCard
      title={billingType === 'tm' ? 'Ordini aggiuntivi' : 'Estensioni / offerte successive'}
      description={billingType === 'tm'
        ? 'Giornate aggiunte al plafond con ordini successivi del cliente.'
        : 'Giornate aggiunte con offerte successive. Il totale è informativo e non modifica la stima.'}
      icon={<CurrencyEur aria-hidden="true" />}
      footer={<span className="text-foreground">Totale estensioni: <strong>{days(total)}</strong></span>}
    >
      {extensions.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">Nessuna estensione registrata</p>
      ) : (
        <ul className="mb-4 space-y-1.5">
          {extensions.map(extension => (
            <li key={extension.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background py-1 pr-1 pl-3">
              <span className="flex-1 text-sm font-medium text-foreground">{extension.codice_offerta || 'Senza codice offerta'}</span>
              <span className="text-xs text-muted-foreground">{days(extension.giornate)}</span>
              {extension.status_offerta && <span className="text-xs text-muted-foreground">{extension.status_offerta}</span>}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingId(extension.id);
                  setDraft({
                    codice_offerta: extension.codice_offerta || '',
                    giornate: String(extension.giornate),
                    status_offerta: extension.status_offerta || '',
                  });
                }}
              >
                Modifica
              </Button>
              <RemoveButton label={`Rimuovi estensione ${extension.codice_offerta || extension.id}`} onClick={() => onRemove(extension)} />
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end">
        <Field>
          <FieldLabel>Codice offerta</FieldLabel>
          <Input placeholder="Es. OFF-2025-002" value={draft.codice_offerta} onChange={event => setDraft(d => ({ ...d, codice_offerta: event.target.value }))} />
        </Field>
        <Field>
          <FieldLabel>Giornate</FieldLabel>
          <Input type="number" min="0" step="0.001" value={draft.giornate} onChange={event => setDraft(d => ({ ...d, giornate: event.target.value }))} />
        </Field>
        <Field>
          <FieldLabel>Status offerta</FieldLabel>
          <Select value={draft.status_offerta || NONE} onValueChange={value => setDraft(d => ({ ...d, status_offerta: value === NONE ? '' : value }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nessuno</SelectItem>
              {statusOptions.map(option => <SelectItem value={option.value} key={option.id}>{option.value}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!isValid || saving} onClick={() => void save()}>
            {saving ? 'Salvo…' : editingId === null ? 'Aggiungi' : 'Aggiorna'}
          </Button>
          {editingId !== null && <Button type="button" variant="ghost" size="sm" onClick={reset}>Annulla</Button>}
        </div>
      </div>
    </SectionCard>
  );
}
