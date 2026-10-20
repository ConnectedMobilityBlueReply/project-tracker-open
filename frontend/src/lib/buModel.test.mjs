import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocatedUntilLabel,
  filterByEngagement,
  formatDays,
  formatIsoDate,
  formatIsoShort,
  formatPct,
  groupByTeam,
  mondayOf,
  projectKindLabel,
  projectTotal,
  segmentPercents,
  summarize,
  weekHasTimeOff,
  weekLevel,
} from './buModel.ts';

const week = (weekStart, tm = 0, turnkey = 0, other = 0) => ({
  week_start: weekStart, tm_days: tm, turnkey_days: turnkey, other_days: other,
});

const person = (overrides = {}) => ({
  person_id: 1, name: 'Anna', job_title: null, weekly_capacity_days: 5, pending: false,
  teams: [{ id: 1, name: 'A' }], allocated_until: null, time_off: [],
  weeks: [week('2026-09-07'), week('2026-09-14'), week('2026-09-21'), week('2026-09-28')],
  ...overrides,
});

test('mondayOf: lunedì della settimana, anche da domenica', () => {
  assert.equal(mondayOf(new Date(2026, 8, 10)), '2026-09-07');
  assert.equal(mondayOf(new Date(2026, 8, 13)), '2026-09-07');
  assert.equal(mondayOf(new Date(2026, 8, 7)), '2026-09-07');
});

test('summarize: i giorni scoperti si contano per settimana, la sovrallocazione non compensa', () => {
  const anna = person({
    weeks: [week('2026-09-07', 2, 1), week('2026-09-14', 0, 5), week('2026-09-21', 6), week('2026-09-28')],
    time_off: [{ start_date: '2026-09-08', end_date: '2026-09-09' }],
  });
  const summary = summarize(anna);

  assert.equal(summary.tmDays, 8);
  assert.equal(summary.turnkeyDays, 6);
  assert.equal(summary.otherDays, 0);
  assert.equal(summary.allocatedDays, 14);
  assert.equal(summary.availableDays, 18); // 3 (2 giorni di assenza) + 5 + 5 + 5
  assert.equal(summary.uncoveredDays, 5);  // solo l'ultima settimana: 5 - 0
  assert.ok(Math.abs(summary.utilization - 14 / 18) < 1e-9);
});

test('persona senza capacità ma con giorni allocati: % nulla, nessuno scoperto, cella in conflitto', () => {
  const nobody = person({ weekly_capacity_days: 0, weeks: [week('2026-09-07', 2)] });
  const summary = summarize(nobody);

  assert.equal(summary.availableDays, 0);
  assert.equal(summary.uncoveredDays, 0);
  assert.equal(summary.utilization, null);
  assert.equal(weekLevel(nobody, nobody.weeks[0]), 'conflict');
  assert.equal(formatPct(summary.utilization), '—');
});

test('weekLevel: libera, parziale, piena, sovrallocata', () => {
  const anna = person();
  assert.equal(weekLevel(anna, week('2026-09-07')), 'free');
  assert.equal(weekLevel(anna, week('2026-09-07', 2)), 'under');
  assert.equal(weekLevel(anna, week('2026-09-07', 3, 2)), 'full');
  assert.equal(weekLevel(anna, week('2026-09-07', 6)), 'over');
});

test('weekHasTimeOff: assenza dentro la settimana, a cavallo di due settimane, ai bordi lun-dom', () => {
  const inside = person({ time_off: [{ start_date: '2026-09-09', end_date: '2026-09-10' }] });
  assert.equal(weekHasTimeOff(inside, '2026-09-07'), true);
  assert.equal(weekHasTimeOff(inside, '2026-09-14'), false);

  const spanning = person({ time_off: [{ start_date: '2026-09-11', end_date: '2026-09-15' }] });
  assert.equal(weekHasTimeOff(spanning, '2026-09-07'), true);
  assert.equal(weekHasTimeOff(spanning, '2026-09-14'), true);
  assert.equal(weekHasTimeOff(spanning, '2026-09-21'), false);

  const endingSundayBefore = person({ time_off: [{ start_date: '2026-08-31', end_date: '2026-09-06' }] });
  assert.equal(weekHasTimeOff(endingSundayBefore, '2026-09-07'), false);

  const startingMondayAfter = person({ time_off: [{ start_date: '2026-09-14', end_date: '2026-09-18' }] });
  assert.equal(weekHasTimeOff(startingMondayAfter, '2026-09-07'), false);
  assert.equal(weekHasTimeOff(startingMondayAfter, '2026-09-14'), true);
});

test('segmentPercents: la barra non supera il 100% e si scala sul maggiore tra allocato e disponibile', () => {
  const half = segmentPercents(week('2026-09-07', 2, 1, 0), 6);
  assert.deepEqual(half, { tm: (2 / 6) * 100, turnkey: (1 / 6) * 100, other: 0 });

  const over = segmentPercents(week('2026-09-07', 6, 2, 2), 5);
  assert.equal(over.tm + over.turnkey + over.other, 100);

  assert.deepEqual(segmentPercents(week('2026-09-07'), 0), { tm: 0, turnkey: 0, other: 0 });
});

test('filterByEngagement: solo le persone con almeno un giorno del tipo scelto', () => {
  const onlyTm = person({ person_id: 1, weeks: [week('2026-09-07', 2)] });
  const onlyTurnkey = person({ person_id: 2, weeks: [week('2026-09-07', 0, 3)] });
  const onlyOther = person({ person_id: 3, weeks: [week('2026-09-07', 0, 0, 1)] });
  const all = [onlyTm, onlyTurnkey, onlyOther];

  assert.deepEqual(filterByEngagement(all, 'all').map(p => p.person_id), [1, 2, 3]);
  assert.deepEqual(filterByEngagement(all, 'tm').map(p => p.person_id), [1]);
  assert.deepEqual(filterByEngagement(all, 'turnkey').map(p => p.person_id), [2]);
});

test('allocatedUntilLabel: nessuna, in orizzonte, oltre', () => {
  assert.equal(allocatedUntilLabel(null, '2026-09-07', 4), 'Nessuna allocazione');
  assert.equal(allocatedUntilLabel('2026-09-21', '2026-09-07', 4), 'sett. del 21/09/2026');
  assert.equal(allocatedUntilLabel('2026-09-28', '2026-09-07', 4), 'sett. del 28/09/2026');
  // 2026-10-05 è la prima settimana fuori dalle 4 dell'orizzonte.
  assert.equal(allocatedUntilLabel('2026-10-05', '2026-09-07', 4), 'oltre 4 sett.');
  assert.equal(allocatedUntilLabel('2026-12-14', '2026-09-07', 4), 'oltre 4 sett.');
});

const project = (overrides = {}) => ({
  project_id: 1, project_name: 'P', team_id: 1, team_name: 'A', billing_type: 'turnkey',
  is_virtual: false, color: null, tentative: false, parent_project_id: null, parent_project_name: null,
  weeks: [{ week_start: '2026-09-07', man_days: 2 }, { week_start: '2026-09-14', man_days: 1.5 }],
  ...overrides,
});

test('projectKindLabel: virtuale, T&M, Turn Key', () => {
  assert.equal(projectKindLabel(project({ is_virtual: true })), 'Altro');
  assert.equal(projectKindLabel(project({ billing_type: 'tm' })), 'T&M');
  assert.equal(projectKindLabel(project()), 'Turn Key');
});

test('projectTotal e groupByTeam: somma dei giorni e raggruppamento nell’ordine di arrivo', () => {
  assert.equal(projectTotal(project()), 3.5);

  const groups = groupByTeam([
    project({ project_id: 1, team_id: 1, team_name: 'A' }),
    project({ project_id: 2, team_id: 1, team_name: 'A' }),
    project({ project_id: 3, team_id: 2, team_name: 'B' }),
  ]);
  assert.deepEqual(groups.map(group => [group.team_id, group.projects.map(p => p.project_id)]), [[1, [1, 2]], [2, [3]]]);
  assert.deepEqual(groupByTeam([]), []);
});

test('formattazione italiana di giorni, percentuali e date', () => {
  assert.equal(formatDays(1.5), '1,5');
  assert.equal(formatPct(0.756), '76%');
  assert.equal(formatIsoDate('2026-09-07'), '07/09/2026');
  assert.equal(formatIsoShort('2026-09-07'), '07/09');
});
