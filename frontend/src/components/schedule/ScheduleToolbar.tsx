import type { ReactNode } from 'react';
import { CalendarPlus, CaretDoubleDown, CaretDoubleUp, CaretLeft, CaretRight, Tray } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { formatRange, rangeFromToday } from '../../lib/scheduleRange';
import { addDaysIso } from '../../lib/capacity';
import type { SortKey } from '../../lib/scheduleModel';
import ScheduleViewMenu from './ScheduleViewMenu';

export type Zoom = 'weeks' | 'months';
export type Density = 'compact' | 'comfortable';
export type ScheduleView = 'person' | 'project';

const ALL_PROJECTS = '__all__';

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5">
      {options.map(option => (
        <Button
          key={option.value}
          size="sm"
          variant={value === option.value ? 'primary' : 'ghost'}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

interface Props {
  from: string;
  to: string;
  today: string;
  zoom: Zoom;
  density: Density;
  sort: { key: SortKey; descending: boolean };
  view: ScheduleView;
  canWrite: boolean;
  projects: { id: number; name: string }[];
  projectId: number | null;
  /** Filtri (vista per persona) o ricerca (vista per progetto): lo decide la pagina. */
  filterSlot: ReactNode;
  onViewChange: (view: ScheduleView) => void;
  onProjectChange: (projectId: number | null) => void;
  onRangeChange: (from: string, to: string) => void;
  onZoomChange: (zoom: Zoom) => void;
  onDensityChange: (density: Density) => void;
  onSortChange: (sort: { key: SortKey; descending: boolean }) => void;
  onAddTimeOff: () => void;
  /** Presenti solo quando la funzione esiste (Task 5 / Task 6). */
  allExpanded?: boolean;
  onToggleExpandAll?: () => void;
  backlogCount?: number | null;
  backlogOpen?: boolean;
  onToggleBacklog?: () => void;
}

export default function ScheduleToolbar({
  from, to, today, zoom, density, sort, view, canWrite, projects, projectId, filterSlot,
  onViewChange, onProjectChange, onRangeChange, onZoomChange, onDensityChange, onSortChange, onAddTimeOff,
  allExpanded = false, onToggleExpandAll, backlogCount = null, backlogOpen = false, onToggleBacklog,
}: Props) {
  const spanDays = Math.round((Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000));

  const shift = (direction: -1 | 1) =>
    onRangeChange(addDaysIso(from, direction * spanDays), addDaysIso(to, direction * spanDays));

  const goToday = () => {
    const next = rangeFromToday(from, to, today);
    onRangeChange(next.from, next.to);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" iconOnly aria-label="Periodo precedente" onClick={() => shift(-1)}>
          <CaretLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToday}>Oggi</Button>
        <Button variant="outline" iconOnly aria-label="Periodo successivo" onClick={() => shift(1)}>
          <CaretRight className="h-4 w-4" />
        </Button>
      </div>
      <span className="text-sm font-medium tabular-nums">{formatRange(from, to)}</span>

      {canWrite && (
        <Segmented<ScheduleView>
          label="Raggruppa per"
          value={view}
          options={[{ value: 'person', label: 'Persone' }, { value: 'project', label: 'Progetti' }]}
          onChange={onViewChange}
        />
      )}

      {canWrite && view === 'project' && (
        <Select
          value={projectId == null ? ALL_PROJECTS : String(projectId)}
          onValueChange={value => onProjectChange(value === ALL_PROJECTS ? null : Number(value))}
        >
          <SelectTrigger size="sm" className="w-auto" aria-label="Progetto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS}>Seleziona progetto…</SelectItem>
            {projects.map(project => (
              <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Segmented<Zoom>
        label="Scala temporale"
        value={zoom}
        options={[{ value: 'weeks', label: 'Settimane' }, { value: 'months', label: 'Mesi' }]}
        onChange={onZoomChange}
      />

      {filterSlot}

      <ScheduleViewMenu
        view={view}
        sort={sort}
        density={density}
        onSortChange={onSortChange}
        onDensityChange={onDensityChange}
      />

      <div className="ml-auto flex items-center gap-2">
        {onToggleExpandAll && (
          <Button variant="outline" size="sm" onClick={onToggleExpandAll}>
            {allExpanded
              ? <CaretDoubleUp className="mr-1 h-4 w-4" />
              : <CaretDoubleDown className="mr-1 h-4 w-4" />}
            {allExpanded ? 'Comprimi tutto' : 'Espandi tutto'}
          </Button>
        )}
        {onToggleBacklog && (
          <Button
            variant={backlogOpen ? 'primary' : 'outline'}
            size="sm"
            aria-pressed={backlogOpen}
            onClick={onToggleBacklog}
          >
            <Tray className="mr-1 h-4 w-4" />
            Da assegnare{backlogCount != null ? ` · ${backlogCount}` : ''}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onAddTimeOff}>
          <CalendarPlus className="mr-1 h-4 w-4" />
          Assenza
        </Button>
      </div>
    </div>
  );
}
