import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, getPlanningWbs, patchWbsProgress } from '../api';
import type { WbsPlanningItem, WbsProgressPatch } from '../types';
import { useAuth } from '../auth/AuthContext';
import { roleAtLeast } from '../auth/routeAccess';
import {
  filterPlanning, localTodayIso, personOptions, positiveIntOrNull, projectOptions, withoutKey, type Option,
} from '../lib/planningModel';
import { PageHeader } from '../components/app/PageHeader';
import { EmptyState, ErrorBanner, LoadingState } from '../components/app/StateMessages';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PlanningTable from '../components/planning/PlanningTable';
import PlanningGantt from '../components/planning/PlanningGantt';
import PlanningKanban from '../components/planning/PlanningKanban';
import Schedule from './Schedule';

type PlanningView = 'table' | 'gantt' | 'kanban' | 'capacita';

const WBS_VIEWS: { value: PlanningView; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'gantt', label: 'Gantt' },
  { value: 'kanban', label: 'Kanban' },
];
const ALL = 'all';

function viewOf(pathname: string): PlanningView {
  const segment = pathname.split('/')[2];
  return segment === 'gantt' || segment === 'kanban' || segment === 'capacita' ? segment : 'table';
}

export default function Planning() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = viewOf(pathname);
  const isPm = user != null && roleAtLeast(user.appRole, 'pm');
  const today = localTodayIso();

  const [items, setItems] = useState<WbsPlanningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const savingIds = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getPlanningWbs());
    } catch {
      setError('Impossibile caricare le WBS.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Filtri nell'URL (input non fidato). Default Persona: member = sé stesso, PM = tutti; "all" esplicito = tutti.
  const projectId = positiveIntOrNull(params.get('project'));
  const personParam = params.get('person');
  const personId = personParam === ALL ? null : positiveIntOrNull(personParam) ?? (isPm ? null : user?.personId ?? null);

  const filtered = useMemo(() => filterPlanning(items, { projectId, personId }), [items, projectId, personId]);
  const projects = useMemo(() => projectOptions(items), [items]);
  const persons = useMemo(
    () => personOptions(items, user ? { id: user.personId, name: user.name } : undefined), [items, user]);

  function setFilter(key: 'project' | 'person', value: string) {
    const next = new URLSearchParams(params);
    if (key === 'project' && value === ALL) next.delete('project');
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  function changeView(next: string) {
    // La Capacità ha i suoi parametri (view, project, from): non si mescolano con quelli della board.
    const keepSearch = next !== 'capacita' && view !== 'capacita';
    navigate({ pathname: `/planning/${next}`, search: keepSearch ? params.toString() : '' });
  }

  const updateProgress = useCallback(async (id: number, patch: WbsProgressPatch) => {
    if (savingIds.current.has(id)) return;
    const previous = items.find(item => item.id === id);
    if (!previous) return;
    savingIds.current.add(id);
    setRowErrors(current => withoutKey(current, id));
    setItems(current => current.map(item => (item.id === id ? { ...item, ...patch } : item)));
    try {
      const saved = await patchWbsProgress(id, patch);
      setItems(current => current.map(item => (item.id === id ? saved : item)));
    } catch (err) {
      setItems(current => current.map(item => (item.id === id ? previous : item)));
      const message = err instanceof ApiError && err.status === 403
        ? 'Non puoi modificare questa WBS.'
        : 'Salvataggio non riuscito, valore ripristinato.';
      setRowErrors(current => ({ ...current, [id]: message }));
    } finally {
      savingIds.current.delete(id);
    }
  }, [items]);

  const tabs = isPm ? [{ value: 'capacita' as const, label: 'Capacità' }, ...WBS_VIEWS] : WBS_VIEWS;
  const viewProps = { items: filtered, today, user, rowErrors, onPatch: (id: number, patch: WbsProgressPatch) => void updateProgress(id, patch) };

  return (
    <div className="space-y-4 p-4">
      <PageHeader title="Planning" description="Attività WBS per periodo, timeline e stato." />
      <Tabs value={view} onValueChange={changeView}>
        <TabsList>
          {tabs.map(tab => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {view === 'capacita' ? <Schedule embedded /> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Progetto" value={projectId == null ? ALL : String(projectId)} allLabel="Tutti i progetti"
              options={projects} onChange={value => setFilter('project', value)} />
            <FilterSelect label="Persona" value={personId == null ? ALL : String(personId)} allLabel="Tutte le persone"
              options={persons} onChange={value => setFilter('person', value)} />
          </div>
          {error && <ErrorBanner onRetry={() => void load()}>{error}</ErrorBanner>}
          {loading ? <LoadingState /> : !error && filtered.length === 0 ? (
            <EmptyState title="Nessuna WBS per i filtri selezionati" description="Cambia progetto o persona per vedere altre attività." />
          ) : !error && (
            view === 'gantt' ? <PlanningGantt items={filtered} today={today} />
              : view === 'kanban' ? <PlanningKanban {...viewProps} />
                : <PlanningTable {...viewProps} />
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({ label, value, allLabel, options, onChange }: {
  label: string;
  value: string;
  allLabel: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-56" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map(option => <SelectItem key={option.id} value={String(option.id)}>{option.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
