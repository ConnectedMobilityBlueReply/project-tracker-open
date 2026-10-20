import assert from 'node:assert/strict';
import test from 'node:test';
import { memberEmailError, teamNameError } from './teamValidation.ts';

test('nome team: 1..80 caratteri dopo il trim', () => {
  assert.equal(teamNameError('  Alfa '), null);
  assert.equal(teamNameError('   '), 'Il nome del team deve avere da 1 a 80 caratteri');
  assert.equal(teamNameError('x'.repeat(81)), 'Il nome del team deve avere da 1 a 80 caratteri');
  assert.equal(teamNameError('x'.repeat(80)), null);
});

test('email membro: formato minimo e lunghezza', () => {
  assert.equal(memberEmailError(' Mario@example.com '), null);
  assert.equal(memberEmailError('mario'), 'Email non valida');
  assert.equal(memberEmailError('a b@example.com'), 'Email non valida');
  assert.equal(memberEmailError(`${'a'.repeat(250)}@x.it`), 'Email non valida');
});
