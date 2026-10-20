import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllocationTotals, getProjects, getProjectTasks, getSchedule, upsertAllocationWeek } from '../../api';
import type { ProjectTask, ScheduleData } from '../../types';
import { filterSchedule, mondayOfIso, monthWeeksOf, sortPersons, weekStartsBetween } from '../../lib/scheduleModel';
import type { ScheduleFilters, SortKey } from '../../lib/scheduleModel';
import { personRows, projectRows } from '../../lib/scheduleRows';
import type { ScheduleRowModel } from '../../lib/scheduleRows';
import { addDaysIso } from '../../lib/capacity';
import type { Density, ScheduleView, Zoom } from './ScheduleToolbar';

const WEEKS_SHOWN = 8;
const DENSITY_KEY = 'schedule.density';
const SORT_KEYS: SortKey[] = ['name', 'unscheduled', 'utilization'];

// Contatore monotono (mai azzerato tra chiamate) per gli id provvisori delle card ottimistiche, cosi' due estensioni ravvicinate non collidono.
let nextPlaceholderId = 0;

/** Id provvisorio per una card ottimistica: negativo e mai riusato. */
export const newPlaceholderId = (): number => --nextPlaceholderId;

/** Oggi in ISO sul calendario locale: `toISOString()` darebbe la data UTC, che a notte fonda sposterebbe la vista di una settimana. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function useScheduleData(canWrite: boolean) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projectTotals, setProjectTotals] = useState<Record<number, number>>({});

  // La densità è una preferenza personale, non parte della vista condivisibile.
  const [density, setDensity] = useState<Density>(
    () => (localStorage.getItem(DENSITY_KEY) as Density | null) ?? 'comfortable');

  const defaultFrom = mondayOfIso(todayIso());

  // L'URL è input non fidato: qualunque valore diverso da 'project' ricade
  // sulla vista per persona invece di lasciare la griglia senza righe.
  const view: ScheduleView = canWrite && params.get('view') === 'project' ? 'project' : 'person';
  const projectParam = Number(params.get('project'));
  const projectId = Number.isInteger(projectParam) && projectParam > 0 ? projectParam : null;

  // Agganciato al lunedì qui e non più in basso: la griglia lo aggancia comunque
  // dentro weekStartsBetween, e se la fetch partisse dal giorno grezzo la prima
  // colonna verrebbe disegnata senza i suoi dati — mostrando 0% al posto del
  // lavoro pianificato.
  const from = mondayOfIso(params.get('from') ?? defaultFrom);
  // La vista per progetto mostra le settimane del mese che contiene `from`:
  // `from` resta uno solo, così cambiare vista non perde il punto in cui si
  // stava guardando. L'intervallo della fetch segue le settimane visibili,
  // altrimenti le prime colonne del mese risulterebbero vuote per finta.
  const weeks = view === 'project'
    ? monthWeeksOf(from)
    : weekStartsBetween(from, params.get('to') ?? addDaysIso(from, WEEKS_SHOWN * 7));
  const rangeFrom = weeks[0];
  const rangeTo = addDaysIso(weeks[weeks.length - 1], 7);
  const to = view === 'project' ? rangeTo : (params.get('to') ?? addDaysIso(from, WEEKS_SHOWN * 7));
  const zoom = (params.get('zoom') as Zoom | null) ?? 'weeks';

  const parseIds = (key: string): number[] =>
    (params.get(key) ?? '').split(',').filter(Boolean).map(Number).filter(Number.isFinite);

  const filters: ScheduleFilters = {
    projectIds: parseIds('projects'),
    personIds: parseIds('persons'),
    teamIds: parseIds('teams'),
    hideEmpty: params.get('hideEmpty') === '1',
  };

  // L'URL è input non fidato: un valore fuori da SORT_KEYS ricade su 'name'
  // invece di lasciare la <select> senza voce selezionata e sortPersons
  // sul ramo 'utilization' per esclusione.
  const sortParam = params.get('sort');
  const sort = {
    key: SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'name',
    descending: params.get('sortDir') === 'desc',
  };

  // Solo la vista per progetto: stessa ricerca testuale della vecchia
  // Pianificazione, ma sulle righe già costruite invece che dentro filterSchedule.
  const search = params.get('search') ?? '';

  const load = useCallback((): Promise<void> => {
    setLoading(true);
    setError(null);
    return getSchedule(rangeFrom, rangeTo)
      .then(setData)
      .catch((err: Error) => setError(err.message || 'Caricamento non riuscito'))
      .finally(() => setLoading(false));
  }, [rangeFrom, rangeTo]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (view !== 'project') return;
    // getProjects() esclude già i progetti virtuali per default.
    getProjects()
      .then(all => setProjects(all.map(project => ({ id: project.id, name: project.name }))))
      .catch(() => setProjects([]));
  }, [view]);

  const loadProject = useCallback(() => {
    if (view !== 'project' || projectId == null) {
      setProjectTasks([]);
      setProjectTotals({});
      return;
    }
    void Promise.all([getProjectTasks(projectId), getAllocationTotals(projectId)])
      .then(([tasks, totals]) => {
        setProjectTasks(tasks);
        setProjectTotals(Object.fromEntries(totals.map(t => [t.task_allocation_id, t.total_days])));
      })
      .catch((err: Error) => setError(err.message || 'Caricamento del progetto non riuscito'));
  }, [view, projectId]);

  useEffect(loadProject, [loadProject]);

  const updateParams = (next: Record<string, string>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) merged.set(key, value);
    setParams(merged, { replace: true });
  };

  const changeDensity = (next: Density) => {
    setDensity(next);
    localStorage.setItem(DENSITY_KEY, next);
  };

  const filtered = data
    ? filterSchedule(data, filters, weeks)
    : { persons: [], allocations: [], unplanned: [] };

  const visiblePersons = data
    ? sortPersons(filtered.persons, {
        key: sort.key,
        descending: sort.descending,
        allocations: filtered.allocations,
        timeOff: data.time_off,
        weeks,
        otherTeamLoad: data.other_team_load ?? [],
      })
    : [];

  // La vista per progetto non passa da `filterSchedule`: i filtri della
  // toolbar selezionano persone e allocazioni della vista per persona. Nella
  // vista per progetto il filtro è il progetto scelto, e le righe vengono
  // dalle sue `task_allocations` — non dalle allocazioni settimanali, che
  // possono essere zero per una riga che deve comunque comparire.
  const projectRowsUnfiltered = view === 'project'
    ? projectRows(projectTasks, data?.persons ?? [], data?.allocations ?? [], projectTotals)
    : [];
  // Ricerca testuale sulla vista per progetto: `label` è l'attività, `subLabel`
  // la persona — cioè "task o persona", come nella vecchia Pianificazione.
  const normalizedSearch = search.trim().toLocaleLowerCase('it');
  const projectRowsFiltered = normalizedSearch
    ? projectRowsUnfiltered.filter(row =>
        `${row.label} ${row.subLabel ?? ''}`.toLocaleLowerCase('it').includes(normalizedSearch))
    : projectRowsUnfiltered;

  const rows: ScheduleRowModel[] = view === 'project'
    ? projectRowsFiltered
    : personRows(visiblePersons, filtered.allocations, filtered.unplanned);

  // Solo i progetti presenti nel periodo caricato: un filtro con progetti
  // assenti dalla vista non serve a nessuno.
  const projectOptions = data
    ? [...new Map(data.allocations.map(a => [a.project_id, a.project_name])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name, 'it'))
    : [];

  const changeFilters = (next: ScheduleFilters) => {
    const merged = new URLSearchParams(params);
    const setList = (key: string, ids: number[]) => {
      if (ids.length === 0) merged.delete(key);
      else merged.set(key, ids.join(','));
    };
    setList('projects', next.projectIds);
    setList('persons', next.personIds);
    setList('teams', next.teamIds);
    if (next.hideEmpty) merged.set('hideEmpty', '1');
    else merged.delete('hideEmpty');
    setParams(merged, { replace: true });
  };

  /**
   * Sposta l'allocazione subito nello stato locale, poi salva. Un fallimento
   * riporta la griglia allo stato precedente e scrive l'errore sulla riga:
   * stesso pattern di TimelineTeamWeekly con saveStates/rowErrors.
   *
   * Lo spostamento su un'altra persona non è supportato qui: richiederebbe
   * una `task_allocation` per la persona di destinazione, che si crea
   * assegnando dalla cella di destinazione.
   */
  const moveAllocation = async (
    allocationId: number, personId: number, weekStart: string, rowKey: string,
  ) => {
    if (!data) return;
    const moving = data.allocations.find(a => a.id === allocationId);
    if (!moving || (moving.person_id === personId && moving.week_start === weekStart)) return;

    if (moving.person_id !== personId) {
      setRowErrors(current => ({
        ...current,
        [rowKey]: 'Per assegnare un’altra persona, apri la cella di destinazione',
      }));
      return;
    }

    const occupied = data.allocations.some(a =>
      a.task_allocation_id === moving.task_allocation_id && a.week_start === weekStart);
    if (occupied) {
      setRowErrors(current => ({
        ...current,
        [rowKey]: 'La settimana ha già un’allocazione per questo progetto',
      }));
      return;
    }

    const previous = data;
    const origin = moving.week_start;
    setData({
      ...data,
      allocations: data.allocations.map(a =>
        a.id === allocationId ? { ...a, week_start: weekStart } : a),
    });
    setRowErrors(current => {
      const next = { ...current };
      delete next[rowKey];
      return next;
    });

    try {
      await upsertAllocationWeek({
        task_allocation_id: moving.task_allocation_id,
        week_start: weekStart,
        man_days: moving.man_days,
        tentative: moving.tentative,
      });
      await upsertAllocationWeek({
        task_allocation_id: moving.task_allocation_id,
        week_start: origin,
        man_days: 0,
      });
      load();
    } catch (err) {
      setData(previous);
      setRowErrors(current => ({
        ...current,
        [rowKey]: (err as Error).message || 'Spostamento non riuscito',
      }));
      // Un fallimento a metà lascia il server in uno stato che `previous` non
      // descrive: la verità la porta il ricaricamento, non il rollback.
      load();
    }
  };

  /**
   * Estende l'allocazione dalla sua settimana fino a quella di rilascio
   * inclusa, con lo stesso `man_days` su ognuna: un upsert per settimana
   * coperta, come per lo spostamento.
   *
   * Solo in avanti. Trascinare il bordo all'indietro non accorcia: ridurre
   * si fa portando `man_days` a zero dalla modale, che è esplicito e
   * reversibile.
   */
  const extendAllocation = async (
    allocationId: number, personId: number, weekStart: string, rowKey: string,
  ) => {
    if (!data) return;
    const source = data.allocations.find(a => a.id === allocationId);
    if (!source || source.week_start >= weekStart) return;

    // Un upsert su una settimana già allocata la sostituisce (UNIQUE su
    // task_allocation_id + week_start): estendere copre i buchi, non riscrive
    // il lavoro già pianificato.
    const occupied = new Set(data.allocations
      .filter(a => a.task_allocation_id === source.task_allocation_id)
      .map(a => a.week_start));
    const covered = [
      ...weekStartsBetween(source.week_start, weekStart).filter(w => w > source.week_start),
      weekStart,
    ].filter(week => !occupied.has(week));

    if (covered.length === 0) {
      setRowErrors(current => ({
        ...current,
        [rowKey]: 'Le settimane coperte hanno già un’allocazione per questo progetto',
      }));
      return;
    }

    const previous = data;
    const added = covered.map((week) => ({
      ...source,
      id: --nextPlaceholderId, // id provvisorio: il ricaricamento porta quelli veri
      week_start: week,
    }));
    setData({ ...data, allocations: [...data.allocations, ...added] });
    setRowErrors(current => {
      const next = { ...current };
      delete next[rowKey];
      return next;
    });

    try {
      for (const week of covered) {
        await upsertAllocationWeek({
          task_allocation_id: source.task_allocation_id,
          week_start: week,
          man_days: source.man_days,
          tentative: source.tentative,
        });
      }
      load();
    } catch (err) {
      setData(previous);
      setRowErrors(current => ({
        ...current,
        [rowKey]: (err as Error).message || 'Estensione non riuscita',
      }));
      // Un fallimento a metà lascia il server in uno stato che `previous` non
      // descrive: la verità la porta il ricaricamento, non il rollback.
      load();
    }
  };

  return {
    view, projectId,
    from, to, rangeFrom, weeks,
    zoom, filters,
    sort, search,
    density, changeDensity,
    updateParams, changeFilters,
    data, setData, error, loading,
    load, loadProject,
    projects, projectOptions,
    rows, projectRowsUnfiltered,
    rowErrors, setRowErrors,
    moveAllocation, extendAllocation,
  };
}
