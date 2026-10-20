import type {
  ProjectTask,
  ScheduleAllocation,
  SchedulePerson,
  TaskType,
  UnplannedAssignment,
} from '../types';
import { TASK_LABELS } from '../types.ts';
import { allocationsByPerson } from './scheduleModel.ts';

/**
 * Una riga della griglia, indipendente dalla vista che l'ha prodotta.
 *
 * `person` resta obbligatoria anche nella vista per progetto: capacità e
 * assenze si calcolano per persona, e senza di lei la cella non saprebbe
 * quanto spazio residuo mostrare.
 */
export interface ScheduleRowModel {
  /** Chiave React, unica nella griglia. */
  key: string;
  /** Colonna sinistra, prima riga. */
  label: string;
  /** Colonna sinistra, seconda riga. `null` = niente sottotitolo. */
  subLabel: string | null;
  person: SchedulePerson;
  allocations: ScheduleAllocation[];
  /** Solo vista per persona: progetti a cui è assegnata ma senza ancora ore pianificate. */
  unplanned: UnplannedAssignment[];
  /** Solo vista per progetto: allocato e stimato della coppia attività-persona. */
  totals: { allocatedDays: number; estimatedDays: number } | null;
  /**
   * La `task_allocation` su cui scrive questa riga. `null` nella vista per
   * persona, dove una cella vuota non sa ancora di quale attività si parla:
   * lì l'attività la sceglie la modale di assegnazione.
   */
  taskAllocationId: number | null;
}

/** Righe = persone, card = tutti i progetti della persona. */
export function personRows(
  persons: SchedulePerson[],
  allocations: ScheduleAllocation[],
  unplanned: UnplannedAssignment[] = [],
): ScheduleRowModel[] {
  const byPerson = allocationsByPerson(allocations);
  return persons.map(person => ({
    key: `person-${person.id}`,
    label: person.name,
    subLabel: person.job_title,
    person,
    allocations: byPerson.get(person.id) ?? [],
    unplanned: unplanned.filter(a => a.person_id === person.id),
    totals: null,
    taskAllocationId: null,
  }));
}

/** Righe = attività×persona di un progetto, con il totale contro la stima. */
export function projectRows(
  tasks: ProjectTask[],
  persons: SchedulePerson[],
  allocations: ScheduleAllocation[],
  totals: Record<number, number>,
): ScheduleRowModel[] {
  const personById = new Map(persons.map(person => [person.id, person]));
  return tasks.flatMap(task =>
    (task.allocations ?? []).flatMap(taskAllocation => {
      const person = personById.get(taskAllocation.person_id);
      if (!person) return [];
      return [{
        key: `task-${task.id}-person-${taskAllocation.person_id}`,
        label: TASK_LABELS[task.task_type as TaskType] ?? task.task_type,
        subLabel: person.name,
        person,
        allocations: allocations.filter(a => a.task_allocation_id === taskAllocation.id),
        unplanned: [],
        totals: {
          allocatedDays: totals[taskAllocation.id] ?? 0,
          estimatedDays: taskAllocation.estimated_days,
        },
        taskAllocationId: taskAllocation.id,
      }];
    }),
  );
}

/**
 * Allocato e stimato di una singola `task_allocation`, per le modali che
 * mostrano il tetto senza costruire righe. `null` se l'id non appartiene al
 * progetto caricato.
 */
export function allocationCeiling(
  tasks: ProjectTask[],
  totals: Record<number, number>,
  taskAllocationId: number,
): { allocatedDays: number; estimatedDays: number } | null {
  for (const task of tasks) {
    for (const taskAllocation of task.allocations ?? []) {
      if (taskAllocation.id === taskAllocationId) {
        return {
          allocatedDays: totals[taskAllocationId] ?? 0,
          estimatedDays: taskAllocation.estimated_days,
        };
      }
    }
  }
  return null;
}
