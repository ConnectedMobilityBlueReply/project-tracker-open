import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlannableProject } from './plannableProject.ts';

test('isPlannableProject: concluso e lavorato a consuntivo sono chiusi', () => {
  assert.equal(isPlannableProject({ status: 'concluso' }), false);
  assert.equal(isPlannableProject({ status: 'lavorato a consuntivo' }), false);
});

test('isPlannableProject: gli altri stati e lo stato assente restano pianificabili', () => {
  assert.equal(isPlannableProject({ status: 'da lavorare' }), true);
  assert.equal(isPlannableProject({ status: 'in lavorazione' }), true);
  assert.equal(isPlannableProject({ status: null }), true);
  assert.equal(isPlannableProject({}), true);
});
