import { useState, useEffect, useCallback } from 'react';
import { Plus, SlidersHorizontal } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/PageHeader';
import { getOptions, createOption, updateOption, deleteOption } from '../api';
import { OptionKind, OptionValue } from '../types';

const TABS: { kind: OptionKind; label: string }[] = [
  { kind: 'societa', label: 'Società' },
  { kind: 'area', label: 'Area' },
  { kind: 'pm', label: 'PM' },
  { kind: 'status_offerta', label: 'Stato Offerta' },
  { kind: 'partner', label: 'Altri partner' },
];

export default function AdminOpzioni() {
  const [activeKind, setActiveKind] = useState<OptionKind>('societa');
  const [options, setOptions] = useState<OptionValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<OptionValue | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<OptionValue | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // L'errore viene azzerato all'avvio: cambiando tab non deve restare
    // visibile l'errore del tab precedente.
    setError(null);
    try {
      setOptions(await getOptions(activeKind));
    } catch {
      setError('Errore nel caricamento delle opzioni');
    } finally {
      setLoading(false);
    }
  }, [activeKind]);

  useEffect(() => {
    // Cambio tab: il contenuto precedente sparisce subito, niente dati
    // stale del catalogo precedente durante il caricamento.
    setOptions([]);
    void load();
  }, [load]);

  const openCreate = () => { setEditing(null); setValue(''); setFormError(null); setShowModal(true); };

  const openEdit = (o: OptionValue) => { setEditing(o); setValue(o.value); setFormError(null); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateOption(editing.id, value.trim());
      } else {
        await createOption(activeKind, value.trim());
      }
      setShowModal(false);
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (o: OptionValue) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOption(o.id);
      setDeleteConfirm(null);
      await load();
    } catch (err: any) {
      // Il dialog resta aperto: il fallimento non deve sembrare un successo.
      setDeleteError(err.message || "Errore nell'eliminazione");
    } finally {
      setDeleting(false);
    }
  };

  const columns: readonly DataTableColumn<OptionValue>[] = [
    {
      key: 'valore',
      header: 'Valore',
      sortable: true,
      accessor: o => o.value,
      cell: o => <span className="font-medium text-foreground">{o.value}</span>,
    },
    {
      key: 'azioni',
      header: 'Azioni',
      // stopPropagation: i click/tasti sui pulsanti non devono attivare la riga.
      cell: o => (
        <div className="flex gap-2" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <Button
            onClick={() => openEdit(o)}
            variant="outline"
            size="sm"
            className="px-3 py-1.5 text-xs border border-border font-medium"
          >
            Rinomina
          </Button>
          <Button
            onClick={() => setDeleteConfirm(o)}
            variant="destructive"
            size="sm"
            className="px-3 py-1.5 text-xs border border-destructive/30 text-destructive font-medium"
          >
            Elimina
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Gestione Opzioni"
        description="Valori ammessi per i campi progetto"
        actions={(
          <Button onClick={openCreate}>
            <Plus />
            Aggiungi Valore
          </Button>
        )}
      />

      <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as OptionKind)}>
        <TabsList>
          {TABS.map(t => <TabsTrigger key={t.kind} value={t.kind}>{t.label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value={activeKind} className="mt-6">
          <SectionCard
            title={TABS.find(tab => tab.kind === activeKind)?.label ?? activeKind}
            icon={<SlidersHorizontal />}
            bodyClassName="p-0"
          >
            <DataTable
              bare
              data={options}
              columns={columns}
              getRowId={o => o.id}
              defaultSort="valore"
              searchPlaceholder="Cerca nei valori…"
              densityStorageKey="project-tracker:admin-opzioni-density"
              // La tabella non viene smontata durante un ricaricamento: lo
              // stato di caricamento compare solo quando non c'è ancora dato.
              loading={loading && options.length === 0}
              error={error}
              onRetry={() => void load()}
              onRowActivate={openEdit}
              rowLabel={o => `Rinomina ${o.value}`}
              emptyState={options.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">Nessun valore per questo catalogo</p>
                  <Button type="button" variant="link" onClick={openCreate} className="font-medium text-primary">
                    Aggiungi il primo valore
                  </Button>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">Nessun risultato per la ricerca.</p>
              )}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(isOpen) => { if (!saving) setShowModal(isOpen); }}>
        <DialogContent aria-describedby={undefined} className="rounded-card sm:max-w-[480px]">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle>{editing ? 'Rinomina Valore' : 'Nuovo Valore'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field>
              <FieldLabel>Valore *</FieldLabel>
              <Input
                name="value"
                type="text"
                required
                value={value}
                onChange={e => setValue(e.target.value)}
                autoFocus
              />
            </Field>
            {formError && (
              <p role="alert" className="text-sm font-medium text-destructive">{formError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setShowModal(false)}
                variant="outline"
                disabled={saving}
                className="flex-1 px-4 py-2 border border-border text-sm font-medium"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm font-medium"
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(isOpen) => { if (!isOpen && !deleting) setDeleteConfirm(null); }}
      >
        <DialogContent className="rounded-card sm:max-w-[480px]">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle>Conferma eliminazione</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Sei sicuro di voler eliminare{' '}
            <span className="font-medium text-foreground">"{deleteConfirm?.value}"</span>? L'operazione non è reversibile.
          </DialogDescription>
          {deleteError && (
            <p role="alert" className="text-sm font-medium text-destructive">{deleteError}</p>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              variant="outline"
              disabled={deleting}
              className="flex-1 px-4 py-2 border border-border text-sm font-medium"
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              variant="destructive"
              disabled={deleting}
              className="flex-1 px-4 py-2 text-sm font-medium"
            >
              {deleting ? 'Eliminazione…' : 'Elimina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
