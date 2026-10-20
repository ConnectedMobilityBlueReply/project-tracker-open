import assert from 'node:assert/strict';
import test from 'node:test';
import {
  localTodayIso,
  periodGroupOf,
  isOverdue,
  groupByPeriod,
  kanbanColumns,
  canEditProgress,
  canEditPriority,
  positiveIntOrNull,
  filterPlanning,
  projectOptions,
  personOptions,
  groupByProject,
  ganttWindow,
  ganttSpan,
  MAX_GANTT_WEEKS,
  dueDateFormat,
  withoutKey,
  legacyScheduleTarget,
} from './planningModel.ts';

const wbs = (over = {}) => ({
  id: 1, task_id: 10, task_type: 'DEV', project_id: 100, project_name: 'Alfa', project_color: null,
  name: 'WBS', status: 'aperto', priority: 'medium', completion_pct: 0,
  planned_start: null, planned_end: null, assignee_person_id: null, assignee_person_name: null,
  ...over,
});

test('localTodayIso usa il calendario locale, non UTC', () => {
  // 1 gennaio 00:30 locale: in UTC+1 toISOString darebbe ancora il 31 dicembre.
  assert.equal(localTodayIso(new Date(2027, 0, 1, 0, 30)), '2027-01-01');
});

test('periodGroupOf: chiusa, senza data, ritardo, questo mese, prossimo, più avanti', () => {
  const today = '2026-10-06';
  assert.equal(periodGroupOf(wbs({ status: 'chiuso', planned_end: '2026-01-01' }), today), 'closed');
  assert.equal(periodGroupOf(wbs({ planned_end: null }), today), 'no_date');
  assert.equal(periodGroupOf(wbs({ planned_end: '2026-10-05' }), today), 'overdue');
  assert.equal(periodGroupOf(wbs({ planned_end: '2026-10-06' }), today), 'this_month');
  assert.equal(periodGroupOf(wbs({ planned_end: '2026-10-31' }), today), 'this_month');
  assert.equal(periodGroupOf(wbs({ planned_end: '2026-11-01' }), today), 'next_month');
  assert.equal(periodGroupOf(wbs({ planned_end: '2026-12-01' }), today), 'later');
});

test('periodGroupOf: a dicembre il prossimo mese è gennaio dell\'anno dopo', () => {
  assert.equal(periodGroupOf(wbs({ planned_end: '2027-01-15' }), '2026-12-20'), 'next_month');
  assert.equal(periodGroupOf(wbs({ planned_end: '2027-02-01' }), '2026-12-20'), 'later');
});

test('isOverdue ignora le chiuse e le senza data', () => {
  assert.equal(isOverdue(wbs({ planned_end: '2026-10-01' }), '2026-10-06'), true);
  assert.equal(isOverdue(wbs({ planned_end: '2026-10-01', status: 'chiuso' }), '2026-10-06'), false);
  assert.equal(isOverdue(wbs({ planned_end: undefined }), '2026-10-06'), false);
});

test('groupByPeriod: ordine fisso, gruppi vuoti omessi, ordine interno preservato', () => {
  const items = [
    wbs({ id: 1, planned_end: '2026-11-03' }),
    wbs({ id: 2, planned_end: '2026-10-01' }),
    wbs({ id: 3, planned_end: '2026-10-20' }),
    wbs({ id: 4, planned_end: '2026-10-10' }),
    wbs({ id: 5, status: 'chiuso' }),
  ];
  const groups = groupByPeriod(items, '2026-10-06');
  assert.deepEqual(groups.map(g => g.key), ['overdue', 'this_month', 'next_month', 'closed']);
  assert.deepEqual(groups[1].items.map(i => i.id), [3, 4]);
});

test('kanbanColumns: tre colonne per stato, scadenza crescente, senza data in fondo', () => {
  const columns = kanbanColumns([
    wbs({ id: 1, status: 'in_corso', planned_end: null }),
    wbs({ id: 2, status: 'in_corso', planned_end: '2026-10-20' }),
    wbs({ id: 3, status: 'in_corso', planned_end: '2026-10-10' }),
    wbs({ id: 4, status: 'chiuso' }),
  ]);
  assert.deepEqual(columns.aperto, []);
  assert.deepEqual(columns.in_corso.map(i => i.id), [3, 2, 1]);
  assert.deepEqual(columns.chiuso.map(i => i.id), [4]);
});

test('canEditProgress: PM sempre, member solo se owner, anonimo mai', () => {
  const mine = wbs({ assignee_person_id: 7 });
  const other = wbs({ assignee_person_id: 8 });
  assert.equal(canEditProgress({ personId: 7, appRole: 'member' }, mine), true);
  assert.equal(canEditProgress({ personId: 7, appRole: 'member' }, other), false);
  assert.equal(canEditProgress({ personId: 7, appRole: 'member' }, wbs()), false);
  assert.equal(canEditProgress({ personId: 1, appRole: 'pm' }, other), true);
  assert.equal(canEditProgress(null, mine), false);
});

test('canEditPriority: solo PM e admin', () => {
  assert.equal(canEditPriority({ personId: 7, appRole: 'member' }), false);
  assert.equal(canEditPriority({ personId: 7, appRole: 'pm' }), true);
  assert.equal(canEditPriority({ personId: 7, appRole: 'admin' }), true);
  assert.equal(canEditPriority(null), false);
});

test('positiveIntOrNull: l\'URL è input non fidato', () => {
  assert.equal(positiveIntOrNull('12'), 12);
  assert.equal(positiveIntOrNull(null), null);
  assert.equal(positiveIntOrNull('abc'), null);
  assert.equal(positiveIntOrNull('-3'), null);
  assert.equal(positiveIntOrNull('1.5'), null);
  assert.equal(positiveIntOrNull('0'), null);
});

test('filterPlanning per progetto e persona, null = nessun filtro', () => {
  const items = [
    wbs({ id: 1, project_id: 100, assignee_person_id: 7 }),
    wbs({ id: 2, project_id: 200, assignee_person_id: 7 }),
    wbs({ id: 3, project_id: 100, assignee_person_id: 8 }),
  ];
  assert.deepEqual(filterPlanning(items, { projectId: 100, personId: null }).map(i => i.id), [1, 3]);
  assert.deepEqual(filterPlanning(items, { projectId: null, personId: 7 }).map(i => i.id), [1, 2]);
  assert.deepEqual(filterPlanning(items, { projectId: 100, personId: 7 }).map(i => i.id), [1]);
  assert.equal(filterPlanning(items, { projectId: null, personId: null }).length, 3);
});

test('projectOptions e personOptions: unici, ordinati per nome, self incluso', () => {
  const items = [
    wbs({ project_id: 200, project_name: 'Beta', assignee_person_id: 8, assignee_person_name: 'Zoe' }),
    wbs({ project_id: 100, project_name: 'Alfa', assignee_person_id: 7, assignee_person_name: 'Ada' }),
    wbs({ project_id: 100, project_name: 'Alfa', assignee_person_id: null }),
  ];
  assert.deepEqual(projectOptions(items), [{ id: 100, name: 'Alfa' }, { id: 200, name: 'Beta' }]);
  assert.deepEqual(personOptions(items), [{ id: 7, name: 'Ada' }, { id: 8, name: 'Zoe' }]);
  assert.deepEqual(
    personOptions(items, { id: 9, name: 'Io' }),
    [{ id: 7, name: 'Ada' }, { id: 9, name: 'Io' }, { id: 8, name: 'Zoe' }],
  );
});

test('groupByProject raggruppa per progetto in ordine di nome', () => {
  const groups = groupByProject([
    wbs({ id: 1, project_id: 200, project_name: 'Beta', project_color: '#123456' }),
    wbs({ id: 2, project_id: 100, project_name: 'Alfa' }),
    wbs({ id: 3, project_id: 200, project_name: 'Beta', project_color: '#123456' }),
  ]);
  assert.deepEqual(groups.map(g => [g.projectId, g.items.map(i => i.id)]), [[100, [2]], [200, [1, 3]]]);
  assert.equal(groups[1].projectColor, '#123456');
});

test('ganttWindow: lunedì dal minimo al massimo, conta le WBS senza date', () => {
  const window = ganttWindow([
    wbs({ planned_start: '2026-10-07', planned_end: '2026-10-20' }),
    wbs({ planned_end: '2026-11-02' }),
    wbs(),
  ], '2026-10-06');
  assert.equal(window.weeks[0], '2026-10-05');
  assert.equal(window.weeks.at(-1), '2026-11-02');
  assert.equal(window.undated, 1);
  assert.equal(window.outside, 0);
});

test('ganttWindow: nessuna data → nessuna settimana', () => {
  assert.deepEqual(ganttWindow([wbs()], '2026-10-06'), { weeks: [], undated: 1, outside: 0 });
});

test('ganttWindow tronca a MAX_GANTT_WEEKS', () => {
  const window = ganttWindow([wbs({ planned_start: '2020-01-06', planned_end: '2030-01-07' })], '2020-01-06');
  assert.equal(window.weeks.length, MAX_GANTT_WEEKS);
});

test('ganttWindow mantiene visibili le WBS correnti e conta quelle storiche fuori finestra', () => {
  const items = [
    wbs({ id: 1, status: 'chiuso', planned_start: '2024-03-01', planned_end: '2024-03-10' }),
    wbs({ id: 2, planned_start: '2026-10-05', planned_end: '2026-10-20' }),
  ];
  const window = ganttWindow(items, '2026-10-06');

  assert.ok(window.weeks.includes('2026-10-05'));
  assert.notEqual(ganttSpan(items[1], window.weeks), null);
  assert.equal(ganttSpan(items[0], window.weeks), null);
  assert.equal(window.outside, 1);
});

test('ganttSpan: indice e lunghezza in settimane, una data sola = una settimana', () => {
  const weeks = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
  assert.deepEqual(ganttSpan(wbs({ planned_start: '2026-10-13', planned_end: '2026-10-21' }), weeks), { startIndex: 1, length: 2 });
  assert.deepEqual(ganttSpan(wbs({ planned_end: '2026-10-28' }), weeks), { startIndex: 3, length: 1 });
  assert.equal(ganttSpan(wbs(), weeks), null);
});

test('ganttSpan con date invertite: barra valida, non negativa', () => {
  const weeks = ['2026-10-05', '2026-10-12', '2026-10-19'];
  assert.deepEqual(ganttSpan(wbs({ planned_start: '2026-10-20', planned_end: '2026-10-06' }), weeks), { startIndex: 0, length: 3 });
});

test('ganttSpan taglia ai bordi della finestra e scarta ciò che è fuori', () => {
  const weeks = ['2026-10-05', '2026-10-12'];
  assert.deepEqual(ganttSpan(wbs({ planned_start: '2026-09-01', planned_end: '2026-12-01' }), weeks), { startIndex: 0, length: 2 });
  assert.equal(ganttSpan(wbs({ planned_start: '2027-01-04', planned_end: '2027-01-05' }), weeks), null);
});

test('dueDateFormat mostra l’anno solo per una scadenza di un altro anno locale', () => {
  assert.equal(dueDateFormat('2026-12-01', 2026), 'd MMM');
  assert.equal(dueDateFormat('2025-12-01', 2026), 'd MMM yyyy');
});

test('withoutKey restituisce una copia senza la chiave', () => {
  const original = { 1: 'a', 2: 'b' };
  assert.deepEqual(withoutKey(original, 1), { 2: 'b' });
  assert.deepEqual(original, { 1: 'a', 2: 'b' });
});

test('legacyScheduleTarget: PM alla Capacità con la query, member alla Table', () => {
  assert.equal(legacyScheduleTarget('pm', '?view=project&project=4'), '/planning/capacita?view=project&project=4');
  assert.equal(legacyScheduleTarget('admin', ''), '/planning/capacita');
  assert.equal(legacyScheduleTarget('member', '?view=project'), '/planning/table');
});
