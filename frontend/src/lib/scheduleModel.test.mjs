import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocatedDays,
  allocationsByPerson,
  EMPTY_FILTERS,
  filterSchedule,
  mondayOfIso,
  monthColumns,
  monthWeeksOf,
  netAvailableDays,
  otherTeamDays,
  projectColor,
  sortPersons,
  weekStartsBetween,
} from './scheduleModel.ts';

const person = (id, name, teamId = 1, capacity = 5) => ({
  id, name, job_title: null, team_id: teamId, weekly_capacity_days: capacity,
});

const allocation = (id, personId, projectId, weekStart, manDays) => ({
  id,
  task_allocation_id: id,
  task_id: id,
  task_type: 'GEN',
  project_id: projectId,
  project_name: `Progetto ${projectId}`,
  basket: null,
  color: null,
  person_id: personId,
  week_start: weekStart,
  man_days: manDays,
  tentative: false,
});

const data = {
  persons: [person(1, 'Anna'), person(2, 'Bruno', 2), person(3, 'Carla')],
  allocations: [
    allocation(10, 1, 100, '2026-08-03', 2),
    allocation(11, 1, 200, '2026-08-10', 3),
    allocation(12, 2, 100, '2026-08-03', 5),
  ],
  time_off: [],
};

const weeks = ['2026-08-03', '2026-08-10', '2026-08-17'];

test('mondayOfIso aggancia al lunedì e non sposta un lunedì', () => {
  // Arrange: la settimana del 17-23 agosto 2026, lunedì 2026-08-17.
  const monday = '2026-08-17';
  const wednesday = '2026-08-19';
  const sunday = '2026-08-23';

  // Act
  const fromMonday = mondayOfIso(monday);
  const fromWednesday = mondayOfIso(wednesday);
  const fromSunday = mondayOfIso(sunday);

  // Assert
  assert.equal(fromMonday, monday, 'idempotente su un lunedì');
  assert.equal(fromWednesday, monday);
  assert.equal(fromSunday, monday, 'la domenica chiude la settimana, non ne apre una');
});

test('weekStartsBetween produce i lunedì con to escluso', () => {
  assert.deepEqual(weekStartsBetween('2026-08-03', '2026-08-24'), [
    '2026-08-03', '2026-08-10', '2026-08-17',
  ]);
});

test('weekStartsBetween è vuota quando to non supera from', () => {
  assert.deepEqual(weekStartsBetween('2026-08-10', '2026-08-10'), []);
});

test('weekStartsBetween aggancia un from infrasettimanale al suo lunedì', () => {
  // Il range può arrivare da un URL condiviso: /schedule?from=2026-08-20 non passa
  // da mondayOf(). Un elemento non-lunedì falserebbe ogni capacità della griglia.
  assert.deepEqual(weekStartsBetween('2026-08-20', '2026-09-02'), [
    '2026-08-17', '2026-08-24', '2026-08-31',   // 2026-08-20 è giovedì
  ]);
  assert.deepEqual(weekStartsBetween('2026-08-16', '2026-08-31'), [
    '2026-08-10', '2026-08-17', '2026-08-24',   // domenica: settimana precedente
  ]);
  assert.deepEqual(weekStartsBetween('2026-12-30', '2027-01-05'), [
    '2026-12-28', '2027-01-04',                 // mercoledì, a cavallo dell'anno
  ]);
});

test('weekStartsBetween emette solo lunedì, qualunque sia il from', () => {
  for (const from of ['2026-08-16', '2026-08-17', '2026-08-20', '2026-12-30', '2027-03-06']) {
    for (const week of weekStartsBetween(from, '2027-06-01')) {
      const [y, m, d] = week.split('-').map(Number);
      assert.equal(new Date(Date.UTC(y, m - 1, d)).getUTCDay(), 1, `${week} da ${from} non è lunedì`);
    }
  }
});

test('monthColumns raggruppa per il mese del lunedì', () => {
  // 2026-08-31 è lunedì: la settimana a cavallo appartiene ad agosto.
  assert.deepEqual(monthColumns(['2026-08-24', '2026-08-31', '2026-09-07']), [
    { key: '2026-08', weeks: ['2026-08-24', '2026-08-31'] },
    { key: '2026-09', weeks: ['2026-09-07'] },
  ]);
});

test('allocationsByPerson indicizza per persona e omette chi non ha nulla', () => {
  const byPerson = allocationsByPerson(data.allocations);
  assert.equal(byPerson.get(1).length, 2);
  assert.equal(byPerson.get(2).length, 1);
  assert.equal(byPerson.has(3), false);
});

test('allocatedDays somma solo le settimane richieste', () => {
  assert.equal(allocatedDays(data.allocations, 1, weeks), 5);
  assert.equal(allocatedDays(data.allocations, 1, ['2026-08-03']), 2);
  assert.equal(allocatedDays(data.allocations, 3, weeks), 0);
});

test('senza filtri il risultato è invariato e include chi non ha allocazioni', () => {
  const result = filterSchedule(data, EMPTY_FILTERS, weeks);
  assert.deepEqual(result.persons.map(p => p.name), ['Anna', 'Bruno', 'Carla']);
  assert.equal(result.allocations.length, 3);
});

test('il filtro per progetto restringe allocazioni e persone', () => {
  const result = filterSchedule(data, { ...EMPTY_FILTERS, projectIds: [200] }, weeks);
  assert.deepEqual(result.allocations.map(a => a.id), [11]);
  assert.deepEqual(result.persons.map(p => p.name), ['Anna']);
});

test('il filtro per team seleziona le persone', () => {
  const result = filterSchedule(data, { ...EMPTY_FILTERS, teamIds: [2] }, weeks);
  assert.deepEqual(result.persons.map(p => p.name), ['Bruno']);
  assert.deepEqual(result.allocations.map(a => a.id), [12]);
});

test('i filtri combinati sono in AND', () => {
  const result = filterSchedule(
    data, { ...EMPTY_FILTERS, projectIds: [100], teamIds: [1] }, weeks);
  assert.deepEqual(result.persons.map(p => p.name), ['Anna']);
  assert.deepEqual(result.allocations.map(a => a.id), [10]);
});

test('hideEmpty toglie le persone senza allocazioni nel range', () => {
  const result = filterSchedule(data, { ...EMPTY_FILTERS, hideEmpty: true }, weeks);
  assert.deepEqual(result.persons.map(p => p.name), ['Anna', 'Bruno']);
});

test('hideEmpty ignora le allocazioni fuori dalla finestra weeks', () => {
  // 2026-09-07 è fuori da `weeks` (2026-08-03, 2026-08-10, 2026-08-17): un lavoro
  // lì non deve bastare a far apparire la persona come "occupata" in questa griglia.
  const localData = {
    persons: [person(9, 'Delia')],
    allocations: [allocation(20, 9, 100, '2026-09-07', 3)],
    time_off: [],
  };
  const result = filterSchedule(localData, { ...EMPTY_FILTERS, hideEmpty: true }, weeks);
  assert.deepEqual(result.persons, []);
});

test('il filtro per persona non nasconde chi è a zero allocazioni', () => {
  const result = filterSchedule(data, { ...EMPTY_FILTERS, personIds: [3] }, weeks);
  assert.deepEqual(result.persons.map(p => p.name), ['Carla']);
  assert.deepEqual(result.allocations, []);
});

const unplanned = (taskAllocationId, personId, projectId) => ({
  task_allocation_id: taskAllocationId,
  task_id: taskAllocationId,
  task_type: 'GEN',
  project_id: projectId,
  project_name: `Progetto ${projectId}`,
  color: null,
  person_id: personId,
});

test('il filtro per progetto tiene chi è assegnato al progetto anche senza ore', () => {
  // Carla è assegnata al progetto 300 ma non ha ancora settimane pianificate.
  const localData = { ...data, unplanned_assignments: [unplanned(900, 3, 300)] };
  const result = filterSchedule(localData, { ...EMPTY_FILTERS, projectIds: [300] }, weeks);
  assert.deepEqual(result.persons.map(p => p.name), ['Carla']);
  assert.deepEqual(result.unplanned.map(a => a.task_allocation_id), [900]);
});

test('le assegnazioni senza ore seguono filtro progetto e persone visibili', () => {
  const localData = {
    ...data,
    unplanned_assignments: [unplanned(900, 3, 300), unplanned(901, 1, 100), unplanned(902, 3, 100)],
  };
  assert.deepEqual(
    filterSchedule(localData, EMPTY_FILTERS, weeks).unplanned.map(a => a.task_allocation_id),
    [900, 901, 902]);
  assert.deepEqual(
    filterSchedule(localData, { ...EMPTY_FILTERS, personIds: [3] }, weeks).unplanned.map(a => a.task_allocation_id),
    [900, 902]);
  assert.deepEqual(
    filterSchedule(localData, { ...EMPTY_FILTERS, projectIds: [100] }, weeks).unplanned.map(a => a.task_allocation_id),
    [901, 902]);
});

test('senza unplanned_assignments (backend vecchio) il risultato è vuoto, non un errore', () => {
  assert.deepEqual(filterSchedule(data, EMPTY_FILTERS, weeks).unplanned, []);
});

test('sort per nome, nei due versi', () => {
  const options = { key: 'name', descending: false, allocations: data.allocations, timeOff: [], weeks };
  assert.deepEqual(sortPersons(data.persons, options).map(p => p.name), ['Anna', 'Bruno', 'Carla']);
  assert.deepEqual(
    sortPersons(data.persons, { ...options, descending: true }).map(p => p.name),
    ['Carla', 'Bruno', 'Anna'],
  );
});

test('sort per non-allocato mette per prima chi è libero, nei due versi', () => {
  const options = { key: 'unscheduled', descending: false, allocations: data.allocations, timeOff: [], weeks };
  assert.equal(sortPersons(data.persons, options)[0].name, 'Carla');
  // Anna e Bruno sono a pari merito (5 giorni ciascuno): il pareggio per nome
  // resta alfabetico anche invertendo il verso, non si ribalta con `descending`.
  assert.deepEqual(
    sortPersons(data.persons, { ...options, descending: true }).map(p => p.name),
    ['Anna', 'Bruno', 'Carla'],
  );
});

test('sort per utilizzo ordina sul rapporto, non sui giorni assoluti, nei due versi', () => {
  const options = { key: 'utilization', descending: true, allocations: data.allocations, timeOff: [], weeks };
  // Bruno: 5 giorni su 15 disponibili. Anna: 5 su 15. Carla: 0.
  const descSorted = sortPersons(data.persons, options);
  assert.equal(descSorted[descSorted.length - 1].name, 'Carla');
  // Stesso pareggio per nome anche in ascendente.
  assert.deepEqual(
    sortPersons(data.persons, { ...options, descending: false }).map(p => p.name),
    ['Carla', 'Anna', 'Bruno'],
  );
});

test('il pareggio per nome regge anche quando le somme derivano di un ULP', () => {
  // 0.2 + 0.2 + 0.2 fa 0.6000000000000001, non 0.6: stesso totale reale, bit diversi.
  const persons = [person(2, 'Zeta'), person(1, 'Anna')];
  const allocations = [
    allocation(1, 1, 100, '2026-08-03', 0.2),
    allocation(2, 1, 100, '2026-08-10', 0.2),
    allocation(3, 1, 100, '2026-08-17', 0.2),
    allocation(4, 2, 100, '2026-08-03', 0.6),
  ];
  for (const key of ['unscheduled', 'utilization']) {
    assert.deepEqual(
      sortPersons(persons, { key, descending: false, allocations, timeOff: [], weeks })
        .map(p => p.name),
      ['Anna', 'Zeta'],
      `chiave ${key}`,
    );
  }
});

test('chi è in ferie senza lavoro è libero, non massimamente sovraccarico', () => {
  const persons = [person(10, 'InFerie'), person(20, 'Sovraccarico')];
  const timeOff = [{
    id: 1, person_id: 10, start_date: '2026-08-03', end_date: '2026-08-07',
    type: 'ferie', tentative: false, notes: null,
  }];
  const allocations = [allocation(1, 20, 100, '2026-08-03', 7)]; // 7 su 5 = 140%
  const sorted = sortPersons(persons, {
    key: 'utilization', descending: true, allocations, timeOff, weeks: ['2026-08-03'],
  });
  assert.deepEqual(sorted.map(p => p.name), ['Sovraccarico', 'InFerie']);
});

test('sortPersons non muta l’array ricevuto', () => {
  const original = [...data.persons];
  sortPersons(data.persons, {
    key: 'name', descending: true, allocations: data.allocations, timeOff: [], weeks,
  });
  assert.deepEqual(data.persons, original);
});

test('projectColor preferisce il colore esplicito e altrimenti è stabile', () => {
  assert.equal(projectColor(7, '#123456'), '#123456');
  assert.equal(projectColor(7, null), projectColor(7, null));
  assert.notEqual(projectColor(7, null), '');
});

test('monthWeeksOf copre il mese con settimane intere, incluse quelle a cavallo', () => {
  // Arrange — agosto 2026 comincia di sabato: la prima settimana parte a luglio.
  // Act & Assert
  assert.deepEqual(monthWeeksOf('2026-08-18'), [
    '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31',
  ]);
  // Il giorno dentro il mese non cambia il risultato: conta il mese, non il giorno.
  assert.deepEqual(monthWeeksOf('2026-08-01'), monthWeeksOf('2026-08-31'));
  // Febbraio 2026 comincia di domenica: la prima settimana parte a gennaio.
  assert.deepEqual(monthWeeksOf('2026-02-10'), [
    '2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
  ]);
});

test('carico di altri team: somma per persona nelle settimane della colonna', () => {
  const load = [
    { person_id: 1, week_start: '2026-09-07', man_days: 1.5 },
    { person_id: 1, week_start: '2026-09-14', man_days: 2 },
    { person_id: 2, week_start: '2026-09-07', man_days: 4 },
  ];
  assert.equal(otherTeamDays(load, 1, ['2026-09-07']), 1.5);
  assert.equal(otherTeamDays(load, 1, ['2026-09-07', '2026-09-14']), 3.5);
  assert.equal(otherTeamDays(load, 3, ['2026-09-07']), 0);
  assert.equal(otherTeamDays([], 1, ['2026-09-07']), 0);
});

test('netAvailableDays sottrae il carico di altri team senza scendere sotto zero', () => {
  const p = person(1, 'Anna');
  const load = [{ person_id: 1, week_start: '2026-08-03', man_days: 2 }];
  assert.equal(netAvailableDays(p, ['2026-08-03'], [], load), 3);
  assert.equal(netAvailableDays(p, ['2026-08-03'], [], [{ ...load[0], man_days: 9 }]), 0);
  assert.equal(netAvailableDays(p, ['2026-08-03'], []), 5);
});

test('il sort per utilizzo tiene conto del carico in altri team', () => {
  const persons = [person(1, 'Anna'), person(2, 'Bruno')];
  const allocations = [
    allocation(1, 1, 100, '2026-08-03', 2),
    allocation(2, 2, 100, '2026-08-03', 2),
  ];
  // Bruno ha 3 giorni già presi altrove: 2 su 2 disponibili contro 2 su 5 di Anna.
  const otherTeamLoad = [{ person_id: 2, week_start: '2026-08-03', man_days: 3 }];
  const options = { key: 'utilization', descending: true, allocations, timeOff: [], weeks: ['2026-08-03'] };
  assert.deepEqual(sortPersons(persons, options).map(p => p.name), ['Anna', 'Bruno']);
  assert.deepEqual(sortPersons(persons, { ...options, otherTeamLoad }).map(p => p.name), ['Bruno', 'Anna']);
});
