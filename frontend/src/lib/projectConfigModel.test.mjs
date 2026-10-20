import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterProjectList,
  validateProjectForm,
  validateTaskForm,
  estimateComparison,
  parentCandidates,
  subprojectSeed,
  areaPatch,
} from './projectConfigModel.ts';

const project = (overrides = {}) => ({
  id: 1, name: 'ARK - Contesto operatore', status: 'da lavorare', codice_offerta: 'REYIT26-10357', ...overrides,
});

const form = (overrides = {}) => ({
  societa: '', area: '', pm_riferimento_cliente: '', name: 'Progetto', description: '',
  codice_offerta: '', estimate_days: '', status: 'da lavorare', status_offerta: '',
  scala_da_basket: false, basket: '', icon: '', daily_rate: '450', billing_type: 'turnkey', parent_project_id: '', exclude_from_actuals: false, ...overrides,
});

const task = (overrides = {}) => ({
  enabled: true, status: 'not_started', planned_start: '', planned_end: '', estimated_days: '', ...overrides,
});

// filterProjectList

test('lista: query vuota e filtro tutti restituiscono tutto', () => {
  const list = [project(), project({ id: 2, name: 'Banner' })];
  assert.equal(filterProjectList(list, '  ', 'tutti').length, 2);
});

test('lista: la ricerca ignora maiuscole e cerca anche nel codice offerta', () => {
  const list = [project(), project({ id: 2, name: 'Banner', codice_offerta: 'OFF-9' })];
  assert.deepEqual(filterProjectList(list, 'contesto', 'tutti').map(p => p.id), [1]);
  assert.deepEqual(filterProjectList(list, 'off-9', 'tutti').map(p => p.id), [2]);
});

test('lista: codice offerta null non rompe la ricerca', () => {
  const list = [project({ codice_offerta: null })];
  assert.equal(filterProjectList(list, 'reyit', 'tutti').length, 0);
});

test('lista: filtro per stato combinato con la ricerca', () => {
  const list = [project(), project({ id: 2, status: 'in lavorazione' }), project({ id: 3, name: 'Altro', status: 'in lavorazione' })];
  assert.deepEqual(filterProjectList(list, 'ark', 'in lavorazione').map(p => p.id), [2]);
});

// validateProjectForm

test('progetto: form valido non ha errori', () => {
  assert.deepEqual(validateProjectForm(form()), {});
});

test('progetto: nome vuoto o solo spazi è obbligatorio', () => {
  assert.equal(validateProjectForm(form({ name: '   ' })).name, 'Il nome del progetto è obbligatorio.');
});

test('progetto: stima negativa non valida, zero valida', () => {
  assert.ok(validateProjectForm(form({ estimate_days: '-1' })).estimateDays);
  assert.equal(validateProjectForm(form({ estimate_days: '0' })).estimateDays, undefined);
});

test('progetto: scala da basket senza basket non valida', () => {
  assert.ok(validateProjectForm(form({ scala_da_basket: true })).basket);
  assert.equal(validateProjectForm(form({ scala_da_basket: true, basket: 'B1' })).basket, undefined);
});

test('un progetto Time & Material non può essere escluso dai consuntivi', () => {
  const errors = validateProjectForm(form({ billing_type: 'tm', exclude_from_actuals: true }));
  assert.equal(errors.billingType, 'Un progetto Time & Material non può essere escluso dai consuntivi: disattiva “Escludi dai consuntivi”.');
  assert.equal(validateProjectForm(form({ billing_type: 'turnkey', exclude_from_actuals: true })).billingType, undefined);
});

test('area Investimento preimposta l\'esclusione, tranne su T&M', () => {
  assert.deepEqual(areaPatch('Investimento', 'turnkey'), { area: 'Investimento', exclude_from_actuals: true });
  assert.deepEqual(areaPatch('Investimento', 'tm'), { area: 'Investimento' });
  assert.deepEqual(areaPatch('ISE', 'turnkey'), { area: 'ISE' });
});

test('un progetto Time & Material non può scalare da basket', () => {
  const errors = validateProjectForm(form({ billing_type: 'tm', scala_da_basket: true, basket: 'GOV' }));
  assert.equal(errors.billingType, 'Un progetto Time & Material non può scalare da basket: disattiva “Scala da basket”.');
  assert.equal(validateProjectForm(form({ billing_type: 'tm' })).billingType, undefined);
});

// validateTaskForm

test('task: fine prima dell inizio non valida, stesso giorno valida', () => {
  assert.ok(validateTaskForm(task({ planned_start: '2026-10-12', planned_end: '2026-10-09' })).plannedEnd);
  assert.deepEqual(validateTaskForm(task({ planned_start: '2026-10-12', planned_end: '2026-10-12' })), {});
});

test('task: giorni negativi non validi', () => {
  assert.ok(validateTaskForm(task({ estimated_days: '-2' })).estimatedDays);
});

test('task: date parziali sono valide', () => {
  assert.deepEqual(validateTaskForm(task({ planned_end: '2026-10-01' })), {});
});

// estimateComparison

test('stima: somma solo i task abilitati', () => {
  const tasks = { AF: task({ estimated_days: '2' }), DEV: task({ estimated_days: '3' }), UAT: task({ enabled: false, estimated_days: '9' }) };
  assert.deepEqual(estimateComparison('5', tasks), { taskTotal: 5, diff: 0 });
});

test('stima: differenza positiva se i task superano la stima', () => {
  const tasks = { AF: task({ estimated_days: '2.5' }), DEV: task({ estimated_days: '5' }) };
  assert.deepEqual(estimateComparison('5', tasks), { taskTotal: 7.5, diff: 2.5 });
});

test('stima: stima vuota non confronta', () => {
  assert.deepEqual(estimateComparison('', { AF: task({ estimated_days: '2' }) }), { taskTotal: 2, diff: null });
});

// daily_rate

test('form: tariffa giornaliera valida non produce errori', () => {
  assert.equal(validateProjectForm(form({ daily_rate: '520.50' })).dailyRate, undefined);
});

test('form: tariffa giornaliera vuota, zero, negativa o oltre 10000 è un errore', () => {
  for (const daily_rate of ['', '  ', '0', '-5', '10000.01', 'abc']) {
    assert.ok(validateProjectForm(form({ daily_rate })).dailyRate, `atteso errore per "${daily_rate}"`);
  }
});

test('validateProjectForm: un sotto progetto deve essere T&M e non può scalare da basket', () => {
  const message = 'Un sotto progetto deve essere Time & Material e non può scalare da basket.';
  assert.equal(validateProjectForm(form({ parent_project_id: '7', billing_type: 'turnkey' })).parentProject, message);
  assert.equal(validateProjectForm(form({ parent_project_id: '7', billing_type: 'tm', scala_da_basket: true, basket: 'GOV' })).parentProject, message);
  assert.equal(validateProjectForm(form({ parent_project_id: '7', billing_type: 'tm' })).parentProject, undefined);
  assert.equal(validateProjectForm(form({ billing_type: 'turnkey' })).parentProject, undefined);
});

test('parentCandidates: solo T&M reali senza padre, escluso il progetto corrente, per nome', () => {
  const projects = [
    { id: 1, name: 'Zeta', billing_type: 'tm', is_virtual: 0, parent_project_id: null },
    { id: 2, name: 'Alfa', billing_type: 'tm', is_virtual: 0 },
    { id: 3, name: 'Turn', billing_type: 'turnkey', is_virtual: 0, parent_project_id: null },
    { id: 4, name: 'Virtuale', billing_type: 'tm', is_virtual: 1, parent_project_id: null },
    { id: 5, name: 'Figlio', billing_type: 'tm', is_virtual: 0, parent_project_id: 1 },
  ];
  assert.deepEqual(parentCandidates(projects, null).map(p => p.id), [2, 1]);
  assert.deepEqual(parentCandidates(projects, 2).map(p => p.id), [1]);
});

test('subprojectSeed eredita i campi commerciali del padre ed è sempre T&M', () => {
  assert.deepEqual(
    subprojectSeed(9, { area: 'Digital', societa: '', pm_riferimento_cliente: 'Rossi', codice_offerta: 'OFF-1' }),
    { parent_project_id: 9, area: 'Digital', societa: undefined, pm_riferimento_cliente: 'Rossi', codice_offerta: 'OFF-1', billing_type: 'tm' },
  );
});
