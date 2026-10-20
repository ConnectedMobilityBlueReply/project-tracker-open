import assert from 'node:assert/strict';
import test from 'node:test';
import { breadcrumbFor } from './breadcrumbs.ts';

test('Business Unit: una sola briciola, anche se la voce dipende dal flag', () => {
  assert.deepEqual(breadcrumbFor('/business-unit', 'pm'), [{ label: 'Business Unit' }]);
});

test('Tutti i Team: le pagine aggregate hanno la propria briciola', () => {
  assert.deepEqual(breadcrumbFor('/tutti/team', 'pm'), [{ label: 'Team' }]);
  assert.deepEqual(breadcrumbFor('/tutti/progetti', 'pm'), [{ label: 'Progetti' }]);
  assert.deepEqual(breadcrumbFor('/tutti/kpi', 'admin'), [{ label: 'KPI ed economia' }]);
});

test('pagina di primo livello: una sola briciola senza link', () => {
  assert.deepEqual(breadcrumbFor('/consuntivazione', 'member'), [{ label: 'Consuntivazione' }]);
});

test('Planning: dettaglio con il nome della vista per member e pm', () => {
  for (const role of ['member', 'pm']) {
    for (const [path, label] of [
      ['/planning/table', 'Table'],
      ['/planning/gantt', 'Gantt'],
      ['/planning/kanban', 'Kanban'],
      ['/planning/capacita', 'Capacità'],
    ]) {
      assert.deepEqual(breadcrumbFor(path, role), [
        { label: 'Planning', to: '/planning' },
        { label },
      ]);
    }
  }
});

test('dettaglio progetto: sezione con link più dettaglio', () => {
  assert.deepEqual(breadcrumbFor('/progetti/12', 'pm'), [
    { label: 'Progetti', to: '/progetti' },
    { label: 'Dettaglio' },
  ]);
  assert.deepEqual(breadcrumbFor('/progetti/12/wbs', 'pm'), [
    { label: 'Progetti', to: '/progetti' },
    { label: 'WBS' },
  ]);
  assert.deepEqual(breadcrumbFor('/progetti/12/task', 'admin'), [
    { label: 'Progetti', to: '/progetti' },
    { label: 'Task' },
  ]);
});

test('admin: configurazione progetto annidata', () => {
  assert.deepEqual(breadcrumbFor('/admin/progetti/3', 'admin'), [
    { label: 'Configurazione progetti', to: '/admin/progetti' },
    { label: 'Dettaglio' },
  ]);
});

test('rotta assente dalla navigazione del ruolo o sconosciuta: nessuna briciola', () => {
  assert.deepEqual(breadcrumbFor('/progetti', 'member'), []);
  assert.deepEqual(breadcrumbFor('/inesistente', 'admin'), []);
});
