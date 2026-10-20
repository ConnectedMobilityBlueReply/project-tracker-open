import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_WBS_FORM, toWbsPayload, validateWbsForm, wbsToForm } from './wbsForm.ts';

const valid = over => ({ ...EMPTY_WBS_FORM, name: 'Componente', estimated_days: '2', ...over });
const creating = { editing: false, taskId: 7 };

test('form vuoto in creazione: nome e giorni obbligatori', () => {
  assert.deepEqual(validateWbsForm(EMPTY_WBS_FORM, creating), {
    name: 'Il nome è obbligatorio',
    estimated_days: 'Inserisci i giorni stimati',
  });
});

test('task obbligatorio solo in creazione', () => {
  assert.deepEqual(validateWbsForm(valid(), { editing: false, taskId: null }), { task: 'Seleziona il task di appartenenza' });
  assert.deepEqual(validateWbsForm(valid(), { editing: true, taskId: null }), {});
});

test('giorni stimati: numero >= 0', () => {
  const message = 'I giorni stimati devono essere un numero ≥ 0';
  assert.deepEqual(validateWbsForm(valid({ estimated_days: 'x' }), creating), { estimated_days: message });
  assert.deepEqual(validateWbsForm(valid({ estimated_days: '-1' }), creating), { estimated_days: message });
  assert.deepEqual(validateWbsForm(valid({ estimated_days: '0' }), creating), {});
  assert.deepEqual(validateWbsForm(valid({ estimated_days: '1,5' }), creating), { estimated_days: message });
  assert.deepEqual(validateWbsForm(valid({ estimated_days: 'Infinity' }), creating), { estimated_days: message });
  assert.deepEqual(validateWbsForm(valid({ estimated_days: '2abc' }), creating), { estimated_days: message });
});

test('completamento: intero 0-100, obbligatorio', () => {
  const message = 'Inserisci un numero intero tra 0 e 100';
  assert.deepEqual(validateWbsForm(valid({ completion_pct: '' }), creating), { completion_pct: 'Inserisci la percentuale di completamento' });
  assert.deepEqual(validateWbsForm(valid({ completion_pct: '101' }), creating), { completion_pct: message });
  assert.deepEqual(validateWbsForm(valid({ completion_pct: '-1' }), creating), { completion_pct: message });
  assert.deepEqual(validateWbsForm(valid({ completion_pct: '100' }), creating), {});
  assert.deepEqual(validateWbsForm(valid({ completion_pct: '100.5' }), creating), { completion_pct: message });
  assert.deepEqual(validateWbsForm(valid({ completion_pct: '40.9' }), creating), { completion_pct: message });
});

test('date: fine uguale all inizio valida, precedente rifiutata', () => {
  assert.deepEqual(validateWbsForm(valid({ planned_start: '2026-10-10', planned_end: '2026-10-10' }), creating), {});
  assert.deepEqual(
    validateWbsForm(valid({ planned_start: '2026-10-10', planned_end: '2026-10-09' }), creating),
    { planned_end: 'La data di fine non può precedere la data di inizio' },
  );
  assert.deepEqual(validateWbsForm(valid({ planned_end: '2026-10-09' }), creating), {});
});

test('wbsToForm riporta i campi come stringhe, null come vuoto', () => {
  const item = {
    id: 1, task_id: 7, task_type: 'DEV', name: 'X', estimated_days: 1.5, completion_pct: 40, status: 'in_corso',
    planned_start: '2026-10-01', planned_end: undefined, assignee_person_id: 3, description: undefined, created_at: '2026-01-01',
  };
  assert.deepEqual(wbsToForm(item), {
    name: 'X', estimated_days: '1.5', completion_pct: '40', status: 'in_corso',
    planned_start: '2026-10-01', planned_end: '', assignee_person_id: '3', description: '',
  });
  assert.equal(wbsToForm({ ...item, assignee_person_id: null }).assignee_person_id, '');
});

test('toWbsPayload: numeri veri, campi vuoti undefined, task dato', () => {
  assert.deepEqual(
    toWbsPayload(valid({ name: ' X ', estimated_days: '1.5', completion_pct: '40', assignee_person_id: '3', description: ' d ' }), 7),
    {
      task_id: 7, name: 'X', description: 'd', estimated_days: 1.5, completion_pct: 40, status: 'aperto',
      planned_start: undefined, planned_end: undefined, assignee_person_id: 3,
    },
  );
  assert.equal(toWbsPayload(valid(), null).task_id, 0);
  assert.equal(toWbsPayload(valid(), 7).assignee_person_id, undefined);
});
