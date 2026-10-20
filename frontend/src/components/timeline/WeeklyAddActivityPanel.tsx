import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { TASK_LABELS } from '../../types';
import { isTaskCompleted, isWbsClosed, type AddCandidate } from '../../pages/timelineTeamWeeklyModel';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  error: string | null;
  candidates: AddCandidate[];
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
  addingKey: string | null;
  onAdd: (candidate: AddCandidate) => void;
}

/** Ricerca e aggiunta di un'attivita' non assegnata. Lo stato vive nella Settimanale. */
export default function WeeklyAddActivityPanel({
  search, onSearchChange, error, candidates, drafts, onDraftChange, addingKey, onAdd,
}: Props) {
  return (
    <div className="border-y border-border bg-muted/30 px-3 py-3">
      <p className="text-sm font-medium text-foreground">Aggiungi un’attività non assegnata</p>
      <p className="mb-2 text-xs text-muted-foreground">Cerca almeno due caratteri. Le componenti WBS sono selezionabili singolarmente.</p>
      <Input
        value={search}
        onChange={event => onSearchChange(event.target.value)}
        placeholder="Es. AMS, sviluppo, collaudo…"
        aria-label="Cerca attività da aggiungere"
        className="h-8"
        autoFocus
      />
      {error && <p className="mt-2 text-xs font-medium text-destructive" role="alert">{error}</p>}
      {search.trim().length >= 2 && (
        <div className="mt-2 divide-y divide-border border-t border-border">
          {candidates.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Nessuna attività disponibile trovata.</p>
          ) : candidates.map(candidate => {
            const concluded = isTaskCompleted(candidate.taskStatus) || isWbsClosed(candidate.wbsStatus);
            return (
              <div key={candidate.key} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-52 flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{candidate.projectName}</p>
                  <p className="text-sm font-medium text-foreground">
                    {TASK_LABELS[candidate.taskType] ?? candidate.taskType}{candidate.wbsItemName ? ` · ${candidate.wbsItemName}` : ''}
                  </p>
                </div>
                {concluded && <span className="font-mono text-[11px] text-muted-foreground">Conclusa</span>}
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className="h-8 w-24 text-right"
                  value={drafts[candidate.key] ?? ''}
                  onChange={event => onDraftChange(candidate.key, event.target.value)}
                  placeholder="Ore"
                  aria-label={`Ore per ${candidate.projectName}`}
                />
                <Button size="sm" disabled={addingKey === candidate.key} onClick={() => onAdd(candidate)}>
                  {addingKey === candidate.key ? 'Aggiungo…' : 'Aggiungi'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
