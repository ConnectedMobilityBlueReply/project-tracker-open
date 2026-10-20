import assert from 'node:assert/strict';
import test from 'node:test';
import { applyFilters, EMPTY_FILTERS, hasActiveFilters, parseFilters, serializeFilters } from './projectFilters.ts';

const project = (name, over = {}) => ({
  name, status: 'in lavorazione', area: 'Digital', pm_riferimento_cliente: 'Rossi', societa: 'Alfa', ...over,
});

test('parseFilters: parametri assenti danno filtri vuoti', () => {
  assert.deepEqual(parseFilters(new URLSearchParams('')), EMPTY_FILTERS);
});

test('parseFilters legge q, stato, societa e area', () => {
  const params = new URLSearchParams('q=alfa&stato=concluso&societa=Alfa&area=Digital');
  assert.deepEqual(parseFilters(params), { q: 'alfa', stato: 'concluso', societa: 'Alfa', area: 'Digital', pm: '' });
});

test('pm (cognome reale) non passa dall URL: ignorato in lettura, omesso in scrittura', () => {
  assert.equal(parseFilters(new URLSearchParams('pm=Rossi')).pm, '');
  assert.equal(serializeFilters({ ...EMPTY_FILTERS, pm: 'Rossi', stato: 'concluso' }).toString(), 'stato=concluso');
});

test('serializeFilters omette i valori vuoti', () => {
  assert.equal(serializeFilters(EMPTY_FILTERS).toString(), '');
  assert.equal(serializeFilters({ ...EMPTY_FILTERS, stato: 'concluso' }).toString(), 'stato=concluso');
});

test('q con spazi resta com e (il campo di ricerca e controllato) ma solo spazi non e un filtro attivo', () => {
  const filters = parseFilters(new URLSearchParams('q=a%20'));
  assert.equal(filters.q, 'a ');
  assert.equal(hasActiveFilters(parseFilters(new URLSearchParams('q=%20%20%20'))), false);
});

test('round-trip con accenti, apostrofi, "&" e spazi', () => {
  const filters = { ...EMPTY_FILTERS, q: 'Qualità & più', area: "D'Angelo & Co" };
  const roundTrip = parseFilters(new URLSearchParams(serializeFilters(filters).toString()));
  assert.deepEqual(roundTrip, filters);
});

test('applyFilters: nessun filtro restituisce tutti i progetti', () => {
  const list = [project('A'), project('B')];
  assert.deepEqual(applyFilters(list, EMPTY_FILTERS), list);
});

test('applyFilters: ricerca per nome senza distinguere maiuscole, filtri esatti in AND', () => {
  const list = [
    project('Alfa Portale'),
    project('Beta Portale', { status: 'concluso' }),
    project('Gamma', { area: 'Core' }),
  ];
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, q: 'PORTALE' }).map(p => p.name), ['Alfa Portale', 'Beta Portale']);
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, q: 'portale', stato: 'concluso' }).map(p => p.name), ['Beta Portale']);
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, area: 'Core' }).map(p => p.name), ['Gamma']);
});

test('applyFilters: un valore sconosciuto in URL non trova nulla e non lancia', () => {
  const list = [project('A'), project('B', { pm_riferimento_cliente: undefined })];
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, stato: 'xyz' }), []);
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, pm: 'Rossi' }).map(p => p.name), ['A']);
});

test('hasActiveFilters', () => {
  assert.equal(hasActiveFilters(EMPTY_FILTERS), false);
  assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, q: 'a' }), true);
  assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, societa: 'Alfa' }), true);
});

test('applyFilters: un filtro select di soli spazi non e attivo (coerente con hasActiveFilters)', () => {
  const list = [project('A'), project('B')];
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, stato: ' ' }), list);
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, pm: '  ' }), list);
});
