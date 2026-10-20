import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { closeTmMonth, getTmBilling, reopenTmMonth } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { TmMonth, TmProject } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { PageHeader } from '@/components/app/PageHeader';
import { StatusBadge } from '@/components/app/StatusBadge';
import { consumptionTone, type Tone } from '@/lib/statusTone';
import { downloadCsv } from '@/lib/csv';
import {
  TM_STATUS_LABEL, breakdownLabel, canCloseMonth, defaultPeriod, formatDays, formatDelta, hasSubprojects,
  plafondPct, toExportRows,
} from '@/lib/tmBilling';

const EUR = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const STATUS_TONE: Record<TmMonth['status'], Tone> = { aperto: 'neutral', fatturato: 'green', rettifica: 'amber' };

interface PendingAction {
  kind: 'close' | 'reopen';
  project: TmProject;
  month: TmMonth;
}

export default function TimeMaterial() {
  const { user } = useAuth();
  const isAdmin = user?.appRole === 'admin';
  const [period, setPeriod] = useState(() => defaultPeriod(new Date()));
  const [projects, setProjects] = useState<TmProject[] | null>(null);
  // Periodo a cui appartengono i dati in tabella: resta quello vecchio se l'ultimo caricamento fallisce.
  const [loadedPeriod, setLoadedPeriod] = useState<typeof period | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requestSeq = useRef(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const toggleExpanded = (projectId: number) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
    return next;
  });

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setError(null);
    try {
      const data = await getTmBilling(period.from, period.to);
      if (seq === requestSeq.current) {
        setProjects(data);
        setLoadedPeriod(period);
      }
    } catch (e) {
      if (seq === requestSeq.current) setError(e instanceof Error ? e.message : 'Errore nel caricamento');
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      if (pending.kind === 'close') await closeTmMonth(pending.project.project_id, pending.month.month);
      else await reopenTmMonth(pending.project.project_id, pending.month.month);
      setPending(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Operazione non riuscita');
    } finally {
      setBusy(false);
    }
  };

  const months = projects?.[0]?.months.map(m => m.month) ?? [];
  const today = new Date();

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Time & Material"
        description="Consuntivo mensile dei progetti T&M, plafond residuo e mesi fatturati."
        actions={(
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground">Da
              <Input type="month" value={period.from} max={period.to}
                onChange={e => e.target.value && setPeriod(p => ({ ...p, from: e.target.value }))} />
            </label>
            <label className="text-xs text-muted-foreground">A
              <Input type="month" value={period.to} min={period.from}
                onChange={e => e.target.value && setPeriod(p => ({ ...p, to: e.target.value }))} />
            </label>
            {isAdmin && projects && projects.length > 0 && loadedPeriod && (
              <Button variant="outline" onClick={() => downloadCsv(`time-material_${loadedPeriod.from}_${loadedPeriod.to}.csv`, toExportRows(projects))}>
                Esporta CSV
              </Button>
            )}
          </div>
        )}
      />

      {error && <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>}
      {!projects && !error && <LoadingState />}
      {projects && projects.length === 0 && (
        <EmptyState title="Nessun progetto Time & Material." description="Imposta la modalità nella configurazione del progetto." />
      )}

      {projects && projects.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Progetto</TableHead>
                {months.map(m => <TableHead key={m} className="min-w-36 text-right">{m}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map(project => {
                const pct = plafondPct(project);
                const isOpen = expanded.has(project.project_id);
                return (
                  <Fragment key={project.project_id}>
                    <TableRow>
                      <TableCell className="align-top">
                        <div className="flex items-start gap-1">
                          {hasSubprojects(project) && (
                            <Button type="button" variant="ghost" size="sm" iconOnly
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? 'Nascondi' : 'Mostra'} il dettaglio dei sotto progetti di ${project.name}`}
                              onClick={() => toggleExpanded(project.project_id)}>
                              {isOpen ? <CaretDown aria-hidden="true" className="size-4" /> : <CaretRight aria-hidden="true" className="size-4" />}
                            </Button>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{project.name}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {formatDays(project.consumed_days)} su {formatDays(project.plafond_days)} · residuo {formatDays(project.residual_days)}
                            </p>
                            {pct !== null && (
                              <Progress className="mt-2 max-w-48" value={Math.min(pct, 100)} size="sm"
                                tone={consumptionTone(pct)} aria-label={`Plafond ${project.name}: ${pct}%`} />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {project.months.map(month => (
                        <TableCell key={month.month} className="align-top text-right tabular-nums">
                          <p className="text-sm text-foreground">{formatDays(month.live_days)}</p>
                          <p className="text-xs text-muted-foreground">{EUR.format(month.amount)}</p>
                          <StatusBadge tone={STATUS_TONE[month.status]} size="sm" className="mt-1">
                            {month.status === 'rettifica' && month.delta_days !== null
                              ? `${TM_STATUS_LABEL.rettifica} ${formatDelta(month.delta_days)}`
                              : TM_STATUS_LABEL[month.status]}
                          </StatusBadge>
                          {isAdmin && month.status === 'aperto' && canCloseMonth(month.month, today) && (
                            <Button size="sm" variant="ghost" className="mt-1"
                              onClick={() => setPending({ kind: 'close', project, month })}>Chiudi mese</Button>
                          )}
                          {isAdmin && month.status !== 'aperto' && (
                            <Button size="sm" variant="ghost" className="mt-1"
                              onClick={() => setPending({ kind: 'reopen', project, month })}>Riapri</Button>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isOpen && project.breakdown.map((entry, index) => (
                      <TableRow key={`${project.project_id}-${entry.project_id}`} className="bg-muted/40">
                        <TableCell className="pl-10 text-sm text-muted-foreground">{breakdownLabel(index, entry.name)}</TableCell>
                        {entry.live_days.map((days, i) => (
                          <TableCell key={project.months[i].month} className="text-right text-sm tabular-nums text-muted-foreground">
                            {formatDays(days)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Le settimane a cavallo di due mesi sono ripartite sui giorni lun–ven; le festività non sono considerate.
        Il dettaglio dei sotto progetti riporta solo giornate: l'importo è fatturato sul progetto padre.
      </p>

      <Dialog open={pending !== null} onOpenChange={open => { if (!open) { setPending(null); setActionError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.kind === 'close' ? 'Chiudi mese' : 'Riapri mese'}</DialogTitle>
            <DialogDescription>
              {pending?.kind === 'close'
                ? `${pending.project.name}, ${pending.month.month}: ${formatDays(pending.month.live_days)} × ${EUR.format(pending.project.daily_rate)} = ${EUR.format(pending.month.amount)}. L'importo verrà congelato come fatturato.`
                : pending ? `${pending.project.name}, ${pending.month.month}: lo snapshot fatturato verrà eliminato e il mese tornerà aperto.` : ''}
            </DialogDescription>
          </DialogHeader>
          {actionError && <ErrorBanner>{actionError}</ErrorBanner>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>Annulla</Button>
            <Button onClick={() => void confirm()} disabled={busy}>
              {pending?.kind === 'close' ? 'Chiudi mese' : 'Riapri'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
