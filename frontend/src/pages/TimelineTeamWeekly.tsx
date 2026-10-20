import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, addWeeks, format, startOfWeek, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  deleteTimeEntry,
  getSelectableProjects,
  getTimeEntries,
  getWeekEntries,
  upsertTimeEntry,
} from '../api';
import {
  Person,
  SelectableProject,
  TASK_LABELS,
  TaskType,
  WeekGroup,
  timeEntryKey,
} from '../types';
import { daysToHours, hoursToDays } from '../lib/units';
import {
  isTaskCompleted,
  isWbsClosed,
  shouldShowTimelineRow,
  timelineActivityBucket,
  type AddCandidate,
  type TaskGroup,
  type WeekTask,
  type WeeklySaveState,
} from './timelineTeamWeeklyModel';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ErrorBanner, EmptyState, LoadingState } from '@/components/app/StateMessages';
import { consumptionTone } from '../lib/statusTone';
import { Input } from '@/components/ui/input';
import { TimelineSubbar } from '../components/timeline/TimelineToolbar';
import WeeklyAddActivityPanel from '../components/timeline/WeeklyAddActivityPanel';
import WeeklyTaskGroup from '../components/timeline/WeeklyTaskGroup';

const normalize = (value: string) => value.toLocaleLowerCase('it').trim();
const formatHours = (hours: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(hours);

function groupWeekTasks(data: WeekGroup[]): TaskGroup[] {
  const groups = new Map<number, TaskGroup>();
  for (const project of data) {
    for (const row of project.tasks) {
      const existing = groups.get(row.task_id) ?? {
        projectId: project.project_id,
        projectName: project.project_name,
        taskId: row.task_id,
        taskType: row.task_type,
        taskStatus: row.task_status,
        isExtra: row.is_extra,
        lastEntryWeek: row.last_entry_week,
        plannedDays: 0,
        rows: [],
      };
      existing.rows.push(row);
      existing.isExtra = existing.isExtra || row.is_extra;
      if ((row.last_entry_week ?? '') > (existing.lastEntryWeek ?? '')) {
        existing.lastEntryWeek = row.last_entry_week;
      }
      existing.plannedDays = Math.max(existing.plannedDays, row.planned_days);
      groups.set(row.task_id, existing);
    }
  }
  return Array.from(groups.values());
}

function flattenCandidates(projects: SelectableProject[]): AddCandidate[] {
  return projects.flatMap(project => project.tasks.flatMap((task): AddCandidate[] => {
    if (task.wbs_items.length > 0) {
      return task.wbs_items.map(wbs => ({
        key: timeEntryKey(task.id, wbs.id),
        projectId: project.id,
        projectName: project.name,
        taskId: task.id,
        taskType: task.task_type as TaskType,
        taskStatus: task.status,
        wbsItemId: wbs.id,
        wbsItemName: wbs.name,
        wbsStatus: wbs.status,
      }));
    }
    return [{
      key: timeEntryKey(task.id, null),
      projectId: project.id,
      projectName: project.name,
      taskId: task.id,
      taskType: task.task_type as TaskType,
      taskStatus: task.status,
      wbsItemId: null,
      wbsItemName: null,
      wbsStatus: null,
    }];
  }));
}

interface TimelineTeamWeeklyProps {
  persons: Person[];
  /** Persona da aprire subito (arrivo dal Gantt). */
  initialPersonId?: number;
  /** Lunedi' `yyyy-MM-dd` da mostrare subito (arrivo dal Gantt). */
  initialWeek?: string;
}

export default function TimelineTeamWeekly({ persons, initialPersonId, initialWeek }: TimelineTeamWeeklyProps) {
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(
    initialWeek ? new Date(`${initialWeek}T00:00:00`) : new Date(), { weekStartsOn: 1 }));
  const [expandedPersonId, setExpandedPersonId] = useState<number | null>(initialPersonId ?? null);
  const [weekData, setWeekData] = useState<WeekGroup[]>([]);
  const [timelineTotals, setTimelineTotals] = useState<Map<number, number>>(new Map());
  const [selectableProjects, setSelectableProjects] = useState<SelectableProject[]>([]);
  const [loadingPerson, setLoadingPerson] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personSearch, setPersonSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [localHours, setLocalHours] = useState<Record<string, string>>({});
  const [saveStates, setSaveStates] = useState<Record<string, WeeklySaveState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [addError, setAddError] = useState<string | null>(null);
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addDrafts, setAddDrafts] = useState<Record<string, string>>({});
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const weekStart = format(currentWeek, 'yyyy-MM-dd');
  const weekEnd = addDays(currentWeek, 6);
  const weekLabel = `${format(currentWeek, 'd MMM', { locale: it })} – ${format(weekEnd, 'd MMM yyyy', { locale: it })}`;

  useEffect(() => {
    getSelectableProjects().then(setSelectableProjects).catch(() => setError('Impossibile caricare le attività disponibili.'));
  }, []);

  const loadTotals = useCallback(async () => {
    try {
      const entries = await getTimeEntries({ week_start: weekStart });
      const totals = new Map<number, number>();
      for (const entry of entries) {
        totals.set(entry.person_id, (totals.get(entry.person_id) ?? 0) + daysToHours(entry.man_days));
      }
      setTimelineTotals(totals);
    } catch {
      setError('Impossibile aggiornare i totali della settimana.');
    }
  }, [weekStart]);

  useEffect(() => {
    void loadTotals();
  }, [loadTotals]);

  // Guardia anti-race: come in Consuntivazione, una vista è identificata da
  // persona + settimana. Espandendo rapidamente due persone, la risposta lenta
  // della prima (view superseded) viene scartata prima di scrivere lo stato.
  const viewVersionRef = useRef(0);
  const viewKeyRef = useRef<string | null>(null);
  const dataRequestRef = useRef(0);

  const viewKey = expandedPersonId != null ? `${expandedPersonId}:${weekStart}` : null;

  if (viewKeyRef.current !== viewKey) {
    viewKeyRef.current = viewKey;
    viewVersionRef.current += 1;
  }

  const isCurrentView = (key: string, version: number) =>
    viewKeyRef.current === key && viewVersionRef.current === version;

  const loadPersonWeek = useCallback(async (
    personId: number,
    requestedWeekStart: string,
    key: string,
    version: number,
  ) => {
    const requestId = ++dataRequestRef.current;
    setLoadingPerson(true);
    setError(null);
    try {
      const data = await getWeekEntries(personId, requestedWeekStart);
      if (!isCurrentView(key, version) || dataRequestRef.current !== requestId) return;
      const nextHours: Record<string, string> = {};
      for (const project of data) {
        for (const task of project.tasks) {
          const entryKey = timeEntryKey(task.task_id, task.wbs_item_id);
          nextHours[entryKey] = task.man_days > 0 ? String(daysToHours(task.man_days)) : '';
        }
      }
      setWeekData(data);
      setLocalHours(nextHours);
    } catch {
      if (isCurrentView(key, version) && dataRequestRef.current === requestId) {
        setWeekData([]);
        setError('Impossibile caricare le attività della persona.');
      }
    } finally {
      if (isCurrentView(key, version) && dataRequestRef.current === requestId) {
        setLoadingPerson(false);
      }
    }
  }, []);

  const reloadCurrentView = useCallback(async () => {
    const key = viewKey;
    const version = viewVersionRef.current;
    await Promise.all([
      expandedPersonId != null && key != null
        ? loadPersonWeek(expandedPersonId, weekStart, key, version)
        : Promise.resolve(),
      loadTotals(),
    ]);
  }, [expandedPersonId, viewKey, weekStart, loadPersonWeek, loadTotals]);

  useEffect(() => {
    const version = viewVersionRef.current;
    setActivitySearch('');
    setShowAddActivity(false);
    setAddSearch('');
    setAddDrafts({});
    setAddError(null);
    setSaveStates({});
    setRowErrors({});
    setWeekData([]);
    setLocalHours({});
    setError(null);
    if (expandedPersonId == null || viewKey == null) {
      setLoadingPerson(false);
      return;
    }
    void loadPersonWeek(expandedPersonId, weekStart, viewKey, version);
    return () => {
      if (isCurrentView(viewKey, version)) dataRequestRef.current += 1;
    };
  }, [expandedPersonId, viewKey, weekStart, loadPersonWeek]);

  // Pulisce i timer del riscontro «Salvato» transitorio allo smontaggio.
  useEffect(() => () => {
    for (const timer of Object.values(savedTimers.current)) clearTimeout(timer);
  }, []);

  // Arrivo dal Gantt: la persona aperta potrebbe essere in fondo alla lista.
  useEffect(() => {
    if (initialPersonId == null) return;
    document.getElementById(`timeline-person-${initialPersonId}`)?.scrollIntoView({ block: 'start' });
  }, [initialPersonId]);

  const filteredPersons = useMemo(() => {
    const query = normalize(personSearch);
    return persons.filter(person => !query || normalize(person.name).includes(query));
  }, [personSearch, persons]);

  const allTaskGroups = useMemo(() => groupWeekTasks(weekData), [weekData]);
  const visibleTaskGroups = useMemo(() => {
    const query = normalize(activitySearch);
    return allTaskGroups.flatMap(group => {
      const taskLabel = TASK_LABELS[group.taskType] ?? group.taskType;
      const groupMatches = normalize(`${group.projectName} ${taskLabel}`).includes(query);
      const rows = group.rows.filter(row => {
        const hasHours = (Number(localHours[timeEntryKey(row.task_id, row.wbs_item_id)]) || 0) > 0;
        const statusVisible = shouldShowTimelineRow({
          taskStatus: row.task_status,
          wbsStatus: row.wbs_status,
          hours: hasHours ? 1 : 0,
          showCompleted,
        });
        const rowMatches = !query || groupMatches || normalize(row.wbs_item_name ?? '').includes(query);
        return statusVisible && rowMatches;
      });
      return rows.length > 0 ? [{ ...group, rows }] : [];
    }).sort((a, b) => {
      // Il bucket/ordine usa le ore salvate lato server (non la bozza in localHours):
      // spostare la riga mentre l'utente digita smonterebbe l'input a metà modifica,
      // perdendo il focus prima che onBlur possa salvare.
      const aHours = a.rows.reduce((sum, row) => sum + row.man_days, 0);
      const bHours = b.rows.reduce((sum, row) => sum + row.man_days, 0);
      const aBucket = timelineActivityBucket(aHours, a.plannedDays, a.lastEntryWeek);
      const bBucket = timelineActivityBucket(bHours, b.plannedDays, b.lastEntryWeek);
      if (aBucket !== bBucket) return aBucket - bBucket;
      if (aBucket === 2 && a.lastEntryWeek !== b.lastEntryWeek) {
        return (b.lastEntryWeek ?? '').localeCompare(a.lastEntryWeek ?? '');
      }
      return a.projectName.localeCompare(b.projectName, 'it') ||
        (TASK_LABELS[a.taskType] ?? a.taskType).localeCompare(TASK_LABELS[b.taskType] ?? b.taskType, 'it');
    });
  }, [activitySearch, allTaskGroups, localHours, showCompleted]);

  const categorizedGroups = useMemo(() => {
    const compiled: TaskGroup[] = [];
    const planned: TaskGroup[] = [];
    const recent: TaskGroup[] = [];
    const other: TaskGroup[] = [];
    for (const group of visibleTaskGroups) {
      const savedHours = group.rows.reduce((sum, row) => sum + row.man_days, 0);
      if (savedHours > 0) compiled.push(group);
      else if (group.plannedDays > 0) planned.push(group);
      else if (group.lastEntryWeek) recent.push(group);
      else other.push(group);
    }
    return [
      { id: 'compiled', label: 'Compilate questa settimana', groups: compiled },
      { id: 'planned', label: 'Pianificate questa settimana', groups: planned },
      { id: 'recent', label: 'Usate recentemente', groups: recent },
      { id: 'other', label: 'Altre attività assegnate', groups: other },
    ].filter(section => section.groups.length > 0);
  }, [visibleTaskGroups]);

  const existingKeys = useMemo(() => new Set(
    weekData.flatMap(project => project.tasks.map(task => timeEntryKey(task.task_id, task.wbs_item_id)))
  ), [weekData]);

  const addCandidates = useMemo(() => {
    const query = normalize(addSearch);
    if (query.length < 2) return [];
    return flattenCandidates(selectableProjects)
      .filter(candidate => !existingKeys.has(candidate.key))
      .filter(candidate => showCompleted || (!isTaskCompleted(candidate.taskStatus) && !isWbsClosed(candidate.wbsStatus)))
      .filter(candidate => normalize(`${candidate.projectName} ${TASK_LABELS[candidate.taskType] ?? candidate.taskType} ${candidate.wbsItemName ?? ''}`).includes(query))
      .slice(0, 12);
  }, [addSearch, existingKeys, selectableProjects, showCompleted]);

  const clearSavedTimer = (key: string) => {
    const timer = savedTimers.current[key];
    if (timer) {
      clearTimeout(timer);
      delete savedTimers.current[key];
    }
  };

  const saveHours = async (row: WeekTask) => {
    if (expandedPersonId == null) return;
    const key = timeEntryKey(row.task_id, row.wbs_item_id);
    if (saveStates[key] === 'saving') return;
    const hours = Number(localHours[key] || 0);
    if (!Number.isFinite(hours) || hours < 0) {
      // Errore di validazione mostrato inline sulla riga, non nel banner globale.
      setRowErrors(errors => ({ ...errors, [key]: 'Inserisci un numero di ore valido (maggiore o uguale a zero).' }));
      return;
    }
    setRowErrors(errors => { if (!errors[key]) return errors; const next = { ...errors }; delete next[key]; return next; });
    if (hours === 0 && row.entry_id == null) return;
    setSaveStates(states => ({ ...states, [key]: 'saving' }));
    try {
      if (hours === 0 && row.entry_id != null) {
        await deleteTimeEntry(row.entry_id);
      } else {
        await upsertTimeEntry({
          person_id: expandedPersonId,
          task_id: row.task_id,
          week_start: weekStart,
          man_days: hoursToDays(hours),
          ...(row.wbs_item_id != null ? { wbs_item_id: row.wbs_item_id } : {}),
        });
      }
      setSaveStates(states => ({ ...states, [key]: 'saved' }));
      // Riscontro transitorio: «Salvato» scompare dopo 2s (non resta indefinitamente).
      clearSavedTimer(key);
      savedTimers.current[key] = setTimeout(() => {
        setSaveStates(states => { const next = { ...states }; delete next[key]; return next; });
        delete savedTimers.current[key];
      }, 2000);
      await reloadCurrentView();
    } catch {
      // Errore di salvataggio inline sulla riga; il valore resta visibile per riprovare.
      setSaveStates(states => ({ ...states, [key]: 'error' }));
    }
  };

  const addActivity = async (candidate: AddCandidate) => {
    if (expandedPersonId == null) return;
    const hours = Number(addDrafts[candidate.key] || 0);
    if (!Number.isFinite(hours) || hours <= 0) {
      setAddError('Indica almeno 0,5 ore per aggiungere l’attività.');
      return;
    }
    setAddingKey(candidate.key);
    setAddError(null);
    try {
      await upsertTimeEntry({
        person_id: expandedPersonId,
        task_id: candidate.taskId,
        week_start: weekStart,
        man_days: hoursToDays(hours),
        ...(candidate.wbsItemId != null ? { wbs_item_id: candidate.wbsItemId } : {}),
      });
      setAddDrafts(drafts => ({ ...drafts, [candidate.key]: '' }));
      setAddSearch('');
      setShowAddActivity(false);
      setAddError(null);
      await reloadCurrentView();
    } catch {
      setAddError('Non è stato possibile aggiungere l’attività.');
    } finally {
      setAddingKey(null);
    }
  };

  const handleHoursChange = (key: string, value: string) => {
    setLocalHours(hours => ({ ...hours, [key]: value }));
    setRowErrors(errors => { if (!errors[key]) return errors; const next = { ...errors }; delete next[key]; return next; });
    if (saveStates[key] === 'saved' || saveStates[key] === 'error') {
      clearSavedTimer(key);
      setSaveStates(states => { const next = { ...states }; delete next[key]; return next; });
    }
  };

  const goToWeek = (date: Date) => {
    setCurrentWeek(startOfWeek(date, { weekStartsOn: 1 }));
    setShowCompleted(false);
    // Cambiando settimana il pannello «Aggiungi attività» si chiude e i
    // candidati vecchi (legati alla settimana precedente) vengono azzerati.
    setShowAddActivity(false);
    setAddSearch('');
    setAddDrafts({});
    setAddError(null);
  };

  return (
    <div className="space-y-3">
      {error && (
        <ErrorBanner onRetry={() => void reloadCurrentView()}>{error}</ErrorBanner>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-card shadow-xs">
        <TimelineSubbar>
          <Button iconOnly variant="outline" aria-label="Settimana precedente" onClick={() => goToWeek(subWeeks(currentWeek, 1))}>
            <CaretLeft className="h-4 w-4" />
          </Button>
          <Button iconOnly variant="outline" aria-label="Settimana successiva" onClick={() => goToWeek(addWeeks(currentWeek, 1))}>
            <CaretRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => goToWeek(new Date())}>Oggi</Button>
          <span className="text-sm font-medium text-foreground">{weekLabel}</span>
          <Input
            className="ml-auto h-8 w-64"
            value={personSearch}
            onChange={event => setPersonSearch(event.target.value)}
            placeholder="Cerca una persona…"
            aria-label="Cerca una persona"
          />
        </TimelineSubbar>

        {filteredPersons.map(person => {
          const expanded = expandedPersonId === person.id;
          const totalHours = timelineTotals.get(person.id) ?? 0;
          const capacityHours = daysToHours(person.weekly_capacity_days);
          const ratio = capacityHours > 0 ? totalHours / capacityHours : 0;
          const fillRatio = Math.min(ratio, 1);
          return (
            <section key={person.id} id={`timeline-person-${person.id}`} className="border-b border-border last:border-b-0">
              <button
                type="button"
                className="grid w-full grid-cols-[auto_1fr_10rem_auto] items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
                onClick={() => setExpandedPersonId(current => current === person.id ? null : person.id)}
                aria-expanded={expanded}
              >
                <CaretRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
                <span className="truncate text-sm font-medium text-foreground">{person.name}</span>
                <Progress
                  value={fillRatio * 100}
                  size="sm"
                  tone={consumptionTone(ratio * 100)}
                  aria-label={`Utilizzo capacità: ${formatHours(totalHours)} su ${formatHours(capacityHours)} ore`}
                />
                <span className="text-right text-sm tabular-nums">
                  <span className="font-semibold text-foreground">{formatHours(totalHours)}h</span>
                  <span className="text-muted-foreground"> / {formatHours(capacityHours)}h</span>
                </span>
              </button>

              {expanded && (
                <div className="border-t border-border bg-topbar">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <Input
                      className="h-8 min-w-64 flex-1"
                      value={activitySearch}
                      onChange={event => setActivitySearch(event.target.value)}
                      placeholder="Cerca progetto, attività o componente WBS…"
                      aria-label="Cerca attività"
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={showCompleted} onChange={event => setShowCompleted(event.target.checked)} className="accent-primary" />
                      Mostra concluse
                    </label>
                    <Button size="sm" onClick={() => setShowAddActivity(open => !open)}>
                      {showAddActivity ? 'Chiudi' : '+ Aggiungi attività'}
                    </Button>
                  </div>

                  {showAddActivity && (
                    <WeeklyAddActivityPanel
                      search={addSearch}
                      onSearchChange={setAddSearch}
                      error={addError}
                      candidates={addCandidates}
                      drafts={addDrafts}
                      onDraftChange={(key, value) => setAddDrafts(drafts => ({ ...drafts, [key]: value }))}
                      addingKey={addingKey}
                      onAdd={candidate => void addActivity(candidate)}
                    />
                  )}

                  {loadingPerson ? (
                    <LoadingState label="Caricamento attività…" className="py-8" />
                  ) : categorizedGroups.length === 0 ? (
                    <EmptyState
                      title="Nessuna attività da mostrare"
                      description="Modifica la ricerca, mostra le concluse oppure aggiungi un’attività."
                    />
                  ) : categorizedGroups.map(section => (
                    <section key={section.id} className="border-t border-border">
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{section.label}</h3>
                        <span className="font-mono text-[11px] text-muted-foreground">{section.groups.length}</span>
                      </div>
                      {section.groups.map(group => (
                        <WeeklyTaskGroup
                          key={group.taskId}
                          group={group}
                          localHours={localHours}
                          saveStates={saveStates}
                          rowErrors={rowErrors}
                          onHoursChange={handleHoursChange}
                          onSave={row => void saveHours(row)}
                        />
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
