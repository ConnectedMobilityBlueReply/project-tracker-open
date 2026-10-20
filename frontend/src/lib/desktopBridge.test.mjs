import test from 'node:test';
import assert from 'node:assert/strict';
import { alertTotal, forwardAlertCount, forwardTitleBarColors, hasDesktopUpdates, rgbToHex } from './desktopBridge.ts';

const alerts = { overdue_wbs: 2, overcapacity_persons: 1, tm_plafond_projects: 1, overdue_list: [] };

test('il totale somma WBS in ritardo, persone in sovraccarico e progetti T&M oltre plafond', () => {
  assert.equal(alertTotal(alerts), 4);
});

test('inoltra il totale al bridge desktop', () => {
  const sent = [];
  forwardAlertCount(alerts, { setAlertCount: (n) => sent.push(n) });
  assert.deepEqual(sent, [4]);
});

test('nel browser, senza bridge, non fa nulla', () => {
  assert.doesNotThrow(() => forwardAlertCount(alerts, undefined));
});

test('converte i byte RGB in #rrggbb', () => {
  assert.equal(rgbToHex(238, 238, 238), '#eeeeee');
  assert.equal(rgbToHex(10, 0, 255), '#0a00ff');
});

test('inoltra i colori della title bar al bridge desktop', () => {
  const sent = [];
  forwardTitleBarColors({ color: '#eeeeee', symbolColor: '#0a0a0a' }, { setTitleBarColors: (c) => sent.push(c) });
  assert.deepEqual(sent, [{ color: '#eeeeee', symbolColor: '#0a0a0a' }]);
});

test('nel browser, senza bridge, i colori non vanno da nessuna parte', () => {
  assert.doesNotThrow(() => forwardTitleBarColors({ color: '#000000', symbolColor: '#ffffff' }, undefined));
});

test('aggiornamenti disponibili solo con un bridge che espone updates', () => {
  assert.equal(hasDesktopUpdates(undefined), false);
  assert.equal(hasDesktopUpdates({ platform: 'darwin' }), false);
  assert.equal(hasDesktopUpdates({ platform: 'darwin', updates: {} }), true);
});
