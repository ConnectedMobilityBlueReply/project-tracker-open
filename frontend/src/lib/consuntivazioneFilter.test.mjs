import assert from 'node:assert/strict';
import test from 'node:test';
import { filterRows } from './consuntivazioneFilter.ts';

const row = (overrides = {}) => ({
  key: '1:none',
  task_id: 1,
  wbs_item_id: null,
  wbs_item_name: null,
  project_id: 1,
  project_name: 'Progetto Alfa',
  task_type: 'DEV',
  task_status: 'da lavorare',
  estimated_days: 10,
  total_man_days: 0,
  is_extra: false,
  available_wbs_items: [],
  weeks: {},
  ...overrides,
});

const weeks = ['2026-08-17', '2026-08-24'];

test('ricerca vuota restituisce tutte le righe', () => {
  // Arrange
  const rows = [row({ project_name: 'Progetto Alfa' }), row({ project_name: 'Progetto Beta' })];

  // Act
  const result = filterRows(rows, weeks, '', 'all');

  // Assert
  assert.equal(result.length, 2);
});

test('ricerca combacia sul nome del progetto', () => {
  // Arrange
  const rows = [row({ project_name: 'Progetto Alfa' }), row({ project_name: 'Progetto Beta' })];

  // Act
  const result = filterRows(rows, weeks, 'alfa', 'all');

  // Assert
  assert.deepEqual(result.map(r => r.project_name), ['Progetto Alfa']);
});

test('ricerca combacia sul nome dell attivita (etichetta del task_type)', () => {
  // Arrange — TASK_LABELS.DEV === 'Sviluppo': la ricerca deve colpire l'etichetta, non il codice grezzo.
  const rows = [row({ task_type: 'DEV' }), row({ task_type: 'UAT' })];

  // Act
  const result = filterRows(rows, weeks, 'sviluppo', 'all');

  // Assert
  assert.deepEqual(result.map(r => r.task_type), ['DEV']);
});

test('ricerca combacia sul nome del componente WBS', () => {
  // Arrange
  const rows = [
    row({ wbs_item_name: 'Modulo Pagamenti' }),
    row({ wbs_item_name: 'Modulo Notifiche' }),
  ];

  // Act
  const result = filterRows(rows, weeks, 'pagamenti', 'all');

  // Assert
  assert.deepEqual(result.map(r => r.wbs_item_name), ['Modulo Pagamenti']);
});

test('ricerca senza risultati restituisce array vuoto', () => {
  // Arrange
  const rows = [row({ project_name: 'Progetto Alfa' })];

  // Act
  const result = filterRows(rows, weeks, 'inesistente', 'all');

  // Assert
  assert.deepEqual(result, []);
});

test('rowFilter "all" non restringe le righe', () => {
  // Arrange
  const rows = [row({ weeks: {} }), row({ weeks: { '2026-08-17': { entry_id: 1, man_days: 2, planned_days: 0, notes: null } } })];

  // Act
  const result = filterRows(rows, weeks, '', 'all');

  // Assert
  assert.equal(result.length, 2);
});

test('rowFilter "with-days" tiene solo le righe con ore in una settimana visibile', () => {
  // Arrange
  const withHours = row({
    key: 'with-hours',
    weeks: { '2026-08-17': { entry_id: 1, man_days: 1, planned_days: 0, notes: null } },
  });
  const withoutHours = row({
    key: 'without-hours',
    weeks: { '2026-08-17': { entry_id: 2, man_days: 0, planned_days: 2, notes: null } },
  });
  const noEntry = row({ key: 'no-entry', weeks: {} });

  // Act
  const result = filterRows([withHours, withoutHours, noEntry], weeks, '', 'with-days');

  // Assert
  assert.deepEqual(result.map(r => r.key), ['with-hours']);
});

test('rowFilter "with-days" ignora le ore fuori dalle settimane visibili', () => {
  // Arrange — ore consuntivate solo in una settimana non presente in `weeks`.
  const outsideRange = row({
    weeks: { '2026-01-05': { entry_id: 1, man_days: 3, planned_days: 0, notes: null } },
  });

  // Act
  const result = filterRows([outsideRange], weeks, '', 'with-days');

  // Assert
  assert.deepEqual(result, []);
});

test('rowFilter "over-budget" riusa isRowOverEstimate: una riga extra non e mai sopra stima', () => {
  // Arrange — is_extra: true azzera sempre isRowOverEstimate, anche con man_days molto alti.
  // Se il filtro reimplementasse il confronto invece di riusare isRowOverEstimate,
  // questa riga risulterebbe (erroneamente) sopra stima.
  const extraOverBudget = row({ is_extra: true, estimated_days: 1, total_man_days: 100 });

  // Act
  const result = filterRows([extraOverBudget], weeks, '', 'over-budget');

  // Assert
  assert.deepEqual(result, []);
});

test('rowFilter "over-budget" tiene le righe il cui consuntivato storico supera la stima', () => {
  // Arrange
  const over = row({ key: 'over', estimated_days: 5, total_man_days: 6 });
  const under = row({ key: 'under', estimated_days: 5, total_man_days: 4 });
  const noEstimate = row({ key: 'no-estimate', estimated_days: 0, total_man_days: 3 });

  // Act
  const result = filterRows([over, under, noEstimate], weeks, '', 'over-budget');

  // Assert
  assert.deepEqual(result.map(r => r.key), ['over']);
});
