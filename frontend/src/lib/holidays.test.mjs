import assert from 'node:assert/strict';
import test from 'node:test';
import { easterMonday, isHoliday, italianHolidays } from './holidays.ts';

test('Pasquetta 2026 cade il 6 aprile', () => {
  assert.equal(easterMonday(2026), '2026-04-06');
});

test('Pasquetta 2027 cade il 29 marzo', () => {
  assert.equal(easterMonday(2027), '2027-03-29');
});

test('Pasquetta 1900 cade il 16 aprile', () => {
  assert.equal(easterMonday(1900), '1900-04-16');
});

test('Pasquetta 2024 cade il 1° aprile', () => {
  // Pasqua 2024 cade il 31 marzo: day + 1 = 32, Date.UTC normalizza al 1° aprile.
  assert.equal(easterMonday(2024), '2024-04-01');
  assert.ok(italianHolidays(2024).includes('2024-04-01'));
});

test('Pasquetta 2100 cade il 29 marzo', () => {
  assert.equal(easterMonday(2100), '2100-03-29');
});

test('l’anno ha dieci festività fisse più Pasquetta', () => {
  const holidays = italianHolidays(2026);
  assert.equal(holidays.length, 11);
  for (const fixed of [
    '2026-01-01', '2026-01-06', '2026-04-25', '2026-05-01', '2026-06-02',
    '2026-08-15', '2026-11-01', '2026-12-08', '2026-12-25', '2026-12-26',
  ]) {
    assert.ok(holidays.includes(fixed), `manca la festività ${fixed}`);
  }
});

test('le festività sono ordinate', () => {
  const holidays = italianHolidays(2026);
  assert.deepEqual(holidays, [...holidays].sort());
});

test('isHoliday riconosce la data e ignora i giorni feriali', () => {
  assert.equal(isHoliday('2026-12-25'), true);
  assert.equal(isHoliday('2026-04-06'), true);
  assert.equal(isHoliday('2026-08-17'), false);
});

test('isHoliday funziona su anni diversi senza precalcolo', () => {
  assert.equal(isHoliday('2030-01-06'), true);
  assert.equal(isHoliday('2030-04-22'), true); // Pasquetta 2030
});
