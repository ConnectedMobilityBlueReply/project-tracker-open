import type { ScheduleAllocation, ScheduleOtherTeamLoad, TimeOffEntry } from '../../types';
import type { ScheduleRowModel } from '../../lib/scheduleRows';
import { monthColumns } from '../../lib/scheduleModel';
import { teamTotals } from '../../lib/scheduleBacklog';
import type { Density, Zoom } from './ScheduleToolbar';
import ScheduleRow from './ScheduleRow';
import type { AssignMode } from './ScheduleRow';
import ScheduleTeamRow from './ScheduleTeamRow';
import WeekGrid from './WeekGrid';

interface Props {
  rows: ScheduleRowModel[];
  /** Allocazioni non filtrate per progetto: la riga Team somma la capacità reale, non solo ciò che la ricerca mostra. */
  teamAllocations?: readonly ScheduleAllocation[];
  weeks: string[];
  timeOff: TimeOffEntry[];
  otherTeamLoad?: readonly ScheduleOtherTeamLoad[];
  zoom: Zoom;
  density: Density;
  /** Intestazione della colonna sinistra: cambia con la vista. */
  headerLabel: string;
  emptyMessage: string;
  canWrite: boolean;
  onOpenAllocation?: (allocation: ScheduleAllocation) => void;
  onOpenCell?: (row: ScheduleRowModel, weekStart: string) => void;
  onDropAllocation?: (allocationId: number, personId: number, weekStart: string, rowKey: string) => void;
  onResizeAllocation?: (allocationId: number, personId: number, weekStart: string, rowKey: string) => void;
  onOpenTimeOff?: (entry: TimeOffEntry) => void;
  rowErrors?: Record<string, string>;
  expandedKeys: ReadonlySet<string>;
  /** Falso in vista per progetto: le righe restano sempre espanse (spec §2). */
  compressible: boolean;
  onToggleRow: (key: string) => void;
  showTeamRow: boolean;
  currentWeek: string;
  assign?: AssignMode;
}

function weekLabel(weekStart: string): string {
  const [, month, day] = weekStart.split('-');
  return `${day}/${month}`;
}

export default function ScheduleGrid({
  rows, teamAllocations, weeks, timeOff, otherTeamLoad, zoom, density, headerLabel, emptyMessage, canWrite,
  onOpenAllocation, onOpenCell, onDropAllocation, onResizeAllocation, onOpenTimeOff, rowErrors,
  expandedKeys, compressible, onToggleRow, showTeamRow, currentWeek, assign,
}: Props) {
  const columns = zoom === 'months'
    ? monthColumns(weeks)
    : weeks.map(week => ({ key: week, weeks: [week] }));
  const hasTotals = rows.some(row => row.totals != null);
  const teamRowTotals = showTeamRow && rows.length > 0
    ? teamTotals(rows.map(row => row.person), teamAllocations ?? rows.flatMap(row => row.allocations), timeOff, otherTeamLoad ?? [], columns)
    : null;

  return (
    <WeekGrid
      columns={columns}
      headerLabel={headerLabel}
      columnLabel={column => (zoom === 'months' ? column.key : weekLabel(column.key))}
      totalsLabel={hasTotals ? 'Tot. / Stim.' : undefined}
      isEmpty={rows.length === 0}
      emptyMessage={emptyMessage}
      isCurrentColumn={column => column.weeks.includes(currentWeek)}
    >
      {teamRowTotals && <ScheduleTeamRow totals={teamRowTotals} />}
      {rows.map(row => (
        <ScheduleRow
          key={row.key}
          row={row}
          expanded={!compressible || expandedKeys.has(row.key)}
          compressible={compressible}
          onToggle={() => onToggleRow(row.key)}
          columns={columns}
          density={density}
          timeOff={timeOff}
          otherTeamLoad={otherTeamLoad}
          canWrite={canWrite}
          onOpenAllocation={onOpenAllocation}
          onOpenCell={onOpenCell}
          onDropAllocation={onDropAllocation}
          onResizeAllocation={onResizeAllocation}
          onOpenTimeOff={onOpenTimeOff}
          errorMessage={rowErrors?.[row.key] ?? null}
          assign={assign}
        />
      ))}
    </WeekGrid>
  );
}
