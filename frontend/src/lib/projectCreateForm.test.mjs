import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_PROJECT_FORM, toCreatePayload, validateProjectForm } from './projectCreateForm.ts';

const form = over => ({ ...EMPTY_PROJECT_FORM, name: 'Portale', ...over });

test('nome obbligatorio, anche se solo spazi', () => {
  assert.deepEqual(validateProjectForm(EMPTY_PROJECT_FORM), { name: 'Il nome è obbligatorio' });
  assert.deepEqual(validateProjectForm(form({ name: '   ' })), { name: 'Il nome è obbligatorio' });
});

test('stima vuota o zero sono valide', () => {
  assert.deepEqual(validateProjectForm(form({ estimate_days: '' })), {});
  assert.deepEqual(validateProjectForm(form({ estimate_days: '0' })), {});
  assert.deepEqual(validateProjectForm(form({ estimate_days: '12.5' })), {});
});

test('stima non numerica o negativa rifiutata', () => {
  const message = 'La stima deve essere un numero ≥ 0';
  assert.deepEqual(validateProjectForm(form({ estimate_days: 'abc' })), { estimate_days: message });
  assert.deepEqual(validateProjectForm(form({ estimate_days: '-1' })), { estimate_days: message });
  assert.deepEqual(validateProjectForm(form({ estimate_days: '1,5' })), { estimate_days: message });
});

test('toCreatePayload lascia undefined i campi vuoti e pulisce il nome', () => {
  assert.deepEqual(toCreatePayload(form({ name: '  Portale  ' })), {
    name: 'Portale',
    description: undefined,
    societa: undefined,
    area: undefined,
    pm_riferimento_cliente: undefined,
    estimate_days: undefined,
  });
});

test('toCreatePayload mappa i campi compilati ai nomi del backend', () => {
  assert.deepEqual(
    toCreatePayload(form({ societa: 'Alfa', area: 'Digital', pm: 'Rossi', estimate_days: '30', description: ' Note ' })),
    { name: 'Portale', description: 'Note', societa: 'Alfa', area: 'Digital', pm_riferimento_cliente: 'Rossi', estimate_days: 30 },
  );
});
