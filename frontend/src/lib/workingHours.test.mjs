import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FULL_WEEK_HOURS,
  HOURS_PER_DAY,
  daysToHours,
  hoursToDays,
  isWithinHoursLimit,
  italianHolidays,
  weekHolidays,
  weeklyCapacityHours,
} from './workingHours.ts';

test('calcola il Lunedì dell\'Angelo per anni noti', () => {
  const pasquetta = (year) =>
    italianHolidays(year).find((h) => h.name === 'Lunedì dell\'Angelo')?.date;

  // Pasqua: 20/04/2025, 05/04/2026, 28/03/2027
  assert.equal(pasquetta(2025), '2025-04-21');
  assert.equal(pasquetta(2026), '2026-04-06');
  assert.equal(pasquetta(2027), '2027-03-29');
});

test('elenca le 11 festività nazionali italiane', () => {
  const dates = italianHolidays(2026).map((h) => h.date);
  assert.equal(dates.length, 11);
  for (const expected of [
    '2026-01-01', '2026-01-06', '2026-04-06', '2026-04-25', '2026-05-01',
    '2026-06-02', '2026-08-15', '2026-11-01', '2026-12-08', '2026-12-25', '2026-12-26',
  ]) {
    assert.ok(dates.includes(expected), `manca ${expected}`);
  }
});

test('una settimana piena vale 40 ore', () => {
  assert.equal(weeklyCapacityHours('2026-08-10'), FULL_WEEK_HOURS);
  assert.equal(weekHolidays('2026-08-10').length, 0);
});

test('i festivi nel weekend non riducono le ore', () => {
  // Ferragosto 2026 cade di sabato, 25 aprile 2026 di sabato.
  assert.equal(weeklyCapacityHours('2026-08-10'), 40);
  assert.equal(weeklyCapacityHours('2026-04-20'), 40);
});

test('ogni festivo infrasettimanale toglie 8 ore', () => {
  // Lunedì dell'Angelo 06/04/2026 (lunedì)
  assert.equal(weeklyCapacityHours('2026-04-06'), 32);
  // Natale 25/12/2026 (venerdì)
  assert.equal(weeklyCapacityHours('2026-12-21'), 32);
  // 1 e 6 gennaio 2027 (venerdì e mercoledì) in settimane diverse
  assert.equal(weeklyCapacityHours('2026-12-28'), 32);
  assert.equal(weeklyCapacityHours('2027-01-04'), 32);
});

test('conta più festivi nella stessa settimana', () => {
  // 25/12/2025 giovedì + 26/12/2025 venerdì
  assert.equal(weeklyCapacityHours('2025-12-22'), 24);
  assert.deepEqual(
    weekHolidays('2025-12-22').map((h) => h.name),
    ['Natale', 'Santo Stefano'],
  );
});

test('gestisce le settimane a cavallo di due anni', () => {
  // Lun 28/12/2026 → Ven 01/01/2027: Capodanno appartiene all'anno dopo.
  assert.deepEqual(weekHolidays('2026-12-28').map((h) => h.date), ['2027-01-01']);
});

test('converte giorni e ore con la convenzione 8h/giorno', () => {
  assert.equal(HOURS_PER_DAY, 8);
  assert.equal(daysToHours(0.125), 1);
  assert.equal(daysToHours(2.5), 20);
  assert.equal(hoursToDays(1), 0.125);
  assert.equal(hoursToDays(40), 5);
  assert.equal(hoursToDays(0), 0);
});

test('isWithinHoursLimit rispetta la capienza della settimana', () => {
  assert.equal(isWithinHoursLimit(0, 40), true);
  assert.equal(isWithinHoursLimit(40, 40), true);
  assert.equal(isWithinHoursLimit(40.01, 40), false);
  assert.equal(isWithinHoursLimit(33, 32), false);
  assert.equal(isWithinHoursLimit(-1, 40), false);
  assert.equal(isWithinHoursLimit(Number.NaN, 40), false);
  assert.equal(isWithinHoursLimit('', 40), false);
});
