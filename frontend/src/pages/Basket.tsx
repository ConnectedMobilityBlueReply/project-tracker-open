import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { X } from '@phosphor-icons/react';
import { getBaskets, createBasket, createBasketMovement, deleteBasketMovement } from '../api';
import { BasketMovement, BasketSummary } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { PageHeader } from '@/components/app/PageHeader';
import { consumptionTone } from '@/lib/statusTone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatPeriod(period: string): string {
  return format(new Date(period + 'T00:00:00'), 'MMMM yyyy', { locale: it });
}

interface MovementFormState {
  movement_date: string;
  azione: string;
  attivita: string;
  giornate: string;
  stato_lavori: string;
  note: string;
}

const emptyMovementForm = (): MovementFormState => ({
  movement_date: new Date().toISOString().slice(0, 10),
  azione: '',
  attivita: '',
  giornate: '',
  stato_lavori: '',
  note: '',
});

function formatGiornate(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}gg`;
}

type MovementField = keyof MovementFormState;

// Validazione pura del movimento: restituisce un errore per campo vuoto,
// cosi' il form puo' mostrarlo inline accanto al campo sbagliato invece
// di un banner globale generico.
function validateMovement(form: MovementFormState): Partial<Record<MovementField, string>> {
  const errors: Partial<Record<MovementField, string>> = {};
  if (!form.movement_date) errors.movement_date = 'Inserisci la data';
  if (!form.azione.trim()) errors.azione = 'Inserisci l\'azione';
  const giornate = Number(form.giornate);
  if (!Number.isFinite(giornate) || giornate === 0) {
    errors.giornate = 'Numero di giornate diverso da zero (+ credito, \u2212 consumo)';
  }
  return errors;
}

export default function Basket() {
  const [baskets, setBaskets] = useState<BasketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [forms, setForms] = useState<Record<string, MovementFormState>>({});
  const [formErrors, setFormErrors] = useState<Record<string, Partial<Record<MovementField, string>>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ basket: string; movement: BasketMovement } | null>(null);
  const [newBasketName, setNewBasketName] = useState('');
  const [creatingBasket, setCreatingBasket] = useState(false);

  // `loading` e' solo il caricamento iniziale (spinner a tutta pagina);
  // i ricaricamenti successivi (dopo aggiunta/eliminazione) usano `refreshing`
  // e non smontano la pagina, conservando scroll e focus.
  const load = useCallback(async (opts?: { initial?: boolean }) => {
    const initial = opts?.initial ?? false;
    if (initial) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      setBaskets(await getBaskets());
    } catch {
      setError('Errore nel caricamento dei basket');
    } finally {
      if (initial) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load({ initial: true }); }, [load]);

  const toggleExpand = (basket: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(basket)) next.delete(basket); else next.add(basket);
      return next;
    });
  };

  const getForm = (basket: string) => forms[basket] ?? emptyMovementForm();

  const setForm = (basket: string, patch: Partial<MovementFormState>) => {
    setForms(prev => ({ ...prev, [basket]: { ...getForm(basket), ...patch } }));
  };

  const clearFieldError = (basket: string, field: MovementField) => {
    setFormErrors(prev => {
      const current = prev[basket];
      if (!current || !(field in current)) return prev;
      const next = { ...current };
      delete next[field];
      return { ...prev, [basket]: next };
    });
  };

  const handleAddMovement = async (basket: string) => {
    const form = getForm(basket);
    const errors = validateMovement(form);
    if (Object.keys(errors).length > 0) {
      // Errori mostrati inline, sul campo sbagliato, non in banner globale.
      setFormErrors(prev => ({ ...prev, [basket]: errors }));
      return;
    }
    setFormErrors(prev => ({ ...prev, [basket]: {} }));
    setSaving(s => ({ ...s, [basket]: true }));
    setError(null);
    try {
      await createBasketMovement({
        basket,
        movement_date: form.movement_date,
        azione: form.azione.trim(),
        attivita: form.attivita.trim() || undefined,
        giornate: Number(form.giornate),
        stato_lavori: form.stato_lavori.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      setForms(prev => ({ ...prev, [basket]: emptyMovementForm() }));
      await load();
    } catch (err: any) {
      setError(err.message || 'Errore nell\'aggiunta del movimento');
    } finally {
      setSaving(s => ({ ...s, [basket]: false }));
    }
  };

  const handleCreateBasket = async (event: FormEvent) => {
    event.preventDefault();
    const name = newBasketName.trim();
    if (!name) return;
    setCreatingBasket(true);
    setError(null);
    try {
      await createBasket(name);
      setNewBasketName('');
      setExpanded(prev => new Set(prev).add(name));
      await load();
    } catch (err: any) {
      setError(err.message || 'Errore nella creazione del basket');
    } finally {
      setCreatingBasket(false);
    }
  };

  const handleDeleteMovement = async () => {
    const target = deleteTarget;
    if (target == null) return;
    try {
      await deleteBasketMovement(target.movement.id);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Errore nella rimozione del movimento');
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return <LoadingState className="h-full min-h-64" />;
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Basket Giornate"
        description={(
          <>
            Monte-giorni condivisi da cui alcuni progetti scalano invece di essere offertati singolarmente.
            {' '}I progetti area AM scalano live, mese per mese, dai consuntivi reali. Gli altri progetti collegati scalano
            in un'unica riga per l'intera stima (giorni offertati), indipendentemente da quanto è stato consuntivato.
          </>
        )}
        actions={(
          <form onSubmit={handleCreateBasket} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={newBasketName}
              onChange={e => setNewBasketName(e.target.value)}
              placeholder="Nome nuovo basket (es. ISE)"
              aria-label="Nome nuovo basket"
              maxLength={100}
              className="sm:w-72"
            />
            <Button type="submit" size="sm" disabled={creatingBasket || !newBasketName.trim()}>
              {creatingBasket ? 'Creazione…' : 'Crea basket'}
            </Button>
          </form>
        )}
      />

      {refreshing && (
        <LoadingState label="Aggiornamento…" className="justify-start py-2" />
      )}

      {error && <ErrorBanner onRetry={() => load()}>{error}</ErrorBanner>}

      <div className="space-y-4">
        {baskets.length === 0 && !error ? (
          <EmptyState title="Nessun basket configurato." />
        ) : baskets.map(b => {
          const isExpanded = expanded.has(b.basket);
          const form = getForm(b.basket);
          const ratio = b.totale > 0 ? Math.min(b.erogato / b.totale, 1) : 0;
          const over = b.residuo < 0;

          return (
            <section key={b.basket} className={`overflow-hidden rounded-card border bg-card shadow-xs ${isExpanded ? 'border-primary/50 shadow-sm' : 'border-border'}`}>
              <button
                type="button"
                className="grid w-full grid-cols-[1fr_auto] items-center gap-5 px-5 py-4 text-left hover:bg-background"
                onClick={() => toggleExpand(b.basket)}
                aria-expanded={isExpanded}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                    <span className="truncate font-display text-base font-semibold text-foreground">{b.basket}</span>
                  </div>
                  <Progress
                    className="ml-6 mt-2 max-w-md"
                    value={ratio * 100}
                    size="sm"
                    tone={consumptionTone(ratio * 100)}
                    aria-label={`Consumo ${b.basket}`}
                  />
                </div>
                <div className="flex items-center gap-6 text-right tabular-nums">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Totale</p>
                    <p className="text-sm font-semibold text-foreground">{b.totale}gg</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Erogato</p>
                    <p className="text-sm font-semibold text-foreground">{b.erogato}gg</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Residuo</p>
                    <p className={`text-lg font-semibold ${over ? 'text-destructive' : 'text-foreground'}`}>{b.residuo}gg</p>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border bg-background/40 px-5 py-5 space-y-5">
                  {b.linked_projects.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Progetti collegati</p>
                      <div className="space-y-1.5">
                        {b.linked_projects.map(lp => (
                          <div key={`${lp.project_id}_${lp.period ?? 'stima'}`} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Link to={`/progetti/${lp.project_id}`} className="text-sm text-primary hover:underline truncate">{lp.project_name}</Link>
                              {lp.period ? (
                                <span className="text-xs text-muted-foreground capitalize">— consuntivo {formatPeriod(lp.period)}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">— stima intera del progetto</span>
                              )}
                            </div>
                            <span className="text-sm font-medium tabular-nums text-foreground shrink-0">-{lp.consumo}gg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Movimenti manuali</p>
                    {b.movements.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic mb-3">Nessun movimento manuale</p>
                    ) : (
                      <div className="mb-3">
                        <Table className="min-w-full text-sm">
                          <TableHeader>
                            <TableRow className="text-left text-xs text-muted-foreground">
                              <TableHead className="h-auto text-muted-foreground py-1.5 pr-3 pl-0 font-medium">Data</TableHead>
                              <TableHead className="h-auto text-muted-foreground py-1.5 pr-3 pl-0 font-medium">Azione</TableHead>
                              <TableHead className="h-auto text-muted-foreground py-1.5 pr-3 pl-0 font-medium">Attività</TableHead>
                              <TableHead className="h-auto text-muted-foreground py-1.5 pr-3 pl-0 text-right font-medium">Giornate</TableHead>
                              <TableHead className="h-auto text-muted-foreground py-1.5 pr-3 pl-0 font-medium">Stato Lavori</TableHead>
                              <TableHead className="h-auto text-muted-foreground py-1.5 pr-3 pl-0 font-medium">Note</TableHead>
                              <TableHead className="h-auto text-muted-foreground py-1.5 pl-0" />
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-border">
                            {b.movements.map(m => (
                              <TableRow key={m.id}>
                                <TableCell className="p-0 py-1.5 pr-3 text-foreground">{m.movement_date}</TableCell>
                                <TableCell className="p-0 py-1.5 pr-3 text-foreground">{m.azione}</TableCell>
                                <TableCell className="p-0 py-1.5 pr-3 whitespace-normal text-foreground">{m.attivita || '—'}</TableCell>
                                <TableCell className={`p-0 py-1.5 pr-3 text-right font-medium tabular-nums ${m.giornate < 0 ? 'text-destructive' : 'text-success'}`}>
                                  {formatGiornate(m.giornate)}
                                </TableCell>
                                <TableCell className="p-0 py-1.5 pr-3 whitespace-normal text-foreground">{m.stato_lavori || '—'}</TableCell>
                                <TableCell className="p-0 py-1.5 pr-3 whitespace-normal text-foreground">{m.note || '—'}</TableCell>
                                <TableCell className="p-0 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ basket: b.basket, movement: m })}
                                    className="text-destructive hover:text-destructive/80 transition-colors"
                                    aria-label={`Elimina movimento del ${m.movement_date}`}
                                  >
                                    <X className="size-4" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    <div className="grid grid-cols-2 items-end gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-6">
                      <div className="col-span-1">
                        <label className="block text-[11px] font-medium text-foreground mb-1">Data</label>
                        <input
                          type="date"
                          value={form.movement_date}
                          aria-invalid={!!formErrors[b.basket]?.movement_date}
                          onChange={e => { setForm(b.basket, { movement_date: e.target.value }); clearFieldError(b.basket, 'movement_date'); }}
                          className={`w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary ${formErrors[b.basket]?.movement_date ? 'border-destructive' : 'border-border'}`}
                        />
                        {formErrors[b.basket]?.movement_date && (
                          <p className="mt-1 text-[11px] text-destructive">{formErrors[b.basket].movement_date}</p>
                        )}
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[11px] font-medium text-foreground mb-1">Azione</label>
                        <input
                          type="text"
                          placeholder="Allocazione, Consumo…"
                          value={form.azione}
                          aria-invalid={!!formErrors[b.basket]?.azione}
                          onChange={e => { setForm(b.basket, { azione: e.target.value }); clearFieldError(b.basket, 'azione'); }}
                          className={`w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary ${formErrors[b.basket]?.azione ? 'border-destructive' : 'border-border'}`}
                        />
                        {formErrors[b.basket]?.azione && (
                          <p className="mt-1 text-[11px] text-destructive">{formErrors[b.basket].azione}</p>
                        )}
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[11px] font-medium text-foreground mb-1">Attività</label>
                        <input
                          type="text"
                          value={form.attivita}
                          onChange={e => setForm(b.basket, { attivita: e.target.value })}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[11px] font-medium text-foreground mb-1">Giornate</label>
                        <input
                          type="number"
                          step="0.25"
                          placeholder="+/- gg"
                          value={form.giornate}
                          aria-invalid={!!formErrors[b.basket]?.giornate}
                          onChange={e => { setForm(b.basket, { giornate: e.target.value }); clearFieldError(b.basket, 'giornate'); }}
                          className={`w-full rounded-md border bg-background px-2 py-1.5 text-sm text-right text-foreground outline-none focus:border-primary ${formErrors[b.basket]?.giornate ? 'border-destructive' : 'border-border'}`}
                        />
                        {formErrors[b.basket]?.giornate && (
                          <p className="mt-1 text-[11px] text-destructive">{formErrors[b.basket].giornate}</p>
                        )}
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[11px] font-medium text-foreground mb-1">Note</label>
                        <input
                          type="text"
                          value={form.note}
                          onChange={e => setForm(b.basket, { note: e.target.value })}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAddMovement(b.basket)}
                          disabled={saving[b.basket]}
                          className="w-full"
                        >
                          {saving[b.basket] ? 'Aggiungo…' : 'Aggiungi'}
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Giornate positive = credito (allocazione/aggiunta). Giornate negative = consumo manuale.</p>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-card sm:max-w-[480px]">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle>Elimina movimento</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            {deleteTarget && (
              <>
                Eliminare il movimento del <strong>{deleteTarget.movement.movement_date}</strong> su
                {' '}«{deleteTarget.basket}» — {deleteTarget.movement.azione}
                {' '}({formatGiornate(deleteTarget.movement.giornate)})? L'operazione è irreversibile.
              </>
            )}
          </DialogDescription>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Annulla</Button>
            <Button type="button" variant="destructive" className="flex-1" onClick={() => void handleDeleteMovement()}>Elimina</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
