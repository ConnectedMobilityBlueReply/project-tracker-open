import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cellState,
  weekTotalHours,
  rowTotalHours,
  isRowOverEstimate,
  parseHours,
  formatHours,
  capacityFill,
} from './consuntivazioneGrid.ts';

const row = (weeks, overrides = {}) => ({
  key: '1:none',
  task_id: 1,
  wbs_item_id: null,
  wbs_item_name: null,
  project_id: 1,
  project_name: 'Progetto',
  task_type: 'DEV',
  task_status: 'da lavorare',
  estimated_days: 10,
  total_man_days: 0,
  is_extra: false,
  available_wbs_items: [],
  weeks,
  ...overrides,
});

test('settimana assente dalla mappa: niente assegnato, niente consuntivato', () => {
  const state = cellState(row({}), '2026-08-17');
  assert.equal(state.kind, 'empty');
  assert.equal(state.loggedHours, 0);
  assert.equal(state.plannedHours, 0);
});

test('assegnato ma non consuntivato', () => {
  const state = cellState(
    row({ '2026-08-17': { entry_id: null, man_days: 0, planned_days: 1, notes: null } }),
    '2026-08-17');
  assert.equal(state.kind, 'planned');
  assert.equal(state.loggedHours, 0);
  assert.equal(state.plannedHours, 8);
});

test('consuntivato pari all assegnato', () => {
  const state = cellState(
    row({ '2026-08-17': { entry_id: 7, man_days: 1, planned_days: 1, notes: null } }),
    '2026-08-17');
  assert.equal(state.kind, 'logged');
  assert.equal(state.deltaHours, 0);
  assert.equal(state.isOver, false);
});

test('consuntivato oltre l assegnato', () => {
  const state = cellState(
    row({ '2026-08-17': { entry_id: 7, man_days: 1.5, planned_days: 1, notes: null } }),
    '2026-08-17');
  assert.equal(state.deltaHours, 4);
  assert.equal(state.isOver, true);
});

test('consuntivato con assegnato a zero non e sforamento', () => {
  // allocation_weeks e' poco popolata sui dati reali: senza assegnazione da
  // sforare, l'allarme non deve accendersi su ogni cella consuntivata.
  const state = cellState(
    row({ '2026-08-17': { entry_id: 7, man_days: 1, planned_days: 0, notes: null } }),
    '2026-08-17');
  assert.equal(state.deltaHours, 8);
  assert.equal(state.isOver, false);
});

test('voce extra: nessuna assegnazione, nessun delta', () => {
  const state = cellState(
    row({ '2026-08-17': { entry_id: 7, man_days: 0.5, planned_days: 0, notes: null } },
        { is_extra: true }),
    '2026-08-17');
  assert.equal(state.kind, 'extra');
  assert.equal(state.loggedHours, 4);
  assert.equal(state.isOver, false);
});

test('la nota rende la cella marcata', () => {
  const state = cellState(
    row({ '2026-08-17': { entry_id: 7, man_days: 1, planned_days: 1, notes: 'ciao' } }),
    '2026-08-17');
  assert.equal(state.hasNote, true);
});

test('totale di settimana su piu righe', () => {
  const rows = [
    row({ '2026-08-17': { entry_id: 1, man_days: 1, planned_days: 1, notes: null } }),
    row({ '2026-08-17': { entry_id: 2, man_days: 0.5, planned_days: 0, notes: null } },
        { key: '2:none', task_id: 2 }),
  ];
  assert.equal(weekTotalHours(rows, '2026-08-17'), 12);
  assert.equal(weekTotalHours(rows, '2026-08-24'), 0);
});

test('totale di riga sull intervallo, settimane fuori intervallo escluse', () => {
  const r = row({
    '2026-08-17': { entry_id: 1, man_days: 1, planned_days: 1, notes: null },
    '2026-08-24': { entry_id: 2, man_days: 2, planned_days: 1, notes: null },
    '2026-09-07': { entry_id: 3, man_days: 5, planned_days: 0, notes: null },
  });
  assert.equal(rowTotalHours(r, ['2026-08-17', '2026-08-24']), 24);
});

test('oltre la stima si misura sul consuntivato di sempre, non sull intervallo', () => {
  assert.equal(isRowOverEstimate(row({}, { estimated_days: 10, total_man_days: 12 })), true);
  assert.equal(isRowOverEstimate(row({}, { estimated_days: 10, total_man_days: 8 })), false);
  // Una voce extra non ha stima: non puo' superarla.
  assert.equal(isRowOverEstimate(row({}, { estimated_days: 0, total_man_days: 99, is_extra: true })), false);
});

test('parseHours accetta la virgola come separatore decimale', () => {
  assert.equal(parseHours('1,5'), 1.5);
});

test('parseHours accetta il punto come separatore decimale', () => {
  assert.equal(parseHours('1.5'), 1.5);
});

test('parseHours tratta la stringa vuota come zero', () => {
  assert.equal(parseHours(''), 0);
});

test('parseHours rifiuta un valore non numerico', () => {
  assert.equal(parseHours('abc'), null);
});

test('parseHours rifiuta un valore negativo', () => {
  assert.equal(parseHours('-5'), null);
});

test('formatHours non lascia decimali superflui', () => {
  assert.equal(formatHours(8), '8');
  assert.equal(formatHours(1.5), '1,5');
});

test('capacityFill: percentuale limitata, sopra capacità, capacità zero senza NaN', () => {
  assert.deepEqual(capacityFill(20, 40), { pct: 50, over: false });
  assert.deepEqual(capacityFill(40, 40), { pct: 100, over: false });
  assert.deepEqual(capacityFill(44, 40), { pct: 100, over: true });
  assert.deepEqual(capacityFill(0, 24), { pct: 0, over: false });
  assert.deepEqual(capacityFill(0, 0), { pct: 0, over: false });
  assert.deepEqual(capacityFill(2, 0), { pct: 100, over: true });
});
