import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { HOURS_PER_DAY, daysToHours, formatGgU, hoursToDays } from './units.ts';

test('hoursToDays converte le ore intere senza perdita', () => {
  assert.equal(hoursToDays(0), 0);
  assert.equal(hoursToDays(1), 0.125);
  assert.equal(hoursToDays(HOURS_PER_DAY), 1);
  assert.equal(hoursToDays(24), 3);
});

test('hoursToDays regge la mezz’ora, la granularità minima degli input timeline', () => {
  assert.equal(hoursToDays(0.5), 0.0625);
  assert.equal(hoursToDays(7.5), 0.9375);
});

test('il round-trip ore → giorni → ore restituisce il valore inserito', () => {
  for (const hours of [0, 0.5, 1, 1.5, 7.5, 8, 23.5, 24]) {
    assert.equal(daysToHours(hoursToDays(hours)), hours, `round-trip rotto per ${hours}h`);
  }
});

test('HOURS_PER_DAY ha una sola definizione condivisa dai due moduli', async () => {
  // Arrange
  const units = await import('./units.ts');
  const workingHours = await import('./workingHours.ts');

  // Act & Assert — non basta che i due valori coincidano: devono essere
  // la stessa costante, altrimenti la divergenza torna alla prima modifica.
  assert.equal(workingHours.HOURS_PER_DAY, units.HOURS_PER_DAY);
  assert.equal(units.HOURS_PER_DAY, 8);
  const source = await readFile(new URL('./workingHours.ts', import.meta.url), 'utf8');
  assert.ok(
    /import\s*\{[^}]*HOURS_PER_DAY[^}]*\}\s*from\s*'\.\/units\.ts'/.test(source),
    'workingHours.ts deve importare HOURS_PER_DAY da units.ts, non ridichiararlo',
  );
});

test('formatGgU mostra giorni/uomo con virgola italiana', () => {
  assert.equal(formatGgU(8), '1 gg/u');
  assert.equal(formatGgU(12), '1,5 gg/u');
  assert.equal(formatGgU(4), '0,5 gg/u');
  assert.equal(formatGgU(136), '17 gg/u');
});
