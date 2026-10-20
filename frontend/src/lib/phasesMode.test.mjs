import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_DISABLE_DRAFT,
  implicitTaskId,
  isPhaseless,
  isSinglePerson,
  resolveAllocationDays,
  resolveAssignTask,
  toDisablePayload,
  validateDisableDraft,
  validatePhaselessTaskForm,
} from './phasesMode.ts';

const draft = (overrides = {}) => ({
  ...EMPTY_DISABLE_DRAFT, person_id: '7', planned_start: '2026-10-01', planned_end: '2026-10-31', ...overrides,
});

test('isPhaseless: solo progetti reali con uses_phases false', () => {
  assert.equal(isPhaseless({ uses_phases: false, is_virtual: 0 }), true);
  assert.equal(isPhaseless({ uses_phases: true, is_virtual: 0 }), false);
  assert.equal(isPhaseless({ is_virtual: 0 }), false);
  assert.equal(isPhaseless({ uses_phases: false, is_virtual: 1 }), false);
});

test('implicitTaskId: il GEN dei soli progetti senza fasi, per non far scegliere l’attività', () => {
  const tasks = [{ id: 41, task_type: 'GEN' }];
  assert.equal(implicitTaskId({ uses_phases: false, is_virtual: 0, tasks }), 41);
  assert.equal(implicitTaskId({ uses_phases: false, is_virtual: 0, tasks: [] }), null);
  assert.equal(implicitTaskId({ uses_phases: true, is_virtual: 0, tasks }), null);
  assert.equal(implicitTaskId({ is_virtual: 0, tasks }), null);
  assert.equal(implicitTaskId({ uses_phases: false, is_virtual: 1, tasks }), null);
});

test('disattivazione: bozza completa e coerente è valida', () => {
  assert.deepEqual(validateDisableDraft(draft()), {});
});

test('disattivazione: inizio e fine nello stesso giorno è valido', () => {
  assert.deepEqual(validateDisableDraft(draft({ planned_end: '2026-10-01' })), {});
});

test('disattivazione: persona e date si possono lasciare vuote e assegnare dopo', () => {
  assert.deepEqual(validateDisableDraft(EMPTY_DISABLE_DRAFT), {});
});

test('disattivazione: una data sola è incompleta', () => {
  assert.ok(validateDisableDraft(draft({ planned_end: '' })).plannedEnd);
  assert.ok(validateDisableDraft(draft({ planned_start: '' })).plannedStart);
});

test('disattivazione: fine prima dell’inizio è rifiutata', () => {
  const errors = validateDisableDraft(draft({ planned_end: '2026-09-30' }));
  assert.match(errors.plannedEnd, /precedente/);
});

test('disattivazione: giorni stimati negativi sono rifiutati', () => {
  assert.ok(validateDisableDraft(draft({ estimated_days: '-1' })).estimatedDays);
  assert.deepEqual(validateDisableDraft(draft({ estimated_days: '0' })), {});
});

test('disattivazione: giorni stimati non numerici o solo spazi sono rifiutati', () => {
  assert.match(validateDisableDraft(draft({ estimated_days: 'abc' })).estimatedDays, /numero/);
  assert.match(validateDisableDraft(draft({ estimated_days: ' ' })).estimatedDays, /numero/);
  assert.deepEqual(validateDisableDraft(draft({ estimated_days: '' })), {});
  assert.deepEqual(validateDisableDraft(draft({ estimated_days: '12.5' })), {});
});

test('payload di disattivazione: campi vuoti omessi', () => {
  assert.deepEqual(toDisablePayload(EMPTY_DISABLE_DRAFT), { uses_phases: false });
});

test('payload di disattivazione: numeri veri, giorni stimati solo se presenti', () => {
  assert.deepEqual(toDisablePayload(draft()), {
    uses_phases: false, person_id: 7, planned_start: '2026-10-01', planned_end: '2026-10-31',
  });
  assert.deepEqual(toDisablePayload(draft({ estimated_days: '12.5' })), {
    uses_phases: false, person_id: 7, planned_start: '2026-10-01', planned_end: '2026-10-31', estimated_days: 12.5,
  });
});

test('task implicito: date facoltative ma, se presenti, complete e ordinate', () => {
  const form = (o = {}) => ({ enabled: true, status: 'not_started', planned_start: '2026-10-01', planned_end: '2026-10-31', estimated_days: '', ...o });
  assert.deepEqual(validatePhaselessTaskForm(form()), {});
  assert.deepEqual(validatePhaselessTaskForm(form({ planned_start: '', planned_end: '' })), {});
  assert.ok(validatePhaselessTaskForm(form({ planned_end: '' })).plannedEnd);
  assert.ok(validatePhaselessTaskForm(form({ planned_start: '' })).plannedEnd);
  assert.match(validatePhaselessTaskForm(form({ planned_end: '2026-09-01' })).plannedEnd, /precedente/);
  assert.ok(validatePhaselessTaskForm(form({ estimated_days: '-2' })).estimatedDays);
});

test('task implicito: giorni stimati non numerici o solo spazi sono rifiutati', () => {
  const form = (o = {}) => ({ enabled: true, status: 'not_started', planned_start: '2026-10-01', planned_end: '2026-10-31', estimated_days: '', ...o });
  assert.match(validatePhaselessTaskForm(form({ estimated_days: 'abc' })).estimatedDays, /numero/);
  assert.match(validatePhaselessTaskForm(form({ estimated_days: ' ' })).estimatedDays, /numero/);
  assert.deepEqual(validatePhaselessTaskForm(form({ estimated_days: '0' })), {});
  assert.deepEqual(validatePhaselessTaskForm(form({ estimated_days: '12.5' })), {});
});

test('solo i T&M hanno una persona sola', () => {
  assert.equal(isSinglePerson('tm'), true);
  assert.equal(isSinglePerson('turnkey'), false);
  assert.equal(isSinglePerson(undefined), false);
});

test('giorni vuoti: si riportano quelli della persona sostituita, 0 se non ce ne sono', () => {
  assert.equal(resolveAllocationDays('', 10), 10);
  assert.equal(resolveAllocationDays('', 0), 0);
  assert.equal(resolveAllocationDays('', null), 0);
  assert.equal(resolveAllocationDays('', undefined), 0);
});

test('giorni digitati vincono sempre, anche 0 e decimali', () => {
  assert.equal(resolveAllocationDays('3', 10), 3);
  assert.equal(resolveAllocationDays('0', 10), 0);
  assert.equal(resolveAllocationDays('2.5', undefined), 2.5);
});

test('modale di assegnazione: progetto senza fasi usa il GEN senza scelta dell’attività', () => {
  const tasks = [{ id: 41, task_type: 'GEN' }];
  assert.equal(resolveAssignTask({ uses_phases: false, is_virtual: 0 }, tasks, null)?.id, 41);
  assert.equal(resolveAssignTask({ uses_phases: false, is_virtual: 0 }, [], null), null);
});

test('modale di assegnazione: con fasi vale l’attività scelta', () => {
  const tasks = [{ id: 1, task_type: 'AF' }, { id: 2, task_type: 'DEV' }];
  assert.equal(resolveAssignTask({ uses_phases: true, is_virtual: 0 }, tasks, 2)?.id, 2);
  assert.equal(resolveAssignTask({ uses_phases: true, is_virtual: 0 }, tasks, null), null);
  assert.equal(resolveAssignTask(null, tasks, 1)?.id, 1);
});
