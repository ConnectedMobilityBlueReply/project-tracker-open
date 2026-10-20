import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHeaders, isTeamAccessError, TEAM_HEADER } from './teamHeader.ts';

test('header del team solo se c’è un team attivo', () => {
  assert.equal(buildHeaders(3).get(TEAM_HEADER), '3');
  assert.equal(buildHeaders(null).get(TEAM_HEADER), null);
  assert.equal(buildHeaders(3).get('Content-Type'), 'application/json');
});

test('gli header del chiamante si sommano e non tolgono quello del team', () => {
  const headers = buildHeaders(3, { 'Content-Type': 'text/csv', [TEAM_HEADER]: '99' });
  assert.equal(headers.get('Content-Type'), 'text/csv');
  assert.equal(headers.get(TEAM_HEADER), '3');
});

test('solo i 403 del filtro team sono errori di accesso al team', () => {
  assert.equal(isTeamAccessError(403, 'TEAM_FORBIDDEN'), true);
  assert.equal(isTeamAccessError(403, 'TEAM_REQUIRED'), true);
  assert.equal(isTeamAccessError(403, null), false);
  assert.equal(isTeamAccessError(404, 'TEAM_FORBIDDEN'), false);
});

test('in Tutti i Team TEAM_REQUIRED non scatena il ricaricamento dell\'account', () => {
  assert.equal(isTeamAccessError(403, 'TEAM_REQUIRED', 'all'), false);
  assert.equal(isTeamAccessError(403, 'TEAM_REQUIRED', 3), true);
  assert.equal(isTeamAccessError(403, 'TEAM_FORBIDDEN', 'all'), true);
});

test('il valore all viaggia nell\'header del team', () => {
  assert.equal(buildHeaders('all').get(TEAM_HEADER), 'all');
});
