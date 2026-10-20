import assert from 'node:assert/strict';
import test from 'node:test';
import { shiftRange, weeksInRange } from './consuntivazioneRange.ts';

test('weeksInRange attraversa il cambio di mese senza saltare settimane', () => {
  // Arrange — 2026-08-28 (venerdì) fino a 2026-09-10 (giovedì).
  const from = '2026-08-28';
  const to = '2026-09-10';

  // Act
  const weeks = weeksInRange(from, to);

  // Assert
  assert.deepEqual(weeks, ['2026-08-24', '2026-08-31', '2026-09-07']);
});

test('weeksInRange parte sempre da un lunedì', () => {
  for (const week of weeksInRange('2026-08-28', '2026-09-10')) {
    const [y, m, d] = week.split('-').map(Number);
    assert.equal(new Date(Date.UTC(y, m - 1, d)).getUTCDay(), 1, `${week} non è lunedì`);
  }
});

test('shiftRange in avanti sposta from e to della stessa ampiezza dell intervallo', () => {
  // Arrange — 6 settimane da 2026-08-17 a 2026-09-21.
  const from = '2026-08-17';
  const to = '2026-09-21';
  const weekCount = weeksInRange(from, to).length;

  // Act
  const next = shiftRange(from, to, weekCount, 1);

  // Assert
  assert.deepEqual(next, { from: '2026-09-28', to: '2026-11-02' });
});

test('shiftRange all indietro sposta from e to della stessa ampiezza dell intervallo', () => {
  // Arrange
  const from = '2026-08-17';
  const to = '2026-09-21';
  const weekCount = weeksInRange(from, to).length;

  // Act
  const previous = shiftRange(from, to, weekCount, -1);

  // Assert
  assert.deepEqual(previous, { from: '2026-07-06', to: '2026-08-10' });
});
