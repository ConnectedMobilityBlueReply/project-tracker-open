import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WBS_STATUS_TONE,
  projectStatusTone,
  UTILIZATION_TONE,
  TONE_BADGE_VARIANT,
  consumptionTone,
  completionTone,
} from './statusTone.ts';

test('stati WBS: aperto neutro, in corso blu, chiuso verde', () => {
  assert.deepEqual(WBS_STATUS_TONE, { aperto: 'neutral', in_corso: 'blue', chiuso: 'green' });
});

test('stati progetto mappati, valori sconosciuti neutri', () => {
  assert.equal(projectStatusTone('in lavorazione'), 'blue');
  assert.equal(projectStatusTone('active'), 'blue');
  assert.equal(projectStatusTone('da lavorare'), 'neutral');
  assert.equal(projectStatusTone('concluso'), 'green');
  assert.equal(projectStatusTone('lavorato a consuntivo'), 'purple');
  assert.equal(projectStatusTone('sospeso'), 'neutral');
  assert.equal(projectStatusTone(''), 'neutral');
});

test('utilizzo: libero neutro, sotto verde, pieno ambra, oltre e conflitto rosso', () => {
  assert.deepEqual(UTILIZATION_TONE, { free: 'neutral', under: 'green', full: 'amber', over: 'red', conflict: 'red' });
});

test('ogni tono ha una variante Badge Koala', () => {
  assert.deepEqual(TONE_BADGE_VARIANT, {
    blue: 'info', orange: 'orange', green: 'success', red: 'destructive', amber: 'warning', purple: 'purple', neutral: 'secondary',
  });
});

test('TONE_BADGE_VARIANT copre il tono purple', () => {
  assert.equal(TONE_BADGE_VARIANT.purple, 'purple');
});

test('consumo budget: rosso da 100, ambra da 80, altrimenti info', () => {
  assert.equal(consumptionTone(0), 'info');
  assert.equal(consumptionTone(79), 'info');
  assert.equal(consumptionTone(80), 'warning');
  assert.equal(consumptionTone(100), 'warning');
  assert.equal(consumptionTone(101), 'destructive');
  assert.equal(consumptionTone(Number.NaN), 'info');
});

test('completamento: verde solo a 100', () => {
  assert.equal(completionTone(99), 'info');
  assert.equal(completionTone(100), 'success');
});
