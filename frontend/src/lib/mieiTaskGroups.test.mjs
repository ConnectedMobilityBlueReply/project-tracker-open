import assert from 'node:assert/strict';
import test from 'node:test';
import { groupTasks, relativeDue, weekEndIso, TASK_GROUP_LABELS } from './mieiTaskGroups.ts';

// 2026-10-15 è un giovedì: la settimana va dal 12 al 18.
const TODAY = '2026-10-15';

test('weekEndIso: domenica della settimana corrente, anche di domenica e a cavallo di mese', () => {
  assert.equal(weekEndIso('2026-10-15'), '2026-10-18');
  assert.equal(weekEndIso('2026-10-18'), '2026-10-18');
  assert.equal(weekEndIso('2026-10-12'), '2026-10-18');
  assert.equal(weekEndIso('2026-10-29'), '2026-11-01');
});

test('groupTasks: ordine fisso, chiusi prima di tutto, scaduti solo se aperti', () => {
  const items = [
    { id: 1, status: 'aperto', planned_end: '2026-10-10' },
    { id: 2, status: 'chiuso', planned_end: '2026-10-01' },
    { id: 3, status: 'in_corso', planned_end: '2026-10-15' },
    { id: 4, status: 'aperto', planned_end: '2026-10-18' },
    { id: 5, status: 'aperto', planned_end: '2026-10-19' },
    { id: 6, status: 'aperto', planned_end: null },
    { id: 7, status: 'aperto' },
  ];
  const groups = groupTasks(items, TODAY);
  assert.deepEqual(groups.map(g => g.key), ['overdue', 'thisWeek', 'later', 'noDate', 'closed']);
  assert.deepEqual(groups.map(g => g.items.map(i => i.id)), [[1], [3, 4], [5], [6, 7], [2]]);
  assert.equal(groups[0].label, TASK_GROUP_LABELS.overdue);
});

test('groupTasks: dentro il gruppo, ordine per scadenza crescente', () => {
  const items = [
    { id: 1, status: 'aperto', planned_end: '2026-10-17' },
    { id: 2, status: 'aperto', planned_end: '2026-10-16' },
  ];
  assert.deepEqual(groupTasks(items, TODAY)[1].items.map(i => i.id), [2, 1]);
});

test('relativeDue: oggi, domani, tra N, ieri, N fa', () => {
  assert.deepEqual(relativeDue('2026-10-15', TODAY), { label: 'oggi', overdue: false });
  assert.deepEqual(relativeDue('2026-10-16', TODAY), { label: 'domani', overdue: false });
  assert.deepEqual(relativeDue('2026-10-18', TODAY), { label: 'tra 3 gg', overdue: false });
  assert.deepEqual(relativeDue('2026-10-14', TODAY), { label: 'ieri', overdue: true });
  assert.deepEqual(relativeDue('2026-10-13', TODAY), { label: '2 gg fa', overdue: true });
});

test('relativeDue regge i cambi di ora legale', () => {
  assert.deepEqual(relativeDue('2026-10-26', '2026-10-24'), { label: 'tra 2 gg', overdue: false });
});

test('groupTasks: sortBy project ordina per progetto poi scadenza', () => {
  const items = [
    { id: 1, status: 'aperto', planned_end: '2026-10-17', project_name: 'Alfa' },
    { id: 2, status: 'aperto', planned_end: '2026-10-15', project_name: 'Zeta' },
    { id: 3, status: 'aperto', planned_end: '2026-10-16', project_name: 'Alfa' },
  ];
  assert.deepEqual(groupTasks(items, TODAY, 'due')[1].items.map(i => i.id), [2, 3, 1]);
  assert.deepEqual(groupTasks(items, TODAY, 'project')[1].items.map(i => i.id), [3, 1, 2]);
});
