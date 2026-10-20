import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PROTECTED_ROUTES } from '../appRoutes.ts';
import { resolveAuthGate } from './routeGuard.ts';
import {
  isPublicRoute,
  PUBLIC_ROUTES,
  ROUTE_ACCESS,
  minimumRoleForPath,
} from './routeAccess.ts';

const here = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(here, '../App.tsx'), 'utf8');

test('la tabella esplicita conserva il ruolo minimo di ogni rotta', () => {
  const expected = {
    '/consuntivazione': 'member',
    '/miei-task': 'member',
    '/schedule': 'member',
    '/planning': 'member',
    '/planning/table': 'member',
    '/planning/gantt': 'member',
    '/planning/kanban': 'member',
    '/planning/capacita': 'pm',
    '/dashboard': 'pm',
    '/timeline-team': 'pm',
    '/progetti': 'pm',
    '/progetti/:id': 'pm',
    '/progetti/:id/task': 'pm',
    '/progetti/:id/wbs': 'pm',
    '/pianificazione': 'member',
    '/allocazioni': 'member',
    '/admin/dashboard': 'pm',
    '/basket': 'pm',
    '/time-material': 'pm',
    '/admin/team': 'admin',
    '/admin/persone': 'admin',
    '/admin/progetti': 'admin',
    '/admin/progetti/:id': 'pm',
    '/admin/opzioni': 'admin',
    '/impostazioni': 'member',
    '/impostazioni/aggiornamenti': 'member',
  };

  assert.deepEqual(
    Object.fromEntries(Object.entries(expected).map(([path]) => [path, minimumRoleForPath(path)])),
    expected,
  );
  assert.deepEqual(PUBLIC_ROUTES, ['/login', '/change-password']);
});

test('ogni rotta dichiarata dall’app ha un vincolo nella tabella', () => {
  const literalPaths = [...appSource.matchAll(/\bpath="([^"]+)"/g)].map(match => match[1]);
  assert.ok(literalPaths.length > 0, 'App.tsx non contiene alcun path="..."');

  const knownPaths = new Set([
    ...ROUTE_ACCESS.map(route => route.path),
    ...PUBLIC_ROUTES,
  ]);
  for (const path of literalPaths) {
    assert.ok(knownPaths.has(path), `path di App.tsx senza contratto di accesso: ${path}`);
  }

  // App.tsx costruisce le Route protette da PROTECTED_ROUTES, quindi il test
  // controlla anche la forma dinamica usata oggi, oltre ai path letterali.
  for (const route of PROTECTED_ROUTES) {
    assert.ok(
      minimumRoleForPath(route.guardPath) != null,
      `rotta protetta di App.tsx senza ruolo minimo: ${route.guardPath}`,
    );
  }
});

test('ogni rotta protetta ha un elemento in ROUTE_ELEMENTS', () => {
  const block = appSource.match(/const ROUTE_ELEMENTS[^{]*\{([\s\S]*?)\n\};/);
  assert.ok(block, 'ROUTE_ELEMENTS non trovato in App.tsx');
  const declared = new Set([...block[1].matchAll(/^\s*'([^']+)':/gm)].map(match => match[1]));

  for (const route of PROTECTED_ROUTES) {
    assert.ok(
      declared.has(route.path),
      `rotta protetta senza elemento in ROUTE_ELEMENTS: ${route.path}`,
    );
  }
  const routed = new Set(PROTECTED_ROUTES.map(route => route.path));
  for (const path of declared) {
    assert.ok(routed.has(path), `elemento in ROUTE_ELEMENTS senza rotta protetta: ${path}`);
  }
});

test('il matching segue React Router: case-insensitive, slash finale e slash doppi', () => {
  assert.equal(minimumRoleForPath('/ADMIN/persone'), 'admin');
  assert.equal(minimumRoleForPath('/Admin/Persone'), 'admin');
  assert.equal(minimumRoleForPath('/admin/persone/'), 'admin');
  assert.equal(minimumRoleForPath('//admin//persone//'), 'admin');
  assert.equal(minimumRoleForPath('/PROGETTI//123/'), 'pm');
  assert.equal(minimumRoleForPath('//'), 'member');
});

test('il default-deny chiude il bypass case-variant e le rotte inventate', () => {
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/ADMIN/persone' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
  assert.deepEqual(
    resolveAuthGate({ status: 'authenticated', role: 'member', path: '/pagina-inesistente' }),
    { kind: 'landing', to: '/consuntivazione' },
  );
});

test('le rotte pubbliche restano raggiungibili', () => {
  for (const path of ['/login', '/change-password']) {
    assert.equal(isPublicRoute(path), true);
    assert.deepEqual(
      resolveAuthGate({ status: 'authenticated', role: null, path }),
      { kind: 'allow' },
    );
  }
});

test('la rotta ritirata /allocazioni usa il redirect legacy verso Planning', () => {
  // Arrange — `appSource` è già letto in cima al file.

  // Act
  const entry = appSource.match(/'allocazioni':\s*(<[^>]+>)/)?.[1];

  // Assert
  assert.equal(entry, '<LegacyScheduleRedirect />');
});

test('Business Unit: il ruolo minimo è pm (il flag manager è un secondo controllo)', () => {
  assert.equal(minimumRoleForPath('/business-unit'), 'pm');
});

test('Tutti i Team: le quattro pagine aggregate richiedono ruolo pm', () => {
  for (const path of ['/tutti/team', '/tutti/planning', '/tutti/progetti', '/tutti/kpi']) {
    assert.equal(minimumRoleForPath(path), 'pm');
  }
});

test('la rotta ritirata /pianificazione usa il redirect legacy verso Planning', () => {
  // Arrange — `appSource` è già letto in cima al file.

  // Act
  const entry = appSource.match(/'pianificazione':\s*(<[^>]+>)/)?.[1];

  // Assert
  assert.ok(entry, 'ROUTE_ELEMENTS non dichiara più la rotta pianificazione');
  assert.equal(entry, '<LegacyScheduleRedirect />');
  // Il redirect legacy resta leggibile ai member: il ritiro non alza il gate.
  assert.equal(minimumRoleForPath('/schedule'), 'member');
  assert.equal(minimumRoleForPath('/pianificazione'), 'member');
});
