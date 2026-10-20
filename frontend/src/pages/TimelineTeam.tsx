import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, startOfWeek, addWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ErrorBanner, LoadingState } from '@/components/app/StateMessages';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, MultiSelectContent, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from '@/components/ui/multi-select';
import { getPersons, getProjects, getTimelineTeam, getOptions } from '../api';
import { Person, Project, TimelineEntry, TaskType, TASK_LABELS, OptionValue } from '../types';
import { daysToHours } from '../lib/units';
import { useTableState } from '../lib/useTableState';
import {
  centerScrollLeft, currentWeekIndex, fillWeekWidth, GANTT_WEEK_WIDTH, shiftMonthKey, weekEdges as computeWeekEdges, weeksOfMonth,
  type GanttZoom,
} from '../lib/timelineGeometry';
import TimelineToolbar from '../components/timeline/TimelineToolbar';
import TeamGantt, { type GanttPersonRow } from '../components/timeline/TeamGantt';
import TimelineTeamWeekly from './TimelineTeamWeekly';

const MIN_YEAR = 2026;
const ZOOM_LABELS: Record<GanttZoom, string> = { month: 'Mese', quarter: 'Trimestre', year: 'Anno' };

function getWeeksOfYear(year: number): string[] {
  const firstDay  = new Date(year, 0, 1);
  const lastDay   = new Date(year, 11, 31);
  const firstWeek = startOfWeek(firstDay, { weekStartsOn: 1 });
  const weeks: string[] = [];
  let current = firstWeek;
  while (current <= lastDay) {
    weeks.push(format(current, 'yyyy-MM-dd'));
    current = addWeeks(current, 1);
  }
  return weeks;
}

interface TaskRow {
  projectId: number;
  projectName: string;
  taskId: number;
  taskType: TaskType;
  weeks: Record<string, number>;
}

export default function TimelineTeam() {
  const currentYear = Math.max(MIN_YEAR, new Date().getFullYear());
  const yearOptions = Array.from({ length: currentYear + 1 - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

  // Mese a schermo nello zoom "Mese" (yyyy-MM); l'anno da caricare ne deriva.
  const [monthKey, setMonthKey] = useState(() => format(new Date(), 'yyyy-MM'));
  const year = Number(monthKey.slice(0, 4));
  const [persons, setPersons] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [mode, setMode] = useState<'weekly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [selectedSocieta, setSelectedSocieta] = useState<string[]>([]);
  const [societaOptions, setSocietaOptions] = useState<OptionValue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState(false);
  const [zoom, setZoom] = useState<GanttZoom>('month');
  // Larghezze in px dei mesi allargati/ristretti a mano (`yyyy-MM`). Solo in memoria: si azzerano cambiando zoom.
  const [monthWidths, setMonthWidths] = useState<Record<string, number>>({});
  const [weeklyTarget, setWeeklyTarget] = useState<{ personId: number; week: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const personTableState = useTableState();

  const yearWeeks = useMemo(() => getWeeksOfYear(year), [year]);
  const weeks = useMemo(
    () => (zoom === 'month' ? weeksOfMonth(yearWeeks, monthKey) : yearWeeks),
    [zoom, yearWeeks, monthKey],
  );
  const currentIndex = currentWeekIndex(weeks, format(new Date(), 'yyyy-MM-dd'));
  const [viewportWidth, setViewportWidth] = useState(0);
  // Le colonne si allargano fino a riempire la pagina; sotto il minimo dello zoom si scorre.
  const weekWidth = fillWeekWidth(viewportWidth, weeks.length, GANTT_WEEK_WIDTH[zoom]);
  const weekEdges = useMemo(() => computeWeekEdges(weeks, weekWidth, monthWidths), [weeks, weekWidth, monthWidths]);
  const resizeMonth = useCallback((monthKey: string, width: number | null) => {
    setMonthWidths(current => {
      const { [monthKey]: _previous, ...rest } = current;
      return width == null ? rest : { ...rest, [monthKey]: width };
    });
  }, []);
  const minMonthKey = `${MIN_YEAR}-01`;
  const maxMonthKey = `${currentYear + 1}-12`;
  const monthLabel = format(new Date(`${monthKey}-01T00:00:00`), 'MMMM yyyy', { locale: it });

  // Il contenitore con lo scroll esiste solo in modalità annuale e con almeno una riga.
  useEffect(() => {
    const container = scrollRef.current;
    if (container == null) return;
    const measure = () => setViewportWidth(container.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mode, persons.length]);

  // La finestra del mese sta tutta a schermo; negli altri zoom si riparte dall'inizio.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [monthKey, zoom]);

  useEffect(() => {
    getPersons()
      .then(setPersons)
      .catch(() => setError('Errore nel caricamento delle persone'));
    getProjects(true)
      .then(setProjects)
      .catch(() => setError('Errore nel caricamento dei progetti'));
    getOptions('societa')
      .then(setSocietaOptions)
      .catch(() => setError('Errore nel caricamento delle società'));
  }, []);

  const fetchTimeline = useCallback(() => {
    setLoading(true);
    setTimelineError(false);
    setError(null);
    return getTimelineTeam(year, selectedPersonIds, selectedProjectIds, selectedSocieta)
      .then(setEntries)
      .catch(() => {
        setTimelineError(true);
        setError('Errore nel caricamento della Timeline Team');
      })
      .finally(() => setLoading(false));
  }, [year, selectedPersonIds, selectedProjectIds, selectedSocieta]);

  useEffect(() => {
    if (mode === 'annual') void fetchTimeline();
  }, [fetchTimeline, mode]);

  const { personTotals, personTasks } = useMemo(() => {
    const totals = new Map<number, Map<string, number>>();
    const tasks  = new Map<number, Map<string, TaskRow>>();
    for (const e of entries) {
      const hours = daysToHours(e.man_days);
      const personWeeks = totals.get(e.person_id) ?? new Map<string, number>();
      personWeeks.set(e.week_start, (personWeeks.get(e.week_start) ?? 0) + hours);
      totals.set(e.person_id, personWeeks);

      const personTaskMap = tasks.get(e.person_id) ?? new Map<string, TaskRow>();
      const taskKey = String(e.task_id);
      const row = personTaskMap.get(taskKey) ?? {
        projectId: e.project_id,
        projectName: e.project_name,
        taskId: e.task_id,
        taskType: e.task_type,
        weeks: {},
      };
      row.weeks[e.week_start] = (row.weeks[e.week_start] ?? 0) + hours;
      personTaskMap.set(taskKey, row);
      tasks.set(e.person_id, personTaskMap);
    }
    return { personTotals: totals, personTasks: tasks };
  }, [entries]);

  const toggleExpand = (personId: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId); else next.add(personId);
      return next;
    });
  };

  const openWeek = (personId: number, week: string) => {
    setWeeklyTarget({ personId, week });
    setMode('weekly');
  };

  const goToToday = () => {
    if (zoom === 'month') {
      setMonthKey(format(new Date(), 'yyyy-MM'));
      return;
    }
    const container = scrollRef.current;
    if (container == null || currentIndex < 0) return;
    container.scrollLeft = centerScrollLeft(weekEdges, currentIndex, container.clientWidth);
  };

  const normalizedPersonQuery = personTableState.query.trim().toLocaleLowerCase('it');
  const displayPersons = persons.filter(p => {
    const matchesSelection = selectedPersonIds.length === 0 || selectedPersonIds.includes(p.id);
    const matchesQuery = !normalizedPersonQuery || p.name.toLocaleLowerCase('it').includes(normalizedPersonQuery);
    return matchesSelection && matchesQuery;
  });


  const ganttRows: GanttPersonRow[] = displayPersons.map(person => ({
    person,
    weekTotals: personTotals.get(person.id) ?? new Map<string, number>(),
    tasks: Array.from(personTasks.get(person.id)?.values() ?? [])
      .sort((a, b) => a.projectName.localeCompare(b.projectName))
      .map(row => ({
        taskId: row.taskId,
        label: `${row.projectName} · ${TASK_LABELS[row.taskType]}`,
        weeks: row.weeks,
      })),
  }));

  const modeSwitch = (
    <div className="flex items-center gap-1" aria-label="Modalità Timeline Team">
      <Button
        size="sm"
        variant={mode === 'weekly' ? 'primary' : 'outline'}
        aria-pressed={mode === 'weekly'}
        onClick={() => { setWeeklyTarget(null); setMode('weekly'); }}
      >
        Settimanale
      </Button>
      <Button
        size="sm"
        variant={mode === 'annual' ? 'primary' : 'outline'}
        aria-pressed={mode === 'annual'}
        onClick={() => setMode('annual')}
      >
        Annuale
      </Button>
    </div>
  );

  const annualControls = (
    <>
      <Select value={String(year)} onValueChange={(value) => setMonthKey(`${value}-${monthKey.slice(5)}`)}>
        <SelectTrigger className="h-8 w-24" aria-label="Anno">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map(y => (
            <SelectItem value={String(y)} key={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <MultiSelect
        value={selectedPersonIds.map(String)}
        onValueChange={(values) => setSelectedPersonIds(values.map(Number))}
      >
        <MultiSelectTrigger className="h-8 w-44" aria-label="Persone">
          <MultiSelectValue
            placeholder="Tutte le persone"
            renderValue={values => values.length === 1
              ? persons.find(person => person.id === Number(values[0]))?.name ?? '1 persona'
              : `${values.length} persone`}
          />
        </MultiSelectTrigger>
        <MultiSelectContent>
          {persons.map(person => (
            <MultiSelectItem value={String(person.id)} key={person.id}>{person.name}</MultiSelectItem>
          ))}
        </MultiSelectContent>
      </MultiSelect>

      <MultiSelect
        value={selectedProjectIds.map(String)}
        onValueChange={(values) => setSelectedProjectIds(values.map(Number))}
      >
        <MultiSelectTrigger className="h-8 w-44" aria-label="Progetti">
          <MultiSelectValue
            placeholder="Tutti i progetti"
            renderValue={values => values.length === 1
              ? projects.find(project => project.id === Number(values[0]))?.name ?? '1 progetto'
              : `${values.length} progetti`}
          />
        </MultiSelectTrigger>
        <MultiSelectContent>
          {projects.map(project => (
            <MultiSelectItem value={String(project.id)} key={project.id}>{project.name}</MultiSelectItem>
          ))}
        </MultiSelectContent>
      </MultiSelect>

      <MultiSelect value={selectedSocieta} onValueChange={setSelectedSocieta}>
        <MultiSelectTrigger className="h-8 w-36" aria-label="Società">
          <MultiSelectValue
            placeholder="Tutte le società"
            renderValue={values => values.length === 1 ? values[0] : `${values.length} società`}
          />
        </MultiSelectTrigger>
        <MultiSelectContent>
          {societaOptions.map(option => (
            <MultiSelectItem value={option.value} key={option.id}>{option.value}</MultiSelectItem>
          ))}
        </MultiSelectContent>
      </MultiSelect>

      <Input
        value={personTableState.query}
        onChange={event => personTableState.setQuery(event.target.value)}
        placeholder="Cerca persona…"
        aria-label="Cerca persona"
        className="h-8 w-48"
      />

      {zoom === 'month' && (
        <div className="flex items-center gap-1" role="group" aria-label="Mese">
          <Button
            iconOnly
            variant="outline"
            className="h-8 w-8"
            aria-label="Mese precedente"
            disabled={monthKey <= minMonthKey}
            onClick={() => setMonthKey(key => shiftMonthKey(key, -1))}
          >
            <CaretLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium capitalize" aria-live="polite">{monthLabel}</span>
          <Button
            iconOnly
            variant="outline"
            className="h-8 w-8"
            aria-label="Mese successivo"
            disabled={monthKey >= maxMonthKey}
            onClick={() => setMonthKey(key => shiftMonthKey(key, 1))}
          >
            <CaretRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Button size="sm" variant="outline" onClick={goToToday} disabled={zoom !== 'month' && currentIndex < 0}>Oggi</Button>
      <div className="flex items-center gap-1" aria-label="Zoom">
        {(Object.keys(ZOOM_LABELS) as GanttZoom[]).map(level => (
          <Button
            key={level}
            size="sm"
            variant={zoom === level ? 'primary' : 'outline'}
            aria-pressed={zoom === level}
            onClick={() => { setZoom(level); setMonthWidths({}); }}
          >
            {ZOOM_LABELS[level]}
          </Button>
        ))}
      </div>
      {loading && <LoadingState label="Aggiornamento…" className="justify-start py-0" />}
    </>
  );

  return (
    <div className="space-y-4 p-4">
      <TimelineToolbar title="Timeline Team" left={modeSwitch} />

      {error && (
        <ErrorBanner onRetry={timelineError ? () => void fetchTimeline() : undefined}>
          {error}
        </ErrorBanner>
      )}

      {mode === 'weekly' ? (
        <TimelineTeamWeekly
          key={weeklyTarget ? `${weeklyTarget.personId}:${weeklyTarget.week}` : 'current'}
          persons={persons}
          initialPersonId={weeklyTarget?.personId}
          initialWeek={weeklyTarget?.week}
        />
      ) : (
        <TeamGantt
          rows={ganttRows}
          weeks={weeks}
          weekEdges={weekEdges}
          onResizeMonth={resizeMonth}
          zoom={zoom}
          currentIndex={currentIndex}
          expanded={expanded}
          onToggle={toggleExpand}
          onOpenWeek={openWeek}
          controls={annualControls}
          emptyMessage={normalizedPersonQuery ? 'Nessuna persona corrisponde alla ricerca.' : 'Nessuna persona disponibile.'}
          busy={loading}
          scrollRef={scrollRef}
        />
      )}
    </div>
  );
}
