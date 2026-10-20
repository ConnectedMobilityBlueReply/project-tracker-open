import assert from 'node:assert/strict';
import test from 'node:test';
import { utilizationLevel } from './capacity.ts';
import { personRows } from './scheduleRows.ts';
import {
  applyAssignment,
  applyToBacklog,
  assignmentHint,
  freeDays,
  hasAssignableWeek,
  planAssignment,
  rowKeyForPerson,
  teamTotals,
} from './scheduleBacklog.ts';

const WEEK = '2026-08-03';
const NEXT_WEEK = '2026-08-10';

const person = (id, name, capacity = 5) => ({
  id, name, job_title: null, team_id: 1, weekly_capacity_days: capacity,
});

const allocation = (id, taskAllocationId, personId, week, manDays) => ({
  id,
  task_allocation_id: taskAllocationId,
  task_id: 50,
  task_type: 'DEV',
  project_id: 100,
  project_name: 'Progetto 100',
  basket: null,
  color: null,
  person_id: personId,
  week_start: week,
  man_days: manDays,
  tentative: false,
});

const item = (taskAllocationId, personId, remaining, allocated = 0) => ({
  task_allocation_id: taskAllocationId,
  task_id: 50,
  person_id: personId,
  person_name: 'Anna',
  project_id: 100,
  project_name: 'Progetto 100',
  project_color: '#336699',
  task_type: 'DEV',
  estimated_days: remaining + allocated,
  allocated_days: allocated,
  remaining_days: remaining,
});

const anna = person(1, 'Anna');

test('freeDays: capacità meno allocato', () => {
  assert.equal(freeDays(anna, WEEK, [allocation(1, 7, 1, WEEK, 2)], [], []), 3);
});

test('freeDays: mai negativo se la persona è sovrallocata', () => {
  assert.equal(freeDays(anna, WEEK, [allocation(1, 7, 1, WEEK, 6)], [], []), 0);
});

test('freeDays: il lavoro in altri team riduce lo spazio libero', () => {
  const other = [{ person_id: 1, week_start: WEEK, man_days: 1 }];
  assert.equal(freeDays(anna, WEEK, [allocation(1, 7, 1, WEEK, 2)], [], other), 2);
});

test('freeDays: settimana di assenza piena = 0', () => {
  const timeOff = [{
    id: 1, person_id: 1, start_date: WEEK, end_date: '2026-08-07', type: 'ferie', tentative: false, notes: null,
  }];
  assert.equal(freeDays(anna, WEEK, [], timeOff, []), 0);
});

test('planAssignment: assegna il minimo tra libero e residuo', () => {
  assert.deepEqual(planAssignment(item(7, 1, 5), WEEK, [], 3), { addedDays: 3, manDays: 3 });
  assert.deepEqual(planAssignment(item(7, 1, 1.5), WEEK, [], 3), { addedDays: 1.5, manDays: 1.5 });
});

test('planAssignment: somma ai giorni già presenti sulla stessa allocazione e settimana', () => {
  const existing = [allocation(1, 7, 1, WEEK, 1)];
  assert.deepEqual(planAssignment(item(7, 1, 5), WEEK, existing, 3), { addedDays: 3, manDays: 4 });
});

test('planAssignment: un altro task_allocation nella stessa settimana non conta come esistente', () => {
  const other = [allocation(1, 99, 1, WEEK, 1)];
  assert.deepEqual(planAssignment(item(7, 1, 5), WEEK, other, 3), { addedDays: 3, manDays: 3 });
});

test('planAssignment: nulla da assegnare con zero libero o zero residuo', () => {
  assert.equal(planAssignment(item(7, 1, 5), WEEK, [], 0), null);
  assert.equal(planAssignment(item(7, 1, 0), WEEK, [], 3), null);
});

test('planAssignment: arrotonda i residui frazionari a 2 decimali', () => {
  assert.equal(planAssignment(item(7, 1, 5), WEEK, [], 0.1 + 0.2).addedDays, 0.3);
});

test('applyAssignment: sostituisce i giorni della settimana esistente', () => {
  const existing = [allocation(1, 7, 1, WEEK, 1)];
  const next = applyAssignment(existing, item(7, 1, 5), WEEK, { addedDays: 3, manDays: 4 }, -1);
  assert.equal(next.length, 1);
  assert.equal(next[0].man_days, 4);
  assert.equal(next[0].id, 1);
});

test('applyAssignment: aggiunge una card provvisoria con i dati del backlog', () => {
  const next = applyAssignment([], item(7, 1, 5), WEEK, { addedDays: 3, manDays: 3 }, -9);
  assert.equal(next.length, 1);
  assert.deepEqual(
    { id: next[0].id, ta: next[0].task_allocation_id, person: next[0].person_id, week: next[0].week_start,
      days: next[0].man_days, color: next[0].color, task: next[0].task_id, tentative: next[0].tentative },
    { id: -9, ta: 7, person: 1, week: WEEK, days: 3, color: '#336699', task: 50, tentative: false });
});

test('applyAssignment: non muta l\'array di partenza', () => {
  const existing = [allocation(1, 7, 1, WEEK, 1)];
  applyAssignment(existing, item(7, 1, 5), WEEK, { addedDays: 3, manDays: 4 }, -1);
  assert.equal(existing[0].man_days, 1);
});

test('applyToBacklog: scala il residuo e sposta i giorni su allocato', () => {
  const next = applyToBacklog([item(1, 1, 5), item(2, 1, 1)], 1, 2);
  assert.equal(next[0].remaining_days, 3);
  assert.equal(next[0].allocated_days, 2);
  assert.equal(next[1].remaining_days, 1);
});

test('applyToBacklog: l\'item sparisce a residuo zero', () => {
  const next = applyToBacklog([item(1, 1, 5), item(2, 1, 1)], 2, 1);
  assert.deepEqual(next.map(entry => entry.task_allocation_id), [1]);
});

test('applyToBacklog: id sconosciuto lascia tutto invariato', () => {
  const items = [item(1, 1, 5)];
  assert.deepEqual(applyToBacklog(items, 99, 2), items);
});

test('hasAssignableWeek: vero se almeno una settimana ha spazio', () => {
  const full = [allocation(1, 99, 1, WEEK, 5)];
  assert.equal(hasAssignableWeek(item(7, 1, 2), anna, [WEEK, NEXT_WEEK], full, [], []), true);
});

test('hasAssignableWeek: falso se tutte le settimane visibili sono piene', () => {
  const full = [allocation(1, 99, 1, WEEK, 5), allocation(2, 99, 1, NEXT_WEEK, 5)];
  assert.equal(hasAssignableWeek(item(7, 1, 2), anna, [WEEK, NEXT_WEEK], full, [], []), false);
});

test('rowKeyForPerson coincide con la chiave delle righe per persona', () => {
  assert.equal(rowKeyForPerson(1), personRows([anna], [])[0].key);
});

test('teamTotals: somma allocato e disponibile per colonna', () => {
  const carla = person(3, 'Carla');
  const totals = teamTotals(
    [anna, carla],
    [allocation(1, 7, 1, WEEK, 2)],
    [],
    [],
    [{ key: WEEK, weeks: [WEEK] }, { key: NEXT_WEEK, weeks: [NEXT_WEEK] }],
  );
  assert.deepEqual(totals.map(total => [total.key, total.allocated, total.available]), [
    [WEEK, 2, 10],
    [NEXT_WEEK, 0, 10],
  ]);
  assert.equal(totals[0].level, utilizationLevel(2, 10));
});

test('teamTotals: nessuna persona = colonne a zero', () => {
  const totals = teamTotals([], [], [], [], [{ key: WEEK, weeks: [WEEK] }]);
  assert.deepEqual(totals.map(total => [total.allocated, total.available]), [[0, 0]]);
});

test('assignmentHint: scala Mesi non consente di assegnare', () => {
  const hint = assignmentHint({
    item: item(7, 1, 2), zoom: 'months', personRow: { person: anna },
    weeks: [WEEK], allocations: [], timeOff: [], otherTeamLoad: [],
  });
  assert.equal(hint, 'months');
});

test('assignmentHint: persona nascosta dai filtri', () => {
  const hint = assignmentHint({
    item: item(7, 1, 2), zoom: 'weeks', personRow: undefined,
    weeks: [WEEK], allocations: [], timeOff: [], otherTeamLoad: [],
  });
  assert.equal(hint, 'person-hidden');
});

test('assignmentHint: nessuna settimana libera nel periodo visibile', () => {
  const hint = assignmentHint({
    item: item(7, 1, 2), zoom: 'weeks', personRow: { person: anna }, expanded: true,
    weeks: [WEEK], allocations: [allocation(1, 99, 1, WEEK, 5)], timeOff: [], otherTeamLoad: [],
  });
  assert.equal(hint, 'no-free-week');
});

test('assignmentHint: pronto quando c\'è almeno una settimana libera', () => {
  const hint = assignmentHint({
    item: item(7, 1, 2), zoom: 'weeks', personRow: { person: anna }, expanded: true,
    weeks: [WEEK], allocations: [], timeOff: [], otherTeamLoad: [],
  });
  assert.equal(hint, 'ready');
});

test('assignmentHint: riga della persona compressa', () => {
  const hint = assignmentHint({
    item: item(7, 1, 2), zoom: 'weeks', personRow: { person: anna }, expanded: false,
    weeks: [WEEK], allocations: [], timeOff: [], otherTeamLoad: [],
  });
  assert.equal(hint, 'row-collapsed');
});
