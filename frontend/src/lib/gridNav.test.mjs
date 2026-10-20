import assert from 'node:assert/strict';
import test from 'node:test';
import { nextCell } from './gridNav.ts';

const size = { rows: 3, cols: 4 };

test('frecce si muovono di una cella', () => {
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowUp', size), { row: 0, col: 1 });
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowDown', size), { row: 2, col: 1 });
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowLeft', size), { row: 1, col: 0 });
  assert.deepEqual(nextCell({ row: 1, col: 1 }, 'ArrowRight', size), { row: 1, col: 2 });
});

test('Invio scende di una riga come in un foglio di calcolo', () => {
  assert.deepEqual(nextCell({ row: 0, col: 2 }, 'Enter', size), { row: 1, col: 2 });
});

test('ai bordi non esce dalla griglia', () => {
  assert.equal(nextCell({ row: 0, col: 0 }, 'ArrowUp', size), null);
  assert.equal(nextCell({ row: 0, col: 0 }, 'ArrowLeft', size), null);
  assert.equal(nextCell({ row: 2, col: 3 }, 'ArrowDown', size), null);
  assert.equal(nextCell({ row: 2, col: 3 }, 'ArrowRight', size), null);
  assert.equal(nextCell({ row: 2, col: 3 }, 'Enter', size), null);
});
