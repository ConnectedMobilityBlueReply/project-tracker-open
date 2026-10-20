import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldExitFullscreen } from './overlayGuards.ts';

const escape = overrides => ({
  key: 'Escape', defaultPrevented: false, insideListbox: false, hasOpenDialog: false, ...overrides,
});

test('Esc libero esce dallo schermo intero', () => {
  assert.equal(shouldExitFullscreen(escape({})), true);
});

test('Esc già gestito da una cella (annulla la bozza) non esce dallo schermo intero', () => {
  assert.equal(shouldExitFullscreen(escape({ defaultPrevented: true })), false);
});

test('Esc dentro una lista aperta (Select) non esce dallo schermo intero', () => {
  assert.equal(shouldExitFullscreen(escape({ insideListbox: true })), false);
});

test('Esc con un dialog aperto chiude solo il dialog', () => {
  assert.equal(shouldExitFullscreen(escape({ hasOpenDialog: true })), false);
});

test('un tasto diverso da Esc non esce dallo schermo intero', () => {
  assert.equal(shouldExitFullscreen(escape({ key: 'Enter' })), false);
});
