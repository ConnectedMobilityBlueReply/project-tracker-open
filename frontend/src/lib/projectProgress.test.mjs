import assert from 'node:assert/strict';
import test from 'node:test';
import { completionPct, sidebarProjects, signalLevel, SIDEBAR_PROJECT_LIMIT } from './projectProgress.ts';

const project = (id, name, status, est, act, isVirtual = 0) => ({
  id, name, status, is_virtual: isVirtual, created_at: '2026-01-01',
  total_estimated_days: est, total_actual_days: act,
});

test('completionPct: 0 senza stima, arrotondato, oltre 100 se sforato', () => {
  assert.equal(completionPct({ total_estimated_days: 0, total_actual_days: 5 }), 0);
  assert.equal(completionPct({ total_estimated_days: undefined, total_actual_days: 5 }), 0);
  assert.equal(completionPct({ total_estimated_days: 3, total_actual_days: 1 }), 33);
  assert.equal(completionPct({ total_estimated_days: 10, total_actual_days: 25 }), 250);
});

test('completionPct: valori non finiti o negativi danno 0', () => {
  assert.equal(completionPct({ total_estimated_days: 10, total_actual_days: Number.NaN }), 0);
  assert.equal(completionPct({ total_estimated_days: 10, total_actual_days: -2 }), 0);
  assert.equal(completionPct({ total_estimated_days: -10, total_actual_days: 2 }), 0);
});

test('sidebarProjects: vuoto resta vuoto', () => {
  assert.deepEqual(sidebarProjects([]), []);
});

test('sidebarProjects: solo reali in lavorazione, ordinati per nome, limitati', () => {
  const list = [
    project(1, 'Zeta', 'in lavorazione', 10, 5),
    project(2, 'Alfa', 'in lavorazione', 10, 10),
    project(3, 'Beta', 'concluso', 10, 10),
    project(4, 'Ferie/Permesso', 'in lavorazione', 0, 0, 1),
  ];
  assert.deepEqual(sidebarProjects(list), [
    { id: 2, name: 'Alfa', icon: null, pct: 100 },
    { id: 1, name: 'Zeta', icon: null, pct: 50 },
  ]);
  const many = Array.from({ length: 9 }, (_, i) => project(i + 10, `P${i}`, 'in lavorazione', 1, 0));
  assert.equal(sidebarProjects(many).length, SIDEBAR_PROJECT_LIMIT);
  assert.equal(sidebarProjects(many, 2).length, 2);
});

test('sidebarProjects: mantiene la chiave icona del progetto', () => {
  const withIcon = { ...project(5, 'Jira', 'in lavorazione', 10, 10), icon: 'jira' };
  assert.deepEqual(sidebarProjects([withIcon]), [
    { id: 5, name: 'Jira', icon: 'jira', pct: 100 },
  ]);
});

test('signalLevel: quattro tacche, 0 a zero, mai oltre 4, NaN a 0', () => {
  assert.equal(signalLevel(0), 0);
  assert.equal(signalLevel(1), 1);
  assert.equal(signalLevel(50), 2);
  assert.equal(signalLevel(76), 4);
  assert.equal(signalLevel(250), 4);
  assert.equal(signalLevel(Number.NaN), 0);
});
