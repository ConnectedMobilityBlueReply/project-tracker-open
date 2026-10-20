import { useState, useEffect } from 'react';
import { Plus, Users } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable, type DataTableColumn } from '@/components/app/DataTable';
import { SectionCard } from '@/components/app/SectionCard';
import { PageHeader } from '@/components/app/PageHeader';
import { AvatarFallback, AvatarRoot } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { avatarColorFor, initials } from '@/lib/people';
import { getPlatformPersons, createPlatformPerson, updatePlatformPerson, deletePlatformPerson } from '../api';
import { PlatformPerson } from '../types';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '@/components/app/StateMessages';

interface FormState {
  name: string;
  email: string;
  jobTitle: string;
  weeklyCapacityDays: number | null;
}

const emptyForm: FormState = { name: '', email: '', jobTitle: '', weeklyCapacityDays: null };

export default function AdminPersone() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.platformAdmin === true;
  const [persons, setPersons] = useState<PlatformPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PlatformPerson | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [managerBusyId, setManagerBusyId] = useState<number | null>(null);
  const [managerError, setManagerError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlatformPersons();
      setPersons(data);
    } catch {
      setError('Errore nel caricamento delle persone');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isPlatformAdmin) void load(); }, [isPlatformAdmin]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (p: PlatformPerson) => {
    setEditingId(p.id);
    setForm({ name: p.name, email: p.email || '', jobTitle: p.job_title || '', weeklyCapacityDays: p.weekly_capacity_days });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        // Il PUT riscrive weekly_capacity_days (default 5 se assente): reinviare il valore corrente.
        await updatePlatformPerson(editingId, {
          name: form.name, email: form.email, job_title: form.jobTitle,
          ...(form.weeklyCapacityDays != null ? { weekly_capacity_days: form.weeklyCapacityDays } : {}),
        });
      } else {
        await createPlatformPerson({ name: form.name, email: form.email, job_title: form.jobTitle });
      }
      setShowModal(false);
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (person: PlatformPerson) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePlatformPerson(person.id);
      setDeleteConfirm(null);
      await load();
    } catch (err: any) {
      // Il dialog resta aperto: il fallimento non deve sembrare un successo.
      setDeleteError(err.message || "Errore nell'eliminazione");
    } finally {
      setDeleting(false);
    }
  };

  const toggleManager = async (person: PlatformPerson, isManager: boolean) => {
    setManagerBusyId(person.id);
    setManagerError(null);
    try {
      // Il PUT riscrive name e job_title se assenti: vanno sempre reinviati. email e weekly_capacity_days restano invariati se omessi.
      await updatePlatformPerson(person.id, { name: person.name, job_title: person.job_title ?? '', is_manager: isManager });
      await load();
    } catch (err: any) {
      setManagerError(err.message || 'Errore nel salvataggio del ruolo manager');
    } finally {
      setManagerBusyId(null);
    }
  };

  if (!isPlatformAdmin) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState title="Riservato all'amministratore di piattaforma" description="Le persone del tuo team si gestiscono dalla pagina Team." />
      </div>
    );
  }

  const columns: readonly DataTableColumn<PlatformPerson>[] = [
    {
      key: 'nome',
      header: 'Nome',
      sortable: true,
      accessor: p => p.name,
      cell: p => (
        <span className="flex items-center gap-2">
          <AvatarRoot size="sm" color={avatarColorFor(p.name)}>
            <AvatarFallback>{initials(p.name)}</AvatarFallback>
          </AvatarRoot>
          {p.name}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      accessor: p => p.email || '',
      cell: p => <span className="text-foreground">{p.email || '—'}</span>,
    },
    {
      key: 'mansione',
      header: 'Mansione',
      sortable: true,
      accessor: p => p.job_title || '',
      cell: p => p.job_title ? (
        <Badge variant="secondary" size="sm" pill>{p.job_title}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      sortable: true,
      accessor: p => (p.is_manager ? 1 : 0),
      // stopPropagation: il click sull'interruttore non deve aprire la modifica della riga.
      cell: p => (
        <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <Switch
            checked={p.is_manager}
            disabled={managerBusyId === p.id}
            onCheckedChange={checked => void toggleManager(p, checked)}
            aria-label={`Manager: ${p.name}`}
          />
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Data Creazione',
      sortable: true,
      accessor: p => p.created_at?.slice(0, 10) ?? '',
      cell: p => <span className="text-xs text-muted-foreground">{p.created_at?.slice(0, 10) ?? '—'}</span>,
    },
    {
      key: 'azioni',
      header: 'Azioni',
      // stopPropagation: i click/tasti sui pulsanti non devono attivare la riga.
      cell: p => (
        <div className="flex gap-2" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <Button
            onClick={() => openEdit(p)}
            variant="outline"
            size="sm"
            className="px-3 py-1.5 text-xs border border-border font-medium"
          >
            Modifica
          </Button>
          <Button
            onClick={() => setDeleteConfirm(p)}
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
        title="Persone (piattaforma)"
        description="Anagrafica di tutte le persone e ruolo manager; team e ruoli di team si gestiscono nella pagina Team del team"
        actions={(
          <Button onClick={openCreate}>
            <Plus />
            Aggiungi persona
          </Button>
        )}
      />

      {managerError && <p role="alert" className="text-sm font-medium text-destructive">{managerError}</p>}

      <SectionCard title="Persone" description={`${persons.length} persone`} icon={<Users />} bodyClassName="p-0">
        <DataTable
          bare
          data={persons}
          columns={columns}
          getRowId={p => p.id}
          defaultSort="nome"
          searchPlaceholder="Cerca persone…"
          densityStorageKey="project-tracker:admin-persone-density"
          // La tabella non viene smontata durante un ricaricamento: lo stato
          // di caricamento compare solo quando non c'è ancora alcun dato.
          loading={loading && persons.length === 0}
          error={error}
          onRetry={() => void load()}
          onRowActivate={openEdit}
          rowLabel={p => `Modifica ${p.name}`}
          emptyState={persons.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Nessuna persona nel team</p>
              <Button type="button" variant="link" onClick={openCreate} className="font-medium text-primary">
                Aggiungi la prima persona
              </Button>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Nessun risultato per la ricerca.</p>
          )}
        />
      </SectionCard>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(isOpen) => { if (!saving) setShowModal(isOpen); }}>
        <DialogContent aria-describedby={undefined} className="rounded-card sm:max-w-[480px]">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle>{editingId ? 'Modifica Persona' : 'Nuova Persona'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field>
              <FieldLabel>Nome *</FieldLabel>
              <Input
                name="name"
                type="text"
                required
                placeholder="Nome e cognome"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                name="email"
                type="email"
                placeholder="email@azienda.it"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel>Mansione</FieldLabel>
              <Input
                name="jobTitle"
                type="text"
                placeholder="es. Developer, Analyst..."
                value={form.jobTitle}
                onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
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
            <span className="font-medium text-foreground">"{deleteConfirm?.name}"</span>? L'operazione non è reversibile.
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
