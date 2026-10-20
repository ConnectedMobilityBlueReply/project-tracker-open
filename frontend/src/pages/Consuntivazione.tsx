import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addWeeks, format, startOfWeek } from 'date-fns';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { deleteTimeEntry, getRangeEntries, getSelectableProjects, upsertTimeEntry } from '../api';
import type { RangeRow, SelectableProject } from '../types';
import { useAuth } from '../auth/AuthContext';
import { isWithinHoursLimit, weeklyCapacityHours } from '../lib/workingHours';
import { weekTotalHours } from '../lib/consuntivazioneGrid';
import { shiftRange, weeksInRange } from '../lib/consuntivazioneRange';
import { filterRows } from '../lib/consuntivazioneFilter';
import type { RowFilter } from '../lib/consuntivazioneFilter';
import { buildTimeEntryPayload } from '../lib/consuntivazionePayload';
import { addableActivities, applySavedHours, draftRow, mergeDraftRows } from '../lib/consuntivazioneOptimistic';
import { daysToHours } from '../lib/units';
import type { Density } from '../components/schedule/ScheduleToolbar';
import ConsuntivazioneGrid, { cellKey } from '../components/consuntivazione/ConsuntivazioneGrid';
import type { CellSaveState } from '../components/consuntivazione/ConsuntivazioneCell';
import EntryModal from '../components/consuntivazione/EntryModal';
import AddActivityRow from '../components/consuntivazione/AddActivityRow';
import TimelineToolbar from '../components/timeline/TimelineToolbar';

const ROW_FILTER_LABELS: Record<RowFilter, string> = {
  'all': 'Tutte le voci',
  'with-days': 'Con ore',
  'over-budget': 'Sopra stima',
};

const DENSITY_KEY = 'consuntivazione.density';

export default function Consuntivazione() {
  const { user } = useAuth();

  const [params, setParams] = useSearchParams();
  const defaultFrom = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const from = params.get('from') ?? defaultFrom;
  const to = params.get('to') ?? format(addWeeks(new Date(from), 5), 'yyyy-MM-dd');
  const weeks = weeksInRange(from, to);

  const [rows, setRows] = useState<RangeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, CellSaveState>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [detail, setDetail] = useState<{ row: RangeRow; weekStart: string } | null>(null);
  const [tableQuery, setTableQuery] = useState('');
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');

  // La densita' e' una preferenza di lettura, non una coordinata da condividere
  // in un link: resta stato locale invece di finire nei parametri dell'URL.
  const [density, setDensity] = useState<Density>(() => {
    try { return (localStorage.getItem(DENSITY_KEY) as Density | null) ?? 'comfortable'; }
    catch { return 'comfortable'; }
  });

  const [selectableProjects, setSelectableProjects] = useState<SelectableProject[]>([]);
  // Righe aggiunte con "Aggiungi attività" e non ancora salvate: restano locali finche' non si scrive una cella.
  const [drafts, setDrafts] = useState<RangeRow[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  // Solo l'ultima load() scrive le righe: una GET lenta non deve sovrascrivere dati piu' recenti.
  const loadSeqRef = useRef(0);
  // Intervallo corrente: un salvataggio partito su un intervallo precedente non tocca la griglia attuale.
  const rangeKeyRef = useRef(`${from}|${to}`);
  // Variazione di ore (nuove - precedenti) dei salvataggi in volo, per cella: serve alla validazione di capacita'.
  const pendingDeltaRef = useRef<Record<string, number>>({});

  const loadSelectableProjects = useCallback(async () => {
    try {
      const projects = await getSelectableProjects();
      setSelectableProjects(projects);
      setProjectsError(null);
    } catch {
      setProjectsError('Errore nel caricamento dei progetti selezionabili');
    }
  }, []);

  useEffect(() => {
    void loadSelectableProjects();
  }, [loadSelectableProjects]);

  const load = useCallback(async () => {
    if (user == null) return;
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    const isCurrent = () => loadSeqRef.current === seq;
    setLoading(true);
    try {
      const data = await getRangeEntries(user.personId, from, to);
      if (!isCurrent()) return;
      setRows(data);
      setDrafts([]);
      setError(null);
    } catch (caught) {
      if (!isCurrent()) return;
      setError(caught instanceof Error ? caught.message : 'Caricamento non riuscito');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [user, from, to]);

  useEffect(() => { void load(); }, [load]);

  // Le celle di un intervallo non esistono piu' quando l'intervallo cambia:
  // senza questo, saveStates e cellErrors accumulano voci per chiavi che la
  // griglia non mostra piu'.
  useEffect(() => {
    rangeKeyRef.current = `${from}|${to}`;
    pendingDeltaRef.current = {};
    setSaveStates({});
    setCellErrors({});
    setDrafts([]);
  }, [from, to]);

  // Contatore per cella: se l'utente modifica due volte di seguito la stessa
  // cella, solo l'ultima chiamata puo' scrivere lo stato a schermo — una
  // risposta lenta della prima non deve rimettere a schermo un valore vecchio.
  // Stesso principio delle guardie anti-race di Schedule/TimelineTeamWeekly,
  // qui per singola cella invece che per vista.
  const commitSeqRef = useRef<Record<string, number>>({});

  const gridRows = mergeDraftRows(filterRows(rows, weeks, tableQuery, rowFilter), drafts);
  const allRows = mergeDraftRows(rows, drafts);
  const activities = addableActivities(selectableProjects, allRows);

  const commitCell = async (row: RangeRow, weekStart: string, hours: number) => {
    if (user == null) return;
    const key = cellKey(row.key, weekStart);
    const seq = (commitSeqRef.current[key] ?? 0) + 1;
    commitSeqRef.current[key] = seq;
    const isLatest = () => commitSeqRef.current[key] === seq;
    const rangeAtCommit = rangeKeyRef.current;
    // Il risultato conta solo se e' l'ultimo della cella e l'intervallo non e' cambiato nel frattempo.
    const isCurrent = () => isLatest() && rangeKeyRef.current === rangeAtCommit;

    // Validazione di capacita' prima del POST: somma anche i salvataggi in volo delle altre celle della settimana.
    const previousHours = daysToHours(row.weeks[weekStart]?.man_days ?? 0);
    const capacityHours = weeklyCapacityHours(weekStart);
    const otherHours = weekTotalHours(rows, weekStart) - previousHours;
    const inFlightHours = Object.entries(pendingDeltaRef.current)
      .filter(([otherKey]) => otherKey !== key && otherKey.endsWith(`|${weekStart}`))
      .reduce((sum, [, delta]) => sum + delta, 0);
    delete pendingDeltaRef.current[key];
    if (!isWithinHoursLimit(hours, capacityHours) || otherHours + inFlightHours + hours > capacityHours) {
      setSaveStates(current => ({ ...current, [key]: 'error' }));
      setCellErrors(current => ({
        ...current,
        [key]: `Il totale della settimana supera le ${capacityHours} ore disponibili`,
      }));
      return;
    }

    setSaveStates(current => ({ ...current, [key]: 'saving' }));
    setCellErrors(current => { const next = { ...current }; delete next[key]; return next; });
    pendingDeltaRef.current[key] = hours - previousHours;
    const loadSeqAtSave = loadSeqRef.current;
    try {
      const saved = await upsertTimeEntry(buildTimeEntryPayload({
        personId: user.personId,
        taskId: row.task_id,
        weekStart,
        hours,
        wbsItemId: row.wbs_item_id,
        notes: row.weeks[weekStart]?.notes,
      }));
      // Una modifica piu' recente sulla stessa cella o un cambio di intervallo: il risultato e' superato.
      if (!isCurrent()) return;
      setSaveStates(current => ({ ...current, [key]: 'saved' }));
      // Niente reload: si aggiorna la sola cella. Una bozza salvata entra fra le righe vere.
      setRows(current => applySavedHours(
        current.some(r => r.key === row.key) ? current : [...current, row],
        row.key, weekStart, hours, saved?.id ?? null,
      ));
      setDrafts(current => current.filter(draft => draft.key !== row.key));
      // Una load() partita prima del POST porterebbe il valore vecchio: la si invalida e si rilascia il loading.
      // Una partita durante il POST (es. salvataggio dal dettaglio) puo' non vedere questa scrittura: la si rifa'.
      if (loadSeqRef.current === loadSeqAtSave) {
        loadSeqRef.current += 1;
        setLoading(false);
      } else {
        void load();
      }
    } catch (caught) {
      if (!isCurrent()) return;
      setSaveStates(current => ({ ...current, [key]: 'error' }));
      setCellErrors(current => ({
        ...current,
        [key]: caught instanceof Error ? caught.message : 'Salvataggio non riuscito',
      }));
    } finally {
      if (isLatest()) delete pendingDeltaRef.current[key];
    }
  };

  const handleShiftRange = (direction: -1 | 1) => {
    setParams(shiftRange(from, to, weeks.length, direction));
  };

  const changeDensity = (next: Density) => {
    setDensity(next);
    try { localStorage.setItem(DENSITY_KEY, next); }
    catch { /* preferenza non persistita */ }
  };

  return (
    <div className="space-y-4 p-4">
      <TimelineToolbar
        title="Consuntivazione"
        count={gridRows.length}
        right={(
          <>
            <Input
              value={tableQuery}
              onChange={event => setTableQuery(event.target.value)}
              placeholder="Cerca progetto, attività o componente…"
              aria-label="Cerca progetto, attività o componente"
              className="h-8 w-72"
            />
            <Select value={rowFilter} onValueChange={value => setRowFilter(value as RowFilter)}>
              <SelectTrigger className="h-8 w-44" aria-label="Filtra consuntivazioni">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROW_FILTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={density === 'compact'}
              onClick={() => changeDensity(density === 'compact' ? 'comfortable' : 'compact')}
            >
              {density === 'compact' ? 'Densità ampia' : 'Densità compatta'}
            </Button>
          </>
        )}
      />

      {projectsError && (
        <ErrorBanner onRetry={() => void loadSelectableProjects()}>{projectsError}</ErrorBanner>
      )}
      {error && (
        <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>
      )}

      {loading && rows.length === 0 && (
        <LoadingState label="Caricamento delle consuntivazioni…" />
      )}

      <ConsuntivazioneGrid
        rows={gridRows}
        totalsRows={allRows}
        weeks={weeks}
        density={density}
        saveStates={saveStates}
        cellErrors={cellErrors}
        emptyMessage={rows.length === 0
          ? 'Nessun task assegnato a questa persona'
          : 'Nessuna voce corrisponde alla ricerca o al filtro'}
        busy={loading}
        controls={(
          <>
            <Button iconOnly variant="outline" aria-label="Intervallo precedente" onClick={() => handleShiftRange(-1)}>
              <CaretLeft className="h-4 w-4" />
            </Button>
            <Button iconOnly variant="outline" aria-label="Intervallo successivo" onClick={() => handleShiftRange(1)}>
              <CaretRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setParams({
                from: defaultFrom,
                to: format(addWeeks(new Date(defaultFrom), 5), 'yyyy-MM-dd'),
              })}
            >
              Oggi
            </Button>
            <span className="text-sm font-medium text-foreground">{from} → {to}</span>
          </>
        )}
        addRow={(
          <AddActivityRow
            activities={activities}
            disabled={loading}
            error={projectsError}
            onRetry={() => void loadSelectableProjects()}
            onAdd={activity => setDrafts(current => [...current, draftRow(activity)])}
            hint={user?.appRole === 'member'
              ? 'Nessuna attività. Vedi solo i progetti a cui sei assegnato: se ne manca uno, contatta il PM.'
              : 'Nessuna attività trovata.'}
          />
        )}
        onCommit={commitCell}
        onOpenDetail={(row, weekStart) => setDetail({ row, weekStart })}
      />

      <EntryModal
        open={detail != null}
        row={detail?.row ?? null}
        weekStart={detail?.weekStart ?? null}
        onClose={() => setDetail(null)}
        onSave={async (row, weekStart, hours, notes) => {
          if (user == null) return;
          await upsertTimeEntry(buildTimeEntryPayload({
            personId: user.personId,
            taskId: row.task_id,
            weekStart,
            hours,
            wbsItemId: row.wbs_item_id,
            notes,
          }));
          await load();
        }}
        onDelete={async entryId => { await deleteTimeEntry(entryId); await load(); }}
      />
    </div>
  );
}
