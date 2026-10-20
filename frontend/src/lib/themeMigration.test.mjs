import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateThemeValue, migrateStoredTheme, THEME_STORAGE_KEY } from './themeMigration.ts';

test('migrateThemeValue: temi rimossi verso il più vicino, validi invariati', () => {
  assert.equal(migrateThemeValue('cream'), 'light');
  assert.equal(migrateThemeValue('moonlight'), 'dark');
  assert.equal(migrateThemeValue('light'), 'light');
  assert.equal(migrateThemeValue('dark'), 'dark');
  assert.equal(migrateThemeValue('system'), 'system');
});

test('migrateThemeValue: nessun valore resta nullo, sconosciuto diventa system', () => {
  assert.equal(migrateThemeValue(null), null);
  assert.equal(migrateThemeValue('sepia'), 'system');
  assert.equal(migrateThemeValue('constructor'), 'system');
});

test('migrateStoredTheme riscrive solo se il valore cambia', () => {
  const writes = [];
  const storage = {
    value: 'moonlight',
    getItem(key) { assert.equal(key, THEME_STORAGE_KEY); return this.value; },
    setItem(key, value) { writes.push([key, value]); },
  };
  migrateStoredTheme(storage);
  assert.deepEqual(writes, [['theme', 'dark']]);

  writes.length = 0;
  storage.value = 'light';
  migrateStoredTheme(storage);
  assert.deepEqual(writes, []);
});

test('migrateStoredTheme non lancia se lo storage lancia', () => {
  const storage = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('SecurityError'); },
  };
  assert.doesNotThrow(() => migrateStoredTheme(storage));
});
