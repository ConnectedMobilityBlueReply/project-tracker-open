import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSegments } from './timelineBars.ts';

const WEEKS = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'];
const from = record => week => record[week] ?? 0;

test('settimane consecutive con ore diventano un solo segmento', () => {
  // Arrange
  const hours = { '2026-09-07': 8, '2026-09-14': 16 };

  // Act
  const segments = buildSegments(WEEKS, from(hours));

  // Assert
  assert.deepEqual(segments, [{
    startIndex: 0,
    weeks: [{ week: '2026-09-07', hours: 8 }, { week: '2026-09-14', hours: 16 }],
    totalHours: 24,
    overCapacity: false,
  }]);
});

test('una settimana senza ore spezza la barra', () => {
  const segments = buildSegments(WEEKS, from({ '2026-09-07': 8, '2026-09-28': 4 }));
  assert.deepEqual(segments.map(s => [s.startIndex, s.weeks.length, s.totalHours]), [[0, 1, 8], [3, 1, 4]]);
});

test('una settimana a zero ore spezza la barra come una mancante', () => {
  const segments = buildSegments(WEEKS, from({ '2026-09-07': 8, '2026-09-14': 0, '2026-09-21': 8 }));
  assert.equal(segments.length, 2);
});

test('overCapacity è vero solo sul segmento con una settimana oltre capacità', () => {
  const segments = buildSegments(WEEKS, from({ '2026-09-07': 44, '2026-09-21': 40 }), 40);
  assert.deepEqual(segments.map(s => s.overCapacity), [true, false]);
});

test('capacità zero o assente non segna nessun segmento oltre capacità', () => {
  const hours = from({ '2026-09-07': 8 });
  assert.equal(buildSegments(WEEKS, hours, 0)[0].overCapacity, false);
  assert.equal(buildSegments(WEEKS, hours)[0].overCapacity, false);
});

test('ore su settimane fuori dall intervallo vengono ignorate', () => {
  const segments = buildSegments(WEEKS, from({ '2027-01-04': 8 }));
  assert.deepEqual(segments, []);
});

test('riga senza ore non produce segmenti', () => {
  assert.deepEqual(buildSegments(WEEKS, () => 0), []);
  assert.deepEqual(buildSegments([], () => 8), []);
});
