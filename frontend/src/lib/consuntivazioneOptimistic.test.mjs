import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rangeRowKey, applySavedHours, addableActivities, draftRow, mergeDraftRows,
} from './consuntivazioneOptimistic.ts';

const row = (over = {}) => ({
  key: '10:none', task_id: 10, wbs_item_id: null, wbs_item_name: null,
  project_id: 1, project_name: 'Alfa', task_type: 'DEV', task_status: 'aperto',
  estimated_days: 5, total_man_days: 2, is_extra: false, available_wbs_items: [],
  weeks: { '2026-10-12': { entry_id: 7, man_days: 1, planned_days: 1, notes: 'n' } },
  ...over,
});

test('rangeRowKey usa il formato del backend', () => {
  assert.equal(rangeRowKey(10, null), '10:none');
  assert.equal(rangeRowKey(10, 3), '10:3');
});

test('applySavedHours aggiorna cella e totale senza mutare', () => {
  const rows = [row()];
  const next = applySavedHours(rows, '10:none', '2026-10-12', 16, 7);
  assert.equal(next[0].weeks['2026-10-12'].man_days, 2);
  assert.equal(next[0].total_man_days, 3);
  assert.equal(next[0].weeks['2026-10-12'].notes, 'n');
  assert.equal(next[0].weeks['2026-10-12'].planned_days, 1);
  assert.equal(rows[0].weeks['2026-10-12'].man_days, 1, 'input non mutato');
});

test('applySavedHours su settimana vuota crea la cella', () => {
  const next = applySavedHours([row()], '10:none', '2026-10-19', 4, 99);
  assert.deepEqual(next[0].weeks['2026-10-19'], { entry_id: 99, man_days: 0.5, planned_days: 0, notes: null });
  assert.equal(next[0].total_man_days, 2.5);
});

test('applySavedHours a 0 ore conserva entry_id come il backend', () => {
  const next = applySavedHours([row()], '10:none', '2026-10-12', 0, 7);
  assert.equal(next[0].weeks['2026-10-12'].entry_id, 7);
  assert.equal(next[0].weeks['2026-10-12'].man_days, 0);
  assert.equal(next[0].total_man_days, 1);
});

test('applySavedHours lascia invariate le altre righe', () => {
  const other = row({ key: '11:none', task_id: 11 });
  const next = applySavedHours([row(), other], '10:none', '2026-10-12', 8, 7);
  assert.equal(next[1], other);
});

const projects = [
  { id: 1, name: 'Alfa', is_virtual: 0, uses_phases: true, tasks: [
    { id: 10, project_id: 1, task_type: 'DEV', status: 'aperto', wbs_items: [] },
    { id: 12, project_id: 1, task_type: 'SIT', status: 'aperto', wbs_items: [] },
  ] },
  { id: 2, name: 'Beta', is_virtual: 0, uses_phases: false, tasks: [
    { id: 20, project_id: 2, task_type: 'GEN', status: 'aperto', wbs_items: [] },
    { id: 21, project_id: 2, task_type: 'DEV', status: 'aperto', wbs_items: [] },
  ] },
];

test('addableActivities esclude le righe già presenti e usa solo GEN sui progetti senza fasi', () => {
  const list = addableActivities(projects, [row()]);
  assert.deepEqual(list.map(a => a.key), ['12:none', '20:none']);
  assert.equal(list[0].label, 'Alfa — SIT/FUN');
  assert.equal(list[1].label, 'Beta');
});

test('draftRow produce una riga vuota extra con la chiave giusta', () => {
  const [activity] = addableActivities(projects, []);
  const draft = draftRow(activity);
  assert.equal(draft.key, '10:none');
  assert.equal(draft.is_extra, true);
  assert.deepEqual(draft.weeks, {});
  assert.equal(draft.total_man_days, 0);
});

test('mergeDraftRows accoda solo le bozze non già arrivate dal server', () => {
  const drafts = [draftRow(addableActivities(projects, [])[0]), draftRow(addableActivities(projects, [])[1])];
  const merged = mergeDraftRows([row()], drafts);
  assert.deepEqual(merged.map(r => r.key), ['10:none', '12:none']);
});
