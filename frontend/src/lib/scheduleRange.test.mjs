import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRange, rangeFromToday } from './scheduleRange.ts';

test('formatRange: stesso anno senza anno, estremo finale incluso', () => {
  assert.equal(formatRange('2026-10-12', '2026-11-23'), '12 ott – 22 nov');
});

test('formatRange: anni diversi mostrano l\'anno su entrambi i lati', () => {
  assert.equal(formatRange('2026-12-28', '2027-02-08'), '28 dic 2026 – 7 feb 2027');
});

test('rangeFromToday: riparte dal lunedì della settimana corrente mantenendo l\'ampiezza', () => {
  // 56 giorni; il 2026-10-15 è un giovedì, il lunedì è il 12.
  assert.deepEqual(
    rangeFromToday('2026-08-03', '2026-09-28', '2026-10-15'),
    { from: '2026-10-12', to: '2026-12-07' });
});

test('rangeFromToday: se oggi è lunedì parte da oggi', () => {
  assert.deepEqual(
    rangeFromToday('2026-08-03', '2026-08-31', '2026-10-12'),
    { from: '2026-10-12', to: '2026-11-09' });
});
