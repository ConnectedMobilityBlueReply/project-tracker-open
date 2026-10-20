import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoCheck, canCheck, canInstall, initialUpdateState, reduceUpdateState } from './updateState.mjs';

const NOW = '2026-10-08T14:32:00.000Z';
const idle = initialUpdateState('1.1.0', true);
const step = (state, ...events) => events.reduce((s, e) => reduceUpdateState(s, e, NOW), state);

test('stato iniziale: idle se supportato, unsupported altrimenti', () => {
  assert.deepEqual(idle, { status: 'idle', version: null, percent: null, checkedAt: null, currentVersion: '1.1.0' });
  assert.equal(initialUpdateState('1.1.0', false).status, 'unsupported');
});

test('controllo senza novità: checking poi up-to-date con checkedAt', () => {
  assert.equal(step(idle, { type: 'checking' }).status, 'checking');
  const done = step(idle, { type: 'checking' }, { type: 'not-available' });
  assert.equal(done.status, 'up-to-date');
  assert.equal(done.checkedAt, NOW);
});

test('nuova versione: downloading con percentuale, poi ready', () => {
  const downloading = step(idle, { type: 'checking' }, { type: 'available', version: '1.2.0' });
  assert.deepEqual(
    { status: downloading.status, version: downloading.version, percent: downloading.percent, checkedAt: downloading.checkedAt },
    { status: 'downloading', version: '1.2.0', percent: 0, checkedAt: NOW },
  );
  assert.equal(step(downloading, { type: 'progress', percent: 42.7 }).percent, 43);
  const ready = step(downloading, { type: 'downloaded', version: '1.2.0' });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.version, '1.2.0');
  assert.equal(ready.percent, null);
});

test('percentuale sempre intera fra 0 e 100', () => {
  const downloading = step(idle, { type: 'available', version: '1.2.0' });
  assert.equal(step(downloading, { type: 'progress', percent: 100.4 }).percent, 100);
  assert.equal(step(downloading, { type: 'progress', percent: -3 }).percent, 0);
  assert.equal(step(downloading, { type: 'progress', percent: Number.NaN }).percent, 0);
});

test('errore: status error con checkedAt e senza versione', () => {
  const failed = step(idle, { type: 'checking' }, { type: 'error' });
  assert.equal(failed.status, 'error');
  assert.equal(failed.checkedAt, NOW);
  assert.equal(failed.version, null);
});

test('ready resta ready fino al riavvio, anche dopo errori o nuovi controlli', () => {
  const ready = step(idle, { type: 'available', version: '1.2.0' }, { type: 'downloaded', version: '1.2.0' });
  for (const event of [{ type: 'error' }, { type: 'checking' }, { type: 'not-available' }, { type: 'progress', percent: 5 }]) {
    assert.equal(step(ready, event), ready);
  }
});

test('ready + versione più recente scaricata: ready con la nuova versione', () => {
  const ready = step(idle, { type: 'downloaded', version: '1.2.0' });
  const newer = step(ready, { type: 'downloaded', version: '1.3.0' });
  assert.equal(newer.status, 'ready');
  assert.equal(newer.version, '1.3.0');
  assert.equal(newer.percent, null);
});

test('ready + stessa versione scaricata di nuovo: stesso oggetto', () => {
  const ready = step(idle, { type: 'downloaded', version: '1.2.0' });
  assert.equal(step(ready, { type: 'downloaded', version: '1.2.0' }), ready);
});

test('unsupported ignora ogni evento', () => {
  const unsupported = initialUpdateState('1.1.0', false);
  assert.equal(step(unsupported, { type: 'checking' }), unsupported);
});

test('canAutoCheck: falso solo mentre si controlla, scarica o non supportato, anche con ready', () => {
  const states = {
    idle,
    checking: step(idle, { type: 'checking' }),
    upToDate: step(idle, { type: 'not-available' }),
    downloading: step(idle, { type: 'available', version: '1.2.0' }),
    ready: step(idle, { type: 'downloaded', version: '1.2.0' }),
    error: step(idle, { type: 'error' }),
    unsupported: initialUpdateState('1.1.0', false),
  };
  assert.deepEqual(
    Object.fromEntries(Object.entries(states).map(([k, s]) => [k, canAutoCheck(s)])),
    { idle: true, checking: false, upToDate: true, downloading: false, ready: true, error: true, unsupported: false },
  );
});

test('canCheck: falso mentre si controlla, scarica, è pronto o non supportato', () => {
  const states = {
    idle,
    checking: step(idle, { type: 'checking' }),
    upToDate: step(idle, { type: 'not-available' }),
    downloading: step(idle, { type: 'available', version: '1.2.0' }),
    ready: step(idle, { type: 'downloaded', version: '1.2.0' }),
    error: step(idle, { type: 'error' }),
    unsupported: initialUpdateState('1.1.0', false),
  };
  assert.deepEqual(
    Object.fromEntries(Object.entries(states).map(([k, s]) => [k, canCheck(s)])),
    { idle: true, checking: false, upToDate: true, downloading: false, ready: false, error: true, unsupported: false },
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(states).map(([k, s]) => [k, canInstall(s)])),
    { idle: false, checking: false, upToDate: false, downloading: false, ready: true, error: false, unsupported: false },
  );
});
