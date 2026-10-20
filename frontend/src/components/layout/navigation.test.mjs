import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isNavigationItemActive,
  landingForRole,
  ALL_TEAMS_LANDING,
  ALL_TEAMS_NAVIGATION,
  mobileNavigationFor,
  navigationForRole,
  navigationOptionsFor,
  navigationSectionsForRole,
  NAVIGATION_BY_WORKSPACE,
  workspaceForRole,
  workspaceLabelFor,
  WORKSPACE_LANDING,
} from './navigation.ts';

test('espone i menu base e le landing operative per i tre workspace', () => {
  assert.equal(WORKSPACE_LANDING.member, '/consuntivazione');
  assert.equal(WORKSPACE_LANDING.pm, '/timeline-team');
  assert.equal(WORKSPACE_LANDING.admin, '/admin/team');
  assert.deepEqual(
    NAVIGATION_BY_WORKSPACE.member.map(item => item.label),
    ['Consuntivazione', 'I miei task', 'Planning'],
  );
  assert.deepEqual(
    NAVIGATION_BY_WORKSPACE.pm.map(item => item.label),
    ['Dashboard', 'Timeline team', 'Progetti', 'KPI ed economia', 'Basket giornate', 'Time & Material'],
  );
  assert.deepEqual(
    NAVIGATION_BY_WORKSPACE.admin.map(item => item.label),
    ['Team', 'Configurazione progetti', 'Opzioni'],
  );
});

test('deriva il workspace dal ruolo server-side, mai scelto', () => {
  assert.equal(workspaceForRole('member'), 'member');
  assert.equal(workspaceForRole('pm'), 'pm');
  assert.equal(workspaceForRole('admin'), 'admin');
});

test('la navigazione è cumulativa: member vede solo le proprie voci', () => {
  assert.deepEqual(
    navigationForRole('member').map(item => item.to),
    ['/consuntivazione', '/miei-task', '/planning'],
  );
});

test('la navigazione è cumulativa: pm vede le voci member più le proprie', () => {
  assert.deepEqual(
    navigationForRole('pm').map(item => item.to),
    [
      '/consuntivazione', '/miei-task', '/planning', '/dashboard',
      '/timeline-team', '/progetti', '/admin/dashboard', '/basket', '/time-material',
    ],
  );
});

test('la navigazione è cumulativa: admin vede l\'unione di tutti i workspace', () => {
  const adminRoutes = navigationForRole('admin').map(item => item.to);
  assert.deepEqual(adminRoutes, [
    '/consuntivazione', '/miei-task', '/planning', '/dashboard',
    '/timeline-team', '/progetti', '/admin/dashboard', '/basket', '/time-material',
    '/admin/team', '/admin/progetti', '/admin/opzioni',
  ]);
  // L'unione non produce duplicati di route: ogni voce compare una sola volta.
  assert.equal(new Set(adminRoutes).size, adminRoutes.length);
  // Le due voci di progetto restano distinte per destinazione e label.
  const adminLabels = navigationForRole('admin').map(item => item.label);
  assert.equal(adminLabels.filter(label => label === 'Progetti').length, 1);
  assert.equal(adminLabels.filter(label => label === 'Configurazione progetti').length, 1);
});

test('la sidebar espone sezioni nominate e non rende sezioni vuote', () => {
  assert.deepEqual(
    navigationSectionsForRole('member').map(section => [section.label, section.items.map(item => item.label)]),
    [['Il mio lavoro', ['Consuntivazione', 'I miei task', 'Planning']]],
  );
  assert.deepEqual(
    navigationSectionsForRole('admin').map(section => section.label),
    ['Il mio lavoro', 'Team e progetti', 'Amministrazione'],
  );
  assert.ok(navigationSectionsForRole('admin').every(section => section.items.length > 0));
});

test('considera attivo anche il dettaglio della route', () => {
  assert.equal(
    isNavigationItemActive({ to: '/progetti', label: 'Progetti', icon: 'projects' }, '/progetti/22'),
    true,
  );
  assert.equal(
    isNavigationItemActive({ to: '/progetti', label: 'Progetti', icon: 'projects' }, '/pianificazione'),
    false,
  );
});

test('limita la bottom navigation alle voci essenziali, cumulativa', () => {
  assert.deepEqual(
    mobileNavigationFor('member').map(item => item.shortLabel),
    ['Ore', 'Task', 'Planning'],
  );
  // pm e admin ereditano le voci mobile di member: le prime 3 cumulativamente.
  assert.deepEqual(
    mobileNavigationFor('pm').map(item => item.shortLabel),
    ['Ore', 'Task', 'Planning'],
  );
  assert.deepEqual(
    mobileNavigationFor('admin').map(item => item.shortLabel),
    ['Ore', 'Task', 'Planning'],
  );
});

test('regressione: le rotte admin restano raggiungibili dalla drawer', () => {
  // La bottom bar è troncata a 3 voci, ma la drawer (navigazione completa)
  // espone l'intero set cumulativo: le rotte admin non sono mai perse.
  const adminRoutes = navigationForRole('admin').map(item => item.to);
  for (const route of ['/admin/team', '/admin/progetti', '/admin/opzioni']) {
    assert.ok(adminRoutes.includes(route), `rotta admin mancante dalla drawer: ${route}`);
  }
});

test('landing consapevole del ruolo: ogni ruolo atterra dove inizia la sua navigazione', () => {
  assert.equal(landingForRole('member'), '/consuntivazione');
  assert.equal(landingForRole('pm'), '/timeline-team');
  assert.equal(landingForRole('admin'), '/admin/team');
});

test('la voce Persone di piattaforma compare solo al super-admin', () => {
  const routes = options => navigationForRole('admin', options).map(item => item.to);
  assert.equal(routes({}).includes('/admin/persone'), false);
  assert.equal(routes({ platformAdmin: true }).includes('/admin/persone'), true);
  assert.equal(navigationForRole('pm', { platformAdmin: true }).some(item => item.to === '/admin/persone'), false);
});

test('la voce Business Unit non compare nella navigazione del singolo team, nemmeno con il flag', () => {
  for (const role of ['member', 'pm', 'admin']) {
    assert.equal(
      navigationForRole(role, { businessUnit: true, platformAdmin: true }).some(item => item.to === '/business-unit'),
      false,
    );
  }
});

test('Tutti i Team: sezione unica con Team, Planning, Progetti, KPI ed economia e poi Business Unit', () => {
  const sections = navigationSectionsForRole('pm', { businessUnit: true, allTeams: true });
  assert.deepEqual(sections.map(section => section.label), ['Tutti i Team']);
  assert.deepEqual(
    sections[0].items.map(item => [item.label, item.to]),
    [
      ['Team', '/tutti/team'],
      ['Planning', '/tutti/planning'],
      ['Progetti', '/tutti/progetti'],
      ['KPI ed economia', '/tutti/kpi'],
      ['Business Unit', '/business-unit'],
    ],
  );
  assert.deepEqual(sections[0].items, ALL_TEAMS_NAVIGATION);
  // Niente "Il mio lavoro" né voci di amministrazione in questa modalità.
  assert.equal(navigationForRole('admin', { businessUnit: true, allTeams: true, platformAdmin: true }).length, 5);
  assert.equal(ALL_TEAMS_LANDING, '/business-unit');
});

test('Tutti i Team senza il flag manager o super-admin non ha effetto', () => {
  assert.deepEqual(
    navigationForRole('pm', { allTeams: true }).map(item => item.to),
    navigationForRole('pm').map(item => item.to),
  );
});

test('Tutti i Team: la bottom navigation mostra Team, Planning e Business Unit', () => {
  assert.deepEqual(
    mobileNavigationFor('pm', { businessUnit: true, allTeams: true }).map(item => item.shortLabel),
    ['Team', 'Planning', 'BU'],
  );
});

test('le opzioni di navigazione derivano da manager, super-admin e modalità Tutti i Team', () => {
  assert.deepEqual(
    navigationOptionsFor({ platformAdmin: false, manager: false, allTeams: false }),
    { platformAdmin: false, businessUnit: false, allTeams: false },
  );
  assert.deepEqual(
    navigationOptionsFor({ platformAdmin: false, manager: true, allTeams: true }),
    { platformAdmin: false, businessUnit: true, allTeams: true },
  );
  assert.deepEqual(
    navigationOptionsFor({ platformAdmin: true, manager: false, allTeams: false }),
    { platformAdmin: true, businessUnit: true, allTeams: false },
  );
});

test('etichetta del workspace: il team in sola lettura è "Manager (sola lettura)"', () => {
  assert.equal(workspaceLabelFor('pm', true), 'Manager (sola lettura)');
  assert.equal(workspaceLabelFor('pm', false), 'PM / Team lead');
  assert.equal(workspaceLabelFor('admin'), 'Admin');
  assert.equal(workspaceLabelFor('pm', true, true), 'Manager');
  assert.equal(workspaceLabelFor('pm', false, true), 'Manager');
});
