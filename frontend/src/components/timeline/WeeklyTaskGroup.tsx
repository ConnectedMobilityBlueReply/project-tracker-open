import { TASK_LABELS, timeEntryKey } from '../../types';
import {
  isTaskCompleted, isWbsClosed, type TaskGroup, type WeekTask, type WeeklySaveState,
} from '../../pages/timelineTeamWeeklyModel';

interface Props {
  group: TaskGroup;
  localHours: Record<string, string>;
  saveStates: Record<string, WeeklySaveState>;
  rowErrors: Record<string, string>;
  onHoursChange: (key: string, value: string) => void;
  onSave: (row: WeekTask) => void;
}

const formatHours = (hours: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(hours);

/** Un'attivita' della Settimanale: intestazione + una riga per WBS. Niente card annidate. */
export default function WeeklyTaskGroup({ group, localHours, saveStates, rowErrors, onHoursChange, onSave }: Props) {
  const hasWbs = group.rows.some(row => row.wbs_item_id != null);
  const taskHours = group.rows.reduce(
    (sum, row) => sum + (Number(localHours[timeEntryKey(row.task_id, row.wbs_item_id)]) || 0), 0);
  const concluded = isTaskCompleted(group.taskStatus);
  const taskLabel = TASK_LABELS[group.taskType] ?? group.taskType;

  return (
    <div className="border-t border-border">
      <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-3 py-1.5">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{group.projectName}</span>
        <span className="text-sm font-medium text-foreground">{taskLabel}</span>
        {group.isExtra && <span className="font-mono text-[10px] text-primary">Extra</span>}
        {concluded && <span className="font-mono text-[10px] text-muted-foreground">Conclusa</span>}
        {hasWbs && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            Totale attività <strong className="text-foreground">{formatHours(taskHours)}h</strong>
          </span>
        )}
      </div>
      {group.rows.map(row => {
        const key = timeEntryKey(row.task_id, row.wbs_item_id);
        const rowConcluded = concluded || isWbsClosed(row.wbs_status);
        const state = saveStates[key];
        return (
          <div key={key} className="grid items-center gap-3 border-t border-border px-3 py-1.5 pl-6 sm:grid-cols-[1fr_7rem_6rem]">
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{row.wbs_item_name ?? 'Ore attività'}</p>
              {rowConcluded && <span className="text-[11px] text-muted-foreground">Conclusa · modificabile per correzioni</span>}
              {rowErrors[key] && <p className="text-[11px] font-medium text-destructive">{rowErrors[key]}</p>}
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.5"
                className={`h-8 w-full rounded-md border bg-background px-2 pr-6 text-right text-sm font-semibold tabular-nums text-foreground outline-none focus:border-primary ${rowErrors[key] ? 'border-destructive' : 'border-border'}`}
                value={localHours[key] ?? ''}
                aria-invalid={!!rowErrors[key]}
                onChange={event => onHoursChange(key, event.target.value)}
                onBlur={() => onSave(row)}
                onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                aria-label={`Ore per ${row.wbs_item_name ?? taskLabel}`}
                placeholder="0"
              />
              <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-muted-foreground">h</span>
            </div>
            <div className="text-right text-xs" aria-live="polite">
              {state === 'saving' ? (
                <span className="text-muted-foreground">Salvataggio…</span>
              ) : state === 'saved' ? (
                <span className="text-success">✓ Salvato</span>
              ) : state === 'error' ? (
                <span className="text-destructive">Errore di salvataggio</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
