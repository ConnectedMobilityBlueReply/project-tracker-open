import assert from 'node:assert/strict';
import test from 'node:test';
import {
  monthKey, defaultPeriod, monthsBetween, canCloseMonth, plafondPct, formatDays, formatDelta, toExportRows,
  hasSubprojects, breakdownLabel,
} from './tmBilling.ts';

const project = (overrides = {}) => ({
  project_id: 1, name: 'AMS', daily_rate: 500, plafond_days: 10, consumed_days: 8, residual_days: 2,
  months: [
    { month: '2026-09', live_days: 6, billed_days: 5, delta_days: 1, amount: 2500, status: 'rettifica' },
    { month: '2026-10', live_days: 2, billed_days: null, delta_days: null, amount: 1000, status: 'aperto' },
  ],
  breakdown: [{ project_id: 1, name: 'AMS', live_days: [6, 2] }],
  ...overrides,
});

test('monthKey usa la data locale con mese a due cifre', () => {
  assert.equal(monthKey(new Date(2026, 0, 31)), '2026-01');
});

test('defaultPeriod: ultimi 6 mesi incluso il corrente, anche a cavallo d\'anno', () => {
  assert.deepEqual(defaultPeriod(new Date(2026, 1, 15)), { from: '2025-09', to: '2026-02' });
});

test('monthsBetween è inclusivo e attraversa l\'anno', () => {
  assert.deepEqual(monthsBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(monthsBetween('2026-05', '2026-04'), []);
});

test('si chiudono solo mesi già conclusi', () => {
  const today = new Date(2026, 9, 12);
  assert.equal(canCloseMonth('2026-09', today), true);
  assert.equal(canCloseMonth('2026-10', today), false);
  assert.equal(canCloseMonth('2026-11', today), false);
});

test('plafondPct è null senza plafond', () => {
  assert.equal(plafondPct(project()), 80);
  assert.equal(plafondPct(project({ plafond_days: 0 })), null);
});

test('formattazione giornate e delta in italiano', () => {
  assert.equal(formatDays(2.5), '2,5 gg');
  assert.equal(formatDelta(1), '+1 gg');
  assert.equal(formatDelta(-0.25), '−0,25 gg');
  assert.equal(formatDelta(0), '0 gg');
});

test('export: una riga per progetto × mese con stato leggibile', () => {
  const rows = toExportRows([project()]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    Progetto: 'AMS', Mese: '2026-09', Stato: 'Rettifica', 'Giornate consuntivate': 6,
    'Giornate fatturate': 5, 'Delta giornate': 1, 'Tariffa (€)': 500, 'Importo (€)': 2500, 'Sotto progetto': null,
  });
  assert.equal(rows[1]['Giornate fatturate'], null);
});

test('hasSubprojects e breakdownLabel: la prima voce è il lavoro diretto del padre', () => {
  assert.equal(hasSubprojects(project()), false);
  assert.equal(hasSubprojects(project({ breakdown: [
    { project_id: 1, name: 'AMS', live_days: [2, 0] }, { project_id: 2, name: 'Portale', live_days: [4, 2] },
  ] })), true);
  assert.equal(breakdownLabel(0, 'AMS'), 'Lavoro diretto');
  assert.equal(breakdownLabel(1, 'Portale'), 'Portale');
});

test('toExportRows aggiunge dopo il totale del mese le righe di dettaglio con giornate > 0', () => {
  const rows = toExportRows([project({ breakdown: [
    { project_id: 1, name: 'AMS', live_days: [2, 0] },
    { project_id: 2, name: 'Portale', live_days: [4, 2] },
  ] })]);
  assert.deepEqual(rows.map(r => [r.Mese, r['Sotto progetto'], r['Giornate consuntivate']]), [
    ['2026-09', null, 6], ['2026-09', 'Lavoro diretto', 2], ['2026-09', 'Portale', 4],
    ['2026-10', null, 2], ['2026-10', 'Portale', 2],
  ]);
  assert.equal(rows[1].Stato, null);
  assert.equal(rows[1]['Importo (€)'], null);
  assert.equal(rows[1]['Tariffa (€)'], null);
});

test('toExportRows senza sotto progetti non aggiunge righe di dettaglio', () => {
  const rows = toExportRows([project()]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row['Sotto progetto'] === null));
});
