import assert from 'node:assert/strict';
import test from 'node:test';
import { initials, avatarColorFor, AVATAR_COLORS } from './people.ts';

test('initials: prime due parole in maiuscolo, stringa vuota se nome vuoto', () => {
  assert.equal(initials('Anna Maria Bianchi'), 'AM');
  assert.equal(initials('luca'), 'L');
  assert.equal(initials('   '), '');
});

test('avatarColorFor: deterministico e dentro la palette', () => {
  assert.equal(avatarColorFor('Luca Verdi'), avatarColorFor('Luca Verdi'));
  assert.ok(AVATAR_COLORS.includes(avatarColorFor('Giulia Neri')));
  const used = new Set(['Anna', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Gina'].map(avatarColorFor));
  assert.ok(used.size >= 2);
});
