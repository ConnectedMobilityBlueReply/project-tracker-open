import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTimeEntryPayload } from './consuntivazionePayload.ts';

const baseInput = {
  personId: 42,
  taskId: 7,
  weekStart: '2026-08-17',
  hours: 1,
};

test('un ora diventa 0,125 giorni', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload({ ...baseInput, hours: 1 });

  // Assert
  assert.equal(payload.man_days, 0.125);
});

test('otto ore diventano un giorno', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload({ ...baseInput, hours: 8 });

  // Assert
  assert.equal(payload.man_days, 1);
});

test('zero ore diventano zero giorni', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload({ ...baseInput, hours: 0 });

  // Assert
  assert.equal(payload.man_days, 0);
});

test('person_id, task_id e week_start passano invariati nel payload', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload(baseInput);

  // Assert
  assert.equal(payload.person_id, 42);
  assert.equal(payload.task_id, 7);
  assert.equal(payload.week_start, '2026-08-17');
});

test('wbs_item_id assente quando non fornito', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload(baseInput);

  // Assert
  assert.equal('wbs_item_id' in payload, false);
});

test('wbs_item_id assente quando esplicitamente null', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload({ ...baseInput, wbsItemId: null });

  // Assert
  assert.equal('wbs_item_id' in payload, false);
});

test('wbs_item_id presente quando fornito', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload({ ...baseInput, wbsItemId: 9 });

  // Assert
  assert.equal(payload.wbs_item_id, 9);
});

test('notes assente quando non fornita (upsert completo: non azzera una nota che non deve cambiare)', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload(baseInput);

  // Assert
  assert.equal('notes' in payload, false);
});

test('notes assente quando esplicitamente null', () => {
  // Arrange / Act
  const payload = buildTimeEntryPayload({ ...baseInput, notes: null });

  // Assert
  assert.equal('notes' in payload, false);
});

test('notes presente, anche vuota, quando fornita esplicitamente', () => {
  // Arrange / Act
  const withText = buildTimeEntryPayload({ ...baseInput, notes: 'nota' });
  const empty = buildTimeEntryPayload({ ...baseInput, notes: '' });

  // Assert
  assert.equal(withText.notes, 'nota');
  assert.equal(empty.notes, '');
});

test('salvare solo la nota richiede comunque di ripassare le ore correnti: man_days riflette hours anche quando notes cambia', () => {
  // Arrange — scenario "solo nota": le ore restano quelle gia' consuntivate (es. 16h) e la nota cambia.
  // Act
  const payload = buildTimeEntryPayload({ ...baseInput, hours: 16, notes: 'aggiornata' });

  // Assert — l'upsert e' completo: senza ripassare hours qui, man_days finirebbe a 0 e azzererebbe le ore.
  assert.equal(payload.man_days, 2);
  assert.equal(payload.notes, 'aggiornata');
});
