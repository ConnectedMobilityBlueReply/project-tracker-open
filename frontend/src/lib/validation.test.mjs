import assert from 'node:assert/strict';
import test from 'node:test';
import { clampPercentage } from './validation.ts';

test('clampPercentage mantiene e limita gli estremi validi', () => {
  assert.equal(clampPercentage(0), 0);
  assert.equal(clampPercentage(100), 100);
  assert.equal(clampPercentage(101), 100);
  assert.equal(clampPercentage(-1), 0);
});

test('clampPercentage tratta NaN e stringa vuota come valore sicuro', () => {
  assert.equal(clampPercentage(Number.NaN), 0);
  assert.equal(clampPercentage(''), 0);
});
