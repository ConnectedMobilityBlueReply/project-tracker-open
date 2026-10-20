import type { BacklogItem, ScheduleAllocation, ScheduleOtherTeamLoad, TimeOffEntry } from '../../types';
import type { ScheduleRowModel } from '../../lib/scheduleRows';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { netAvailableDays, otherTeamDays, projectColor } from '../../lib/scheduleModel';
import { freeDays, planAssignment } from '../../lib/scheduleBacklog';
import AllocationCard from './AllocationCard';
import UtilizationBadge from './UtilizationBadge';
import TimeOffBand from './TimeOffBand';
import type { Density } from './ScheduleToolbar';
import { STICKY_COL, WEEK_COL, TOTAL_COL } from './WeekGrid';

/** Modalità assegnazione: attiva quando un item del backlog è selezionato. */
export interface AssignMode {
  item: BacklogItem;
  /** TUTTE le allocazioni caricate (non quelle filtrate): il libero si calcola sul reale. */
  allocations: ScheduleAllocation[];
  /** Assegnazione in volo: i bottoni "+N g" restano disabilitati finché non torna. */
  pending: boolean;
  onAssign: (row: ScheduleRowModel, week: string) => void;
}

/** Righe "da pianificare" mostrate sotto il nome prima di raccogliere il resto in un contatore. */
const MAX_UNPLANNED_SHOWN = 2;

/** Data ISO della settimana in forma breve, per il nome accessibile ("dd/mm"). */
const shortDate = (isoDay: string): string => `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}`;

interface Props {
  row: ScheduleRowModel;
  columns: { key: string; weeks: string[] }[];
  density: Density;
  timeOff: TimeOffEntry[];
  otherTeamLoad?: readonly ScheduleOtherTeamLoad[];
  canWrite: boolean;
  onOpenAllocation?: (allocation: ScheduleAllocation) => void;
  onOpenCell?: (row: ScheduleRowModel, weekStart: string) => void;
  onDropAllocation?: (allocationId: number, personId: number, weekStart: string, rowKey: string) => void;
  onResizeAllocation?: (allocationId: number, personId: number, weekStart: string, rowKey: string) => void;
  onOpenTimeOff?: (entry: TimeOffEntry) => void;
  errorMessage?: string | null;
  expanded: boolean;
  compressible: boolean;
  onToggle: () => void;
  assign?: AssignMode;
}

export default function ScheduleRow({
  row, columns, density, timeOff, otherTeamLoad = [], canWrite, onOpenAllocation, onOpenCell,
  onDropAllocation, onResizeAllocation, onOpenTimeOff, errorMessage, expanded, compressible, onToggle, assign,
}: Props) {
  const cellHeight = !expanded ? 'min-h-[40px]' : density === 'compact' ? 'min-h-[56px]' : 'min-h-[88px]';
  const person = row.person;
  // Il superamento si segnala, non si impedisce (decisione B1 dello spec).
  const isOverEstimate = row.totals != null
    && row.totals.estimatedDays > 0
    && row.totals.allocatedDays > row.totals.estimatedDays;

  return (
    <div className="flex border-b">
      <div className={`${STICKY_COL} bg-background px-3 py-2`}>
        <div className="flex items-center gap-1">
          {compressible && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Comprimi' : 'Espandi'} ${row.label}`}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {expanded ? <CaretDown className="h-3.5 w-3.5" /> : <CaretRight className="h-3.5 w-3.5" />}
            </button>
          )}
          <div className="truncate text-sm font-medium">{row.label}</div>
        </div>
        {errorMessage && (
          <div className="mt-1 text-[11px] text-destructive" role="alert">{errorMessage}</div>
        )}
        {row.subLabel && (
          <div className="truncate text-xs text-muted-foreground">{row.subLabel}</div>
        )}
        {row.unplanned.slice(0, MAX_UNPLANNED_SHOWN).map(assignment => (
          <div
            key={assignment.task_allocation_id}
            title={`${assignment.project_name}: assegnata, nessuna ora pianificata`}
            className="flex items-center gap-1 truncate text-xs text-muted-foreground"
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: projectColor(assignment.project_id, assignment.color) }}
              className="h-2 w-2 shrink-0 rounded-full"
            />
            <span className="truncate">{assignment.project_name} · da pianificare</span>
          </div>
        ))}
        {row.unplanned.length > MAX_UNPLANNED_SHOWN && (
          <div className="text-xs text-muted-foreground">
            +{row.unplanned.length - MAX_UNPLANNED_SHOWN} da pianificare
          </div>
        )}
      </div>

      {columns.map(column => {
        const inColumn = new Set(column.weeks);
        const cellAllocations = row.allocations.filter(a => inColumn.has(a.week_start));
        const allocated = cellAllocations.reduce((total, a) => total + a.man_days, 0);
        const otherDays = otherTeamDays(otherTeamLoad, person.id, column.weeks);
        // La capacità è unica: il lavoro in altri team la riduce anche qui.
        const available = netAvailableDays(person, column.weeks, timeOff, otherTeamLoad);
        const plan = assign && person.id === assign.item.person_id && column.weeks.length === 1
          ? planAssignment(
              assign.item,
              column.weeks[0],
              assign.allocations,
              freeDays(person, column.weeks[0], assign.allocations, timeOff, otherTeamLoad))
          : null;

        return (
          <div
            key={column.key}
            onClick={event => {
              if (event.target === event.currentTarget) onOpenCell?.(row, column.weeks[0]);
            }}
            onDoubleClick={event => {
              // Conservato per chi ha imparato il gesto prima che ci fosse il click.
              if (event.target === event.currentTarget) onOpenCell?.(row, column.weeks[0]);
            }}
            onDragOver={event => {
              if (column.weeks.length === 1 && (onDropAllocation || onResizeAllocation)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={event => {
              event.preventDefault();
              if (column.weeks.length !== 1) return;
              const payload = event.dataTransfer.getData('text/plain');
              const isResize = payload.startsWith('resize:');
              const id = Number(isResize ? payload.slice('resize:'.length) : payload);
              if (!Number.isFinite(id)) return;
              if (isResize) onResizeAllocation?.(id, person.id, column.weeks[0], row.key);
              else onDropAllocation?.(id, person.id, column.weeks[0], row.key);
            }}
            className={`group relative ${WEEK_COL} space-y-1 p-1 ${cellHeight} ${
              onOpenCell ? 'cursor-pointer' : ''
            }`}
          >
            <TimeOffBand personId={person.id} weeks={column.weeks} timeOff={timeOff} onOpen={onOpenTimeOff} />
            {!expanded ? (
              <div className="pointer-events-none flex items-center justify-between gap-1">
                <div
                  role="img"
                  className="pointer-events-auto flex flex-wrap gap-1"
                  aria-label={cellAllocations.length === 0
                    ? '0 allocazioni'
                    : `${cellAllocations.length} allocazioni: ${cellAllocations.map(a => `${a.project_name} ${a.man_days.toLocaleString('it-IT')} g`).join(', ')}`}
                >
                  {cellAllocations.map(allocation => (
                    <span
                      key={allocation.id}
                      title={`${allocation.project_name} — ${allocation.man_days.toLocaleString('it-IT')} g`}
                      style={{ backgroundColor: projectColor(allocation.project_id, allocation.color) }}
                      className="h-2.5 w-2.5 rounded-full"
                    />
                  ))}
                </div>
                <span className="pointer-events-auto">
                  <UtilizationBadge allocated={allocated} available={available} />
                </span>
              </div>
            ) : (
              <>
                {onOpenCell && cellAllocations.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenCell(row, column.weeks[0])}
                    aria-label={`Assegna lavoro a ${person.name}, settimana del ${column.weeks[0]}`}
                    className="absolute inset-x-0 bottom-1 mx-auto w-8 rounded text-lg leading-none text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-60"
                  >
                    +
                  </button>
                )}
                <div className="flex items-center justify-end gap-1">
                  {otherDays > 0 && (
                    <span className="text-[11px] text-muted-foreground" title="Giorni già allocati in altri team">
                      Altri team: {Math.round(otherDays * 100) / 100} gg
                    </span>
                  )}
                  <UtilizationBadge allocated={allocated} available={available} />
                </div>
                {cellAllocations.map(allocation => (
                  <AllocationCard
                    key={allocation.id}
                    allocation={allocation}
                    onOpen={onOpenAllocation}
                    draggable={canWrite}
                  />
                ))}
                {plan && assign && (
                  <button
                    type="button"
                    disabled={assign.pending}
                    onClick={() => assign.onAssign(row, column.weeks[0])}
                    aria-label={`+${plan.addedDays.toLocaleString('it-IT')} g: assegna a ${person.name}, settimana dal ${shortDate(column.weeks[0])}`}
                    className="w-full rounded-sm border border-dashed border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    +{plan.addedDays.toLocaleString('it-IT')} g
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      {row.totals && (
        <div
          className={`${TOTAL_COL} px-3 py-2 text-right text-sm font-medium tabular-nums ${
            isOverEstimate ? 'text-warning' : 'text-foreground'
          }`}
        >
          {row.totals.allocatedDays}gg / {row.totals.estimatedDays}gg
        </div>
      )}
    </div>
  );
}
