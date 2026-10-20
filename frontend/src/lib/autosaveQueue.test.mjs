import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutosaveQueue } from './autosaveQueue.ts';

// Promessa risolvibile dall'esterno: simula una PUT ancora in volo.
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const setup = () => {
  const states = [];
  const queue = createAutosaveQueue(state => states.push(state), () => new Date('2026-10-07T21:10:00'));
  return { queue, states, last: () => states.at(-1) };
};

test('salva un job e passa a saved con orario', async () => {
  // Arrange
  const { queue, last } = setup();
  const calls = [];

  // Act
  queue.push({ key: 'project', run: async () => { calls.push('p1'); } });
  await queue.flush();

  // Assert
  assert.deepEqual(calls, ['p1']);
  assert.equal(last().status, 'saved');
  assert.equal(last().savedAt.toISOString(), new Date('2026-10-07T21:10:00').toISOString());
  assert.equal(queue.hasUnsaved(), false);
});

test('una sola richiesta in volo: le push successive sulla stessa chiave tengono solo l ultimo snapshot', async () => {
  // Arrange
  const { queue } = setup();
  const first = deferred();
  const calls = [];
  queue.push({ key: 'project', run: () => { calls.push('v1'); return first.promise; } });

  // Act: arrivano v2 e v3 mentre v1 è in volo
  queue.push({ key: 'project', run: async () => { calls.push('v2'); } });
  queue.push({ key: 'project', run: async () => { calls.push('v3'); } });
  assert.deepEqual(calls, ['v1']);
  first.resolve();
  await queue.flush();

  // Assert: v2 scartato, v3 salvato dopo v1
  assert.deepEqual(calls, ['v1', 'v3']);
});

test('chiavi diverse vengono salvate in sequenza, non in parallelo', async () => {
  // Arrange
  const { queue } = setup();
  const first = deferred();
  const calls = [];

  // Act
  queue.push({ key: 'project', run: () => { calls.push('project'); return first.promise; } });
  queue.push({ key: 'task:DEV', run: async () => { calls.push('task'); } });
  assert.deepEqual(calls, ['project']);
  first.resolve();
  await queue.flush();

  // Assert
  assert.deepEqual(calls, ['project', 'task']);
});

test('errore: stato error con chiave, campo e messaggio; hasUnsaved resta true', async () => {
  // Arrange
  const { queue, last } = setup();

  // Act
  queue.push({ key: 'project', field: 'codice_offerta', run: async () => { throw new Error('Errore di rete'); } });
  await queue.flush();

  // Assert
  assert.equal(last().status, 'error');
  assert.equal(last().failedKey, 'project');
  assert.equal(last().failedField, 'codice_offerta');
  assert.equal(last().error, 'Errore di rete');
  assert.equal(queue.hasUnsaved(), true);
});

test('errore durante una richiesta in volo: il campo segnalato è l ultimo modificato, non il primo', async () => {
  // Arrange
  const { queue, last } = setup();
  const first = deferred();
  queue.push({ key: 'project', field: 'name', run: () => first.promise });

  // Act: arriva una modifica a codice_offerta mentre name è in volo, poi entrambe falliscono
  queue.push({ key: 'project', field: 'codice_offerta', run: async () => { throw new Error('Errore di rete'); } });
  first.resolve();
  await queue.flush();

  // Assert
  assert.equal(last().failedField, 'codice_offerta');
});

test('retry riesegue il job fallito e torna a saved', async () => {
  // Arrange
  const { queue, last } = setup();
  let attempts = 0;
  queue.push({ key: 'project', run: async () => { attempts += 1; if (attempts === 1) throw new Error('boom'); } });
  await queue.flush();

  // Act
  queue.retry();
  await queue.flush();

  // Assert
  assert.equal(attempts, 2);
  assert.equal(last().status, 'saved');
  assert.equal(last().failedField, null);
  assert.equal(queue.hasUnsaved(), false);
});

test('dopo un errore, una nuova push sulla stessa chiave sostituisce il job fallito', async () => {
  // Arrange
  const { queue, last } = setup();
  const calls = [];
  queue.push({ key: 'project', run: async () => { calls.push('old'); throw new Error('boom'); } });
  await queue.flush();

  // Act
  queue.push({ key: 'project', run: async () => { calls.push('new'); } });
  await queue.flush();

  // Assert
  assert.deepEqual(calls, ['old', 'new']);
  assert.equal(last().status, 'saved');
});

test('dopo un errore, una push su altra chiave riprova anche il job fallito', async () => {
  // Arrange
  const { queue, last } = setup();
  const calls = [];
  let fail = true;
  queue.push({ key: 'project', run: async () => { calls.push('project'); if (fail) throw new Error('boom'); } });
  await queue.flush();
  fail = false;

  // Act
  queue.push({ key: 'task:AF', run: async () => { calls.push('task'); } });
  await queue.flush();

  // Assert
  assert.deepEqual(calls, ['project', 'project', 'task']);
  assert.equal(last().status, 'saved');
});

test('discard svuota pending e cancella lo stato di errore', async () => {
  // Arrange
  const { queue, last } = setup();
  queue.push({ key: 'project', run: async () => { throw new Error('boom'); } });
  await queue.flush();

  // Act
  queue.discard();

  // Assert
  assert.equal(queue.hasUnsaved(), false);
  assert.equal(last().status, 'idle');
});

test('flush a coda vuota si risolve subito', async () => {
  const { queue } = setup();
  await queue.flush();
  assert.equal(queue.hasUnsaved(), false);
});

test('un job che fallisce non blocca i salvataggi delle altre chiavi', async () => {
  // Arrange
  const { queue, last } = setup();
  const calls = [];
  queue.push({ key: 'task:DEV', field: 'task:DEV.planned_end', run: async () => { calls.push('task'); throw new Error('404'); } });
  await queue.flush();

  // Act
  queue.push({ key: 'project', field: 'name', run: async () => { calls.push('project'); } });
  await queue.flush();

  // Assert: il progetto è salvato, il task resta in errore
  assert.ok(calls.includes('project'));
  assert.equal(last().status, 'error');
  assert.equal(last().failedKey, 'task:DEV');
  assert.equal(queue.hasUnsaved(), true);
});

test('drop rimuove la chiave in attesa e azzera l errore se era quella fallita', async () => {
  // Arrange
  const { queue, last } = setup();
  queue.push({ key: 'task:DEV', run: async () => { throw new Error('404'); } });
  await queue.flush();

  // Act
  queue.drop('task:DEV');

  // Assert
  assert.equal(queue.hasUnsaved(), false);
  assert.equal(last().status, 'idle');
  assert.equal(last().failedKey, null);
});

test('drop di una chiave non fallita lascia lo stato di errore delle altre', async () => {
  const { queue, last } = setup();
  queue.push({ key: 'project', run: async () => { throw new Error('boom'); } });
  await queue.flush();
  queue.drop('task:AF');
  assert.equal(last().status, 'error');
  assert.equal(queue.hasUnsaved(), true);
});
