import assert from 'node:assert/strict';
import test from 'node:test';
import { allocationCeiling, personRows, projectRows } from './scheduleRows.ts';

const person = (id, name) => ({
  id, name, job_title: null, team_id: 1, weekly_capacity_days: 5,
});

const allocation = (id, taskAllocationId, personId, projectId, weekStart, manDays) => ({
  id,
  task_allocation_id: taskAllocationId,
  task_id: 100 + taskAllocationId,
  task_type: 'DEV',
  project_id: projectId,
  project_name: `Progetto ${projectId}`,
  basket: null,
  color: null,
  person_id: personId,
  week_start: weekStart,
  man_days: manDays,
  tentative: false,
});

const taskAllocation = (id, personId, personName, estimatedDays) => ({
  id, task_id: 0, person_id: personId, person_name: personName, estimated_days: estimatedDays,
});

const task = (id, taskType, allocations) => ({
  id, project_id: 7, task_type: taskType, status: 'da lavorare', allocations,
});

test('vista per persona: una riga per persona, senza totali di stima', () => {
  // Arrange
  const persons = [person(1, 'Anna'), person(2, 'Bruno')];
  const allocations = [allocation(10, 500, 1, 7, '2026-08-17', 2)];

  // Act
  const rows = personRows(persons, allocations);

  // Assert
  assert.deepEqual(rows.map(row => row.label), ['Anna', 'Bruno']);
  assert.deepEqual(rows.map(row => row.allocations.length), [1, 0]);
  assert.equal(rows[0].totals, null);
  assert.equal(rows[0].taskAllocationId, null);
  assert.equal(rows[0].person.id, 1);
});

test('vista per persona: le assegnazioni senza ore finiscono sulla riga della persona', () => {
  // Arrange
  const persons = [person(1, 'Anna'), person(2, 'Bruno')];
  const pending = [{
    task_allocation_id: 9, task_id: 9, task_type: 'GEN', project_id: 7, project_name: 'Progetto 7',
    color: null, person_id: 2,
  }];

  // Act
  const rows = personRows(persons, [], pending);

  // Assert
  assert.deepEqual(rows.map(row => row.unplanned.length), [0, 1]);
  assert.equal(rows[1].unplanned[0].project_name, 'Progetto 7');
  assert.deepEqual(personRows(persons, []).map(row => row.unplanned), [[], []]);
});

test('vista per persona: due progetti nella stessa settimana stanno nella stessa riga', () => {
  // Arrange — la cella persona×settimana ospita più card, non una sola.
  const persons = [person(1, 'Anna')];
  const allocations = [
    allocation(10, 500, 1, 7, '2026-08-17', 2),
    allocation(11, 501, 1, 8, '2026-08-17', 1),
  ];

  // Act
  const rows = personRows(persons, allocations);

  // Assert
  assert.equal(rows.length, 1);
  assert.deepEqual(
    rows[0].allocations.filter(a => a.week_start === '2026-08-17').map(a => a.project_id),
    [7, 8],
  );
});

test('vista per progetto: una riga per coppia attività-persona, etichettata con la fase', () => {
  // Arrange
  const persons = [person(1, 'Anna'), person(2, 'Bruno')];
  const tasks = [
    task(100, 'DEV', [taskAllocation(500, 1, 'Anna', 10), taskAllocation(501, 2, 'Bruno', 4)]),
    task(101, 'UAT', [taskAllocation(502, 1, 'Anna', 3)]),
  ];
  const allocations = [
    allocation(10, 500, 1, 7, '2026-08-17', 2),
    allocation(11, 502, 1, 7, '2026-08-17', 1),
  ];

  // Act
  const rows = projectRows(tasks, persons, allocations, { 500: 6, 501: 0, 502: 1 });

  // Assert
  assert.deepEqual(
    rows.map(row => [row.label, row.subLabel]),
    [['Sviluppo', 'Anna'], ['Sviluppo', 'Bruno'], ['UAT', 'Anna']],
  );
  // Ogni riga vede solo le allocazioni della propria task_allocation.
  assert.deepEqual(rows.map(row => row.allocations.map(a => a.id)), [[10], [], [11]]);
  assert.deepEqual(rows.map(row => row.taskAllocationId), [500, 501, 502]);
  // Chiavi uniche: due righe della stessa persona non collidono.
  assert.equal(new Set(rows.map(row => row.key)).size, rows.length);
});

test('vista per progetto: totale allocato contro stima, sopra e sotto il tetto', () => {
  // Arrange
  const persons = [person(1, 'Anna')];
  const tasks = [task(100, 'DEV', [taskAllocation(500, 1, 'Anna', 10)])];

  // Act
  const under = projectRows(tasks, persons, [], { 500: 6 });
  const over = projectRows(tasks, persons, [], { 500: 12 });

  // Assert — il modello espone i due numeri, non il verdetto: colorare è
  // compito della griglia, e il superamento non blocca mai il salvataggio.
  assert.deepEqual(under[0].totals, { allocatedDays: 6, estimatedDays: 10 });
  assert.deepEqual(over[0].totals, { allocatedDays: 12, estimatedDays: 10 });
});

test('vista per progetto: una task_allocation senza persona nel payload non produce riga', () => {
  // Arrange — /api/schedule elenca le persone; se una manca, la riga non ha
  // capacità né assenze e disegnarla darebbe numeri inventati.
  const persons = [person(1, 'Anna')];
  const tasks = [task(100, 'DEV', [taskAllocation(500, 1, 'Anna', 10), taskAllocation(501, 99, 'Fantasma', 4)])];

  // Act
  const rows = projectRows(tasks, persons, [], {});

  // Assert
  assert.deepEqual(rows.map(row => row.subLabel), ['Anna']);
});

test('vista per progetto: totale assente vale zero, non NaN', () => {
  // Arrange
  const persons = [person(1, 'Anna')];
  const tasks = [task(100, 'DEV', [taskAllocation(500, 1, 'Anna', 10)])];

  // Act
  const rows = projectRows(tasks, persons, [], {});

  // Assert
  assert.deepEqual(rows[0].totals, { allocatedDays: 0, estimatedDays: 10 });
});

test('il tetto della stima si legge anche fuori dalle righe, per la modale', () => {
  // Arrange
  const tasks = [task(100, 'DEV', [taskAllocation(500, 1, 'Anna', 10)])];

  // Act & Assert
  assert.deepEqual(allocationCeiling(tasks, { 500: 6 }, 500), { allocatedDays: 6, estimatedDays: 10 });
  assert.equal(allocationCeiling(tasks, { 500: 6 }, 999), null);
});
