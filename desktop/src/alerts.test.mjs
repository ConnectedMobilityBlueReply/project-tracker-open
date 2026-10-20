import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ALERT_COUNT, sanitizeAlertCount, shouldNotify } from './alerts.mjs';

test('accetta interi non negativi', () => {
  assert.equal(sanitizeAlertCount(0), 0);
  assert.equal(sanitizeAlertCount(7), 7);
});

test('rifiuta valori non validi dal renderer', () => {
  for (const value of [-1, 1.5, NaN, Infinity, '3', null, undefined, {}]) {
    assert.equal(sanitizeAlertCount(value), null, String(value));
  }
});

test('limita i valori enormi', () => {
  assert.equal(sanitizeAlertCount(10 ** 9), MAX_ALERT_COUNT);
});

test('nessuna notifica al primo conteggio dopo l\'avvio', () => {
  assert.equal(shouldNotify(null, 5), false);
});

test('notifica solo quando il conteggio cresce', () => {
  assert.equal(shouldNotify(2, 3), true);
  assert.equal(shouldNotify(3, 3), false);
  assert.equal(shouldNotify(3, 1), false);
});
