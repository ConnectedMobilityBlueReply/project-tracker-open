import { useEffect, useState } from 'react';
import {
  getAllocationTotals,
  getProjects,
  getProjectTasks,
  upsertAllocation,
  upsertAllocationWeek,
} from '../../api';
import type { Project, ProjectTask, TaskType } from '../../types';
import { TASK_LABELS } from '../../types';
import { isPhaseless, resolveAssignTask } from '../../lib/phasesMode';
import { isPlannableProject } from '../../lib/plannableProject';
import { allocationCeiling } from '../../lib/scheduleRows';
import { daysToHours, hoursToDays } from '../../lib/units';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

export interface AssignTarget {
  personId: number;
  personName: string;
  weekStart: string;
  /**
   * Progetto della riga cliccata: valorizzato solo nella vista per progetto,
   * dove precompila la <select> "Progetto" restando comunque modificabile.
   * `null` nella vista per persona.
   */
  projectId: number | null;
  /**
   * Nella vista per progetto la riga sa già su quale `task_allocation`
   * scrivere: precompila progetto e attività non appena i task del progetto
   * sono disponibili, ma entrambe le <select> restano modificabili.
   */
  taskAllocationId: number | null;
}

interface Props {
  open: boolean;
  target: AssignTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

const INVALID_HOURS_MESSAGE = 'Inserire un numero di ore maggiore o uguale a zero';
const NO_TASK_MESSAGE = 'Selezionare progetto e attività';
const NO_PROJECT_MESSAGE = 'Selezionare il progetto';

/** Risale al task che possiede l'allocazione, per precompilare la <select> Attività. */
function findTaskByAllocationId(tasks: ProjectTask[], taskAllocationId: number | null): number | null {
  if (taskAllocationId == null) return null;
  return tasks.find(task => task.allocations.some(a => a.id === taskAllocationId))?.id ?? null;
}

export default function AssignModal({ open, target, onClose, onSaved }: Props) {
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name' | 'uses_phases' | 'is_virtual'>[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [totals, setTotals] = useState<Record<number, number>>({});
  const [taskId, setTaskId] = useState<number | null>(null);
  const [hours, setHours] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Riallinea i campi a ogni apertura: la chiave porta dentro `open` e non
  // solo il bersaglio, così riaprire la stessa cella non ripropone il valore
  // digitato e annullato come se fosse salvato.
  const [lastKey, setLastKey] = useState<string | null>(null);
  const openKey = open && target
    ? `${target.personId}-${target.weekStart}-${target.taskAllocationId ?? 'new'}`
    : null;
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (open) {
      const nextProjectId = target?.projectId ?? null;
      setProjectId(nextProjectId);
      // Se il progetto è lo stesso dell'apertura precedente i task sono già
      // in stato e l'attività si precompila subito; altrimenti ci pensa
      // l'effetto sotto non appena arrivano dal backend.
      setTaskId(nextProjectId === projectId
        ? findTaskByAllocationId(tasks, target?.taskAllocationId ?? null)
        : null);
      setHours('');
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    // getProjects() esclude già i progetti virtuali per default.
    // Progetti conclusi o lavorati a consuntivo: il backend rifiuta la pianificazione, non si offrono.
    getProjects()
      .then(all => setProjects(all.filter(isPlannableProject).map(({ id, name, uses_phases, is_virtual }) => ({ id, name, uses_phases, is_virtual }))))
      .catch((err: Error) => setError(err.message || 'Caricamento dei progetti non riuscito'));
  }, [open]);

  useEffect(() => {
    if (projectId == null) {
      setTasks([]);
      setTotals({});
      return;
    }
    void Promise.all([getProjectTasks(projectId), getAllocationTotals(projectId)])
      .then(([loadedTasks, loadedTotals]) => {
        setTasks(loadedTasks);
        setTotals(Object.fromEntries(loadedTotals.map(t => [t.task_allocation_id, t.total_days])));
        // Precompila l'attività dalla riga cliccata, ora che i task del
        // progetto sono disponibili.
        if (target?.projectId === projectId) {
          setTaskId(findTaskByAllocationId(loadedTasks, target?.taskAllocationId ?? null));
        }
      })
      .catch((err: Error) => setError(err.message || 'Caricamento delle attività non riuscito'));
  }, [projectId]);

  const selectedProject = projects.find(project => project.id === projectId) ?? null;
  // Senza fasi il lavoro va sul GEN implicito: nessuna attività da scegliere.
  const phaseless = selectedProject != null && isPhaseless(selectedProject);
  const selectedTask = resolveAssignTask(selectedProject, tasks, taskId);
  const existing = selectedTask?.allocations?.find(a => a.person_id === target?.personId) ?? null;
  const ceiling = existing ? allocationCeiling(tasks, totals, existing.id) : null;
  const enteredHours = Number(hours.trim().replace(',', '.'));
  const projectedDays = Number.isFinite(enteredHours)
    ? (ceiling?.allocatedDays ?? 0) + hoursToDays(enteredHours)
    : (ceiling?.allocatedDays ?? 0);
  // Avviso, mai blocco: superare la stima resta possibile per costruzione.
  const isOverEstimate = ceiling != null
    && ceiling.estimatedDays > 0
    && projectedDays > ceiling.estimatedDays;

  const save = async () => {
    if (!target) return;
    const raw = hours.trim();
    const parsed = Number(raw.replace(',', '.'));
    if (raw === '' || !Number.isFinite(parsed) || parsed < 0) {
      setError(INVALID_HOURS_MESSAGE);
      return;
    }
    if (!selectedTask) {
      setError(phaseless || projectId == null ? NO_PROJECT_MESSAGE : NO_TASK_MESSAGE);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let taskAllocationId = existing?.id ?? null;
      if (taskAllocationId == null) {
        // Prima scrittura: la persona non era ancora assegnata al progetto.
        // La stima non si chiede qui: si definisce nel progetto. Un fallimento
        // della seconda scrittura lascia un'allocazione a zero ore — stato
        // coerente, non un orfano.
        const created = await upsertAllocation(selectedTask.id, {
          person_id: target.personId,
          estimated_days: 0,
        });
        taskAllocationId = created.id;
      }
      await upsertAllocationWeek({
        task_allocation_id: taskAllocationId,
        week_start: target.weekStart,
        man_days: hoursToDays(parsed),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Assegnazione non riuscita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Assegna lavoro</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {target?.personName} — settimana del {target?.weekStart}
          </p>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Progetto</span>
            <select
              value={projectId == null ? '' : String(projectId)}
              onChange={event => {
                setProjectId(event.target.value === '' ? null : Number(event.target.value));
                setTaskId(null);
              }}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Seleziona…</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>

          {!phaseless && (
            <label className="block space-y-1">
              <span className="text-sm font-medium">Attività</span>
              <select
                value={taskId == null ? '' : String(taskId)}
                onChange={event => setTaskId(event.target.value === '' ? null : Number(event.target.value))}
                disabled={projectId == null}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Seleziona…</option>
                {tasks.map(task => (
                  <option key={task.id} value={task.id}>
                    {TASK_LABELS[task.task_type as TaskType] ?? task.task_type}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-medium">Ore da lavorare</span>
            <Input
              value={hours}
              onChange={event => setHours(event.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
          </label>

          {selectedTask && !existing && (
            <p className="text-xs text-muted-foreground">
              Nessuna assegnazione di {target?.personName} a questo progetto: viene creata ora.
            </p>
          )}

          {ceiling && (
            <p className={`text-sm ${isOverEstimate ? 'text-warning' : 'text-muted-foreground'}`}>
              assegnato {daysToHours(projectedDays)}h / stimato {daysToHours(ceiling.estimatedDays)}h
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Salvataggio…' : 'Assegna'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
