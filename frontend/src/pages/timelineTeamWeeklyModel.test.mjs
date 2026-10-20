import assert from 'node:assert/strict';
import test from 'node:test';
import {
  shouldShowTimelineRow,
  timelineActivityBucket,
} from './timelineTeamWeeklyModel.ts';

test('nasconde attività e WBS concluse senza ore', () => {
  assert.equal(shouldShowTimelineRow({
    taskStatus: 'completed',
    wbsStatus: null,
    hours: 0,
    showCompleted: false,
  }), false);
  assert.equal(shouldShowTimelineRow({
    taskStatus: 'in_progress',
    wbsStatus: 'chiuso',
    hours: 0,
    showCompleted: false,
  }), false);
});

test('mantiene visibili le concluse con ore o quando richiesto', () => {
  assert.equal(shouldShowTimelineRow({
    taskStatus: 'completed',
    wbsStatus: 'chiuso',
    hours: 0.5,
    showCompleted: false,
  }), true);
  assert.equal(shouldShowTimelineRow({
    taskStatus: 'completed',
    wbsStatus: null,
    hours: 0,
    showCompleted: true,
  }), true);
});

test('ordina prima compilate, poi pianificate, poi recenti, poi altre', () => {
  assert.equal(timelineActivityBucket(4, 0, null), 0);
  assert.equal(timelineActivityBucket(0, 3, null), 1);
  assert.equal(timelineActivityBucket(0, 0, '2026-07-20'), 2);
  assert.equal(timelineActivityBucket(0, 0, null), 3);
});
