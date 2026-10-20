import { TASK_LABELS, type ScheduleAllocation, type TaskType } from '../../types';
import { projectColor } from '../../lib/scheduleModel';

interface Props {
  allocation: ScheduleAllocation;
  onOpen?: (allocation: ScheduleAllocation) => void;
  /** Falso per un'identità in sola lettura: il backend rifiuterebbe la scrittura. */
  draggable?: boolean;
}

/**
 * Gerarchia della card, come in Float: progetto / cliente / fase.
 * Il cliente è `projects.basket`, la fase è `project_tasks.task_type`.
 */
export default function AllocationCard({ allocation, onOpen, draggable = true }: Props) {
  const color = projectColor(allocation.project_id, allocation.color);

  return (
    <button
      type="button"
      onDoubleClick={() => onOpen?.(allocation)}
      style={{ borderLeftColor: color }}
      draggable={draggable}
      onDragStart={event => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(allocation.id));
      }}
      className={`group relative w-full rounded-sm border-l-4 bg-card px-2 py-1 text-left text-xs shadow-sm
        hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring
        ${allocation.tentative ? 'border-dashed opacity-70' : ''}`}
      title={`${allocation.project_name} — ${allocation.man_days.toLocaleString('it-IT')} g`}
    >
      <div className="truncate font-medium">{allocation.project_name}</div>
      {allocation.basket && (
        <div className="truncate text-[11px] text-muted-foreground">{allocation.basket}</div>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{TASK_LABELS[allocation.task_type as TaskType] ?? allocation.task_type}</span>
        <span className="font-semibold tabular-nums">
          {allocation.man_days.toLocaleString('it-IT')} g
        </span>
      </div>
      <span
        draggable={draggable}
        aria-hidden="true"
        title="Trascina per estendere"
        onDragStart={event => {
          // Senza stopPropagation partirebbe anche il drag della card e il
          // gesto verrebbe letto come spostamento.
          event.stopPropagation();
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', `resize:${allocation.id}`);
        }}
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r bg-foreground/20 opacity-0 group-hover:opacity-100"
      />
    </button>
  );
}
