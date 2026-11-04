import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dashboardCounts,
  formatExcessDays,
  freeEntries,
  investmentByPerson,
  overallocatedEntries,
  uncoveredEntries,
  validatePeriod,
  yearPeriod,
} from './buDashboardModel.ts';

const WEEKS = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'];

const weeksWith = allocated => WEEKS.map((weekStart, index) => ({
  week_start: weekStart, tm_days: allocated[index], turnkey_days: 0, other_days: 0,
}));

const person = (overrides = {}) => ({
  person_id: 1, name: 'Anna', job_title: null, weekly_capacity_days: 5, pending: false,
  teams: [{ id: 1, name: 'A' }], allocated_until: null,
  weeks: weeksWith([0, 0, 0, 0]), time_off: [], ...overrides,
});

const investmentRow = overrides => ({
  person_id: 1, person_name: 'Anna', project_id: 10, project_name: 'Progetto', team_id: 1, team_name: 'A',
  done_days_lifetime: 0, todo_days_lifetime: 0, done_days_period: 0, todo_days_period: 0, ...overrides,
});

test('freeEntries lists a person with partial free capacity per week', () => {
  // Arrange
  const people = [person({ weeks: weeksWith([5, 3, 0, 5]) })];

  // Act
  const [entry] = freeEntries(people);

  // Assert
  assert.deepEqual(entry.weeks.map(week => week.free_days), [0, 2, 5, 0]);
  assert.equal(entry.total_free_days, 7);
});

test('freeEntries omits fully allocated people and sorts by total free days descending, then name', () => {
  const people = [
    person({ person_id: 1, name: 'Carla', weeks: weeksWith([3, 3, 3, 3]) }),
    person({ person_id: 2, name: 'Bruno', weeks: weeksWith([0, 0, 0, 0]) }),
    person({ person_id: 3, name: 'Aldo', weeks: weeksWith([0, 0, 0, 0]) }),
    person({ person_id: 4, name: 'Dario', weeks: weeksWith([5, 5, 5, 5]) }),
  ];

  const result = freeEntries(people);

  assert.deepEqual(result.map(entry => entry.person.name), ['Aldo', 'Bruno', 'Carla']);
});

test('freeEntries treats a week fully off as zero free days', () => {
  const people = [person({ time_off: [{ start_date: '2026-11-02', end_date: '2026-11-08' }] })];

  const [entry] = freeEntries(people);

  assert.deepEqual(entry.weeks.map(week => week.free_days), [5, 0, 5, 5]);
  assert.equal(entry.total_free_days, 15);
});

test('freeEntries never lists a person with zero capacity', () => {
  assert.deepEqual(freeEntries([person({ weekly_capacity_days: 0 })]), []);
});

test('overallocatedEntries reports the worst week and excess', () => {
  const [entry] = overallocatedEntries([person({ weeks: weeksWith([6, 5, 7, 5]) })]);

  assert.equal(entry.worst_week, '2026-11-09');
  assert.equal(entry.excess_days, 2);
});

test('overallocatedEntries ignores exact capacity and float noise', () => {
  // 0.1 + 0.2 === 0.30000000000000004, mentre la capacità è 0.3
  const people = [person({ weekly_capacity_days: 0.3, weeks: weeksWith([0.1 + 0.2, 0.1 + 0.2, 0.1 + 0.2, 0.1 + 0.2]) })];

  assert.deepEqual(overallocatedEntries(people), []);
});

test('overallocatedEntries flags excess above epsilon even when it rounds to zero', () => {
  const [entry] = overallocatedEntries([person({ weeks: weeksWith([5.004, 0, 0, 0]) })]);

  assert.equal(entry.worst_week, '2026-10-26');
  assert.equal(entry.excess_days, 0);
});

test('overallocatedEntries counts work for a person with zero weekly capacity', () => {
  const people = [person({ weekly_capacity_days: 0, weeks: weeksWith([2, 0, 0, 0]) })];

  const [entry] = overallocatedEntries(people);

  assert.equal(entry.excess_days, 2);
  assert.deepEqual(freeEntries(people), []);
});

test('overallocatedEntries counts work on a week with no capacity as over', () => {
  const people = [person({
    time_off: [{ start_date: '2026-10-26', end_date: '2026-11-01' }],
    weeks: weeksWith([1, 0, 0, 0]),
  })];

  const [entry] = overallocatedEntries(people);

  assert.equal(entry.worst_week, '2026-10-26');
  assert.equal(entry.excess_days, 1);
});

test('uncoveredEntries lists people working now whose allocation ends before the window ends', () => {
  const people = [
    person({ person_id: 1, name: 'Anna', allocated_until: '2026-11-02', weeks: weeksWith([3, 2, 0, 0]) }),
    person({ person_id: 2, name: 'Bruno', allocated_until: '2026-11-16', weeks: weeksWith([3, 3, 3, 3]) }),
    person({ person_id: 3, name: 'Carlo', allocated_until: null, weeks: weeksWith([3, 0, 0, 0]) }),
    person({ person_id: 4, name: 'Dario', allocated_until: '2026-11-09', weeks: weeksWith([0, 2, 0, 0]) }),
  ];

  const result = uncoveredEntries(people);

  assert.deepEqual(result.map(entry => [entry.person.name, entry.allocated_until]), [['Anna', '2026-11-02']]);
});

test('investmentByPerson sums lifetime and period days across projects and computes progress', () => {
  const rows = [
    investmentRow({ person_id: 2, person_name: 'Bruno', project_id: 20, done_days_lifetime: 0, todo_days_lifetime: 0 }),
    investmentRow({ person_id: 1, person_name: 'Anna', project_id: 10, done_days_lifetime: 3, todo_days_lifetime: 1, done_days_period: 2, todo_days_period: 1 }),
    investmentRow({ person_id: 1, person_name: 'Anna', project_id: 11, done_days_lifetime: 2, todo_days_lifetime: 3, done_days_period: 1, todo_days_period: 2 }),
  ];

  const result = investmentByPerson(rows);

  assert.deepEqual(result.map(entry => entry.person_name), ['Anna', 'Bruno']);
  const [anna, bruno] = result;
  assert.equal(anna.done_lifetime, 5);
  assert.equal(anna.todo_lifetime, 4);
  assert.equal(anna.done_period, 3);
  assert.equal(anna.todo_period, 3);
  assert.equal(anna.progress, 5 / 9);
  assert.equal(anna.projects.length, 2);
  assert.equal(bruno.progress, null);
});

test('dashboardCounts counts people per list and sums todo days over lifetime', () => {
  const free = [
    { person: person(), weeks: [], total_free_days: 3 },
    { person: person({ person_id: 2 }), weeks: [], total_free_days: 1 },
  ];
  const over = [{ person: person(), worst_week: '2026-11-09', excess_days: 2 }];
  const uncovered = [
    { person: person(), allocated_until: '2026-11-02' },
    { person: person({ person_id: 3 }), allocated_until: '2026-11-09' },
  ];
  const investment = [
    investmentRow({ todo_days_lifetime: 4.5 }),
    investmentRow({ project_id: 11, todo_days_lifetime: 2 }),
  ];

  assert.deepEqual(dashboardCounts(free, over, uncovered, investment), {
    free: 2, over: 1, uncovered: 2, investmentTodoDays: 6.5,
  });
});

test('yearPeriod returns the first and last day of the local year', () => {
  assert.deepEqual(yearPeriod(new Date(2026, 5, 15)), { from: '2026-01-01', to: '2026-12-31' });
});

test('formatExcessDays shows excess below the first decimal as "<0,01 gg"', () => {
  assert.equal(formatExcessDays(0), '<0,01 gg');
  assert.equal(formatExcessDays(0.004), '<0,01 gg');
});

test('formatExcessDays rounds to two decimals and prefixes the sign', () => {
  assert.equal(formatExcessDays(0.005), '+0,01 gg');
  assert.equal(formatExcessDays(1.5), '+1,5 gg');
});

test('validatePeriod accepts a period inside the limit', () => {
  assert.equal(validatePeriod('2026-01-01', '2026-12-31'), null);
});

test('validatePeriod accepts a single-day period', () => {
  assert.equal(validatePeriod('2026-03-10', '2026-03-10'), null);
});

test('validatePeriod rejects an empty date', () => {
  assert.equal(validatePeriod('', '2026-12-31'), 'Seleziona entrambe le date.');
  assert.equal(validatePeriod('2026-01-01', ''), 'Seleziona entrambe le date.');
});

test('validatePeriod rejects a reversed period', () => {
  assert.equal(validatePeriod('2026-06-02', '2026-06-01'), 'La data di inizio deve precedere la data di fine.');
});

test('validatePeriod accepts exactly 366 days inclusive across a leap year', () => {
  assert.equal(validatePeriod('2028-01-01', '2028-12-31'), null);
});

test('validatePeriod rejects 367 days inclusive across a leap year', () => {
  assert.equal(validatePeriod('2028-01-01', '2029-01-01'), 'Il periodo non può superare 366 giorni.');
});

test('validatePeriod accepts exactly 366 days inclusive in a common year', () => {
  assert.equal(validatePeriod('2026-01-01', '2027-01-01'), null);
});

test('validatePeriod rejects 367 days inclusive in a common year', () => {
  assert.equal(validatePeriod('2026-01-01', '2027-01-02'), 'Il periodo non può superare 366 giorni.');
});

test('validatePeriod accepts the first and last supported years', () => {
  assert.equal(validatePeriod('2000-01-01', '2000-01-01'), null);
  assert.equal(validatePeriod('2100-12-31', '2100-12-31'), null);
});

test('validatePeriod rejects a year before 2000 as invalid', () => {
  assert.equal(validatePeriod('1999-12-31', '2000-01-01'), 'Data non valida.');
});

test('validatePeriod rejects a year after 2100 as invalid', () => {
  assert.equal(validatePeriod('2101-01-01', '2101-01-01'), 'Data non valida.');
});

test('validatePeriod rejects a two-digit-looking year as invalid', () => {
  assert.equal(validatePeriod('0002-01-01', '0002-01-01'), 'Data non valida.');
});

test('validatePeriod rejects a calendar date that does not exist', () => {
  assert.equal(validatePeriod('2026-02-30', '2026-03-01'), 'Data non valida.');
});
