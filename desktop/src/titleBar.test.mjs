import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeTitleBarColors } from './titleBar.mjs';

test('accetta colori #rrggbb', () => {
  assert.deepEqual(
    sanitizeTitleBarColors({ color: '#eeeeee', symbolColor: '#0A0A0A' }),
    { color: '#eeeeee', symbolColor: '#0A0A0A' },
  );
});

test('rifiuta formati diversi da #rrggbb', () => {
  for (const bad of ['eeeeee', '#eee', 'red', 'oklch(0.1 0 0)', 'url(x)', 42, null]) {
    assert.equal(sanitizeTitleBarColors({ color: bad, symbolColor: '#000000' }), null);
    assert.equal(sanitizeTitleBarColors({ color: '#000000', symbolColor: bad }), null);
  }
});

test('rifiuta payload non oggetto', () => {
  for (const bad of [undefined, null, '#000000', []]) assert.equal(sanitizeTitleBarColors(bad), null);
});
