import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAuthGate } from './routeGuard.ts';
import { PROTECTED_ROUTES } from '../appRoutes.ts';
import { minimumRoleForPath, ROUTE_ACCESS } from './routeAccess.ts';

test('sessione in caricamento → loading, niente shell né login', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'loading', role: null, path: '/timeline-team' }),
    { kind: 'loading' },
  );
});

test('anonimo → login, qualunque rotta', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'anonymous', role: null, path: '/admin/persone' }),
    { kind: 'login' },
  );
});

test('ruolo sufficiente → allow', () => {
  assert.deepEqual(resolveAuthGate({ status: 'authenticated', role: 'member', path: '/consuntivazione' }), { kind: 'allow' });
  assert.deepEqual(resolveAuthGate({ status: 'authenticated', role: 'pm', path: '/timeline-team' }), { kind: 'allow' });
  assert.deepEqual(resolveAuthGate({ status: 'authenticated', role: 'pm', path: '/admin/dashboard' }), { kind: 'allow' });
  assert.deepEqual(resolveAuthGate({ status: 'authenticated', role: 'admin', path: '/admin/persone' }), { kind: 'allow' });
});

test('ruolo insufficiente → landing del proprio workspace, mai /login', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/timeline-team' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/admin/persone' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/admin/dashboard' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'pm', path: '/admin/opzioni' }),
    { kind: 'landing', to: '/timeline-team' },
  );
});

test('pm crea/modifica progetti: admin/progetti/:id è accessibile a pm, admin/progetti resta admin-only', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'pm', path: '/admin/progetti/42' }),
    { kind: 'allow' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'pm', path: '/admin/progetti' }),
    { kind: 'landing', to: '/timeline-team' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/admin/progetti/42' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
});

test('rotta senza vincolo di ruolo → default-deny verso la landing', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/percorso-sconosciuto' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
});

test('la root resta accessibile a ogni ruolo autenticato', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/' }),
    { kind: 'allow' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'admin', path: '/' }),
    { kind: 'allow' },
  );
});

test('landing consapevole del ruolo: ogni ruolo atterra dove parte la sua navigazione', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/timeline-team' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
  // pm su rotta admin → landing pm
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'pm', path: '/admin/persone' }),
    { kind: 'landing', to: '/timeline-team' },
  );
  // admin non ha rotte sopra di sé
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'admin', path: '/admin/persone' }),
    { kind: 'allow' },
  );
});

test('struttura rotte: ogni rotta protetta ha guardPath coincidente e ruolo minimo esplicito', () => {
  assert.ok(PROTECTED_ROUTES.length >= 1, 'albo delle rotte vuoto');
  for (const route of PROTECTED_ROUTES) {
    assert.equal(
      route.guardPath,
      `/${route.path}`,
      `guardPath di "${route.path}" deve coincidere con la rotta, altrimenti guard e route divergono`,
    );
    const minimum = minimumRoleForPath(route.guardPath);
    assert.ok(
      minimum != null,
      `guardPath "${route.guardPath}" non ha un ruolo minimo nella tabella di accesso`,
    );
  }
  assert.equal(
    new Set(ROUTE_ACCESS.map(route => route.path)).size,
    ROUTE_ACCESS.length,
    'la tabella dei ruoli non deve contenere rotte duplicate',
  );
});

test('Planning: viste WBS a tutti, Capacità solo da pm in su', () => {
  for (const path of ['/planning', '/planning/table', '/planning/gantt', '/planning/kanban']) {
    assert.deepEqual(resolveAuthGate({ status: 'authenticated', role: 'member', path }), { kind: 'allow' });
  }
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/planning/capacita' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
  assert.deepEqual(resolveAuthGate({ status: 'authenticated', role: 'pm', path: '/planning/capacita' }), { kind: 'allow' });
});

test('autenticato senza team → onboarding, da qualunque rotta protetta', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: null, hasTeam: false, path: '/consuntivazione' }),
    { kind: 'landing', to: '/benvenuto' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: null, hasTeam: false, path: '/benvenuto' }),
    { kind: 'allow' },
  );
});

test('con un team l’onboarding rimanda alla landing del ruolo', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', hasTeam: true, path: '/benvenuto' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
});

test('anonimo su /benvenuto → login', () => {
  assert.deepEqual(resolveAuthGate({ status: 'anonymous', role: null, hasTeam: false, path: '/benvenuto' }), { kind: 'login' });
});

test('Business Unit: serve il flag oltre al ruolo; il default-deny vale per ogni variante di path', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'pm', businessUnit: true, path: '/business-unit' }),
    { kind: 'allow' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'pm', path: '/business-unit' }),
    { kind: 'landing', to: '/timeline-team' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'admin', businessUnit: false, path: '/BUSINESS-UNIT/' }),
    { kind: 'landing', to: '/admin/team' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', businessUnit: true, path: '/business-unit' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
});

test('Tutti i Team: le rotte /tutti/* richiedono il flag come la Business Unit', () => {
  for (const path of ['/tutti/team', '/tutti/planning', '/tutti/progetti', '/tutti/kpi', '/TUTTI/KPI/']) {
    assert.deepEqual(
      resolveAuthGate({ status: 'authenticated', role: 'pm', businessUnit: true, path }),
      { kind: 'allow' },
    );
    assert.deepEqual(
      resolveAuthGate({ status: 'authenticated', role: 'pm', path }),
      { kind: 'landing', to: '/timeline-team' },
    );
    assert.deepEqual(
      resolveAuthGate({ status: 'authenticated', role: 'member', businessUnit: true, path }),
      { kind: 'landing', to: '/consuntivazione' },
    );
  }
});
