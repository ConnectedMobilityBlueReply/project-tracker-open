import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDaysIso,
  availableDays,
  isOff,
  utilization,
  utilizationLevel,
  weekdaysOf,
} from './capacity.ts';

const fullTime = { id: 1, name: 'Piena', job_title: null, team_id: 1, weekly_capacity_days: 5 };
const partTime = { id: 2, name: 'Parziale', job_title: null, team_id: 1, weekly_capacity_days: 3 };

const off = (personId, start, end) => ({
  id: 1, person_id: personId, start_date: start, end_date: end,
  type: 'ferie', tentative: false, notes: null,
});

test('addDaysIso non slitta attraverso il cambio dell’ora legale', () => {
  assert.equal(addDaysIso('2026-03-28', 1), '2026-03-29');
  assert.equal(addDaysIso('2026-10-24', 2), '2026-10-26');
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
});

test('la settimana lavorativa è lunedì-venerdì', () => {
  assert.deepEqual(weekdaysOf('2026-08-17'), [
    '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21',
  ]);
});

test('settimana piena senza assenze: capacità uguale a weekly_capacity_days', () => {
  assert.equal(availableDays(fullTime, '2026-08-17', []), 5);
});

test('due giorni di ferie su cinque riducono la capacità in proporzione', () => {
  const timeOff = [off(1, '2026-08-17', '2026-08-18')];
  assert.equal(availableDays(fullTime, '2026-08-17', timeOff), 3);
});

test('una festività infrasettimanale conta come giorno perso', () => {
  // 2026-12-25 è venerdì; la settimana inizia lunedì 2026-12-21.
  assert.equal(availableDays(fullTime, '2026-12-21', []), 4);
});

test('Ferragosto 2026 cade di sabato e non sottrae capacità', () => {
  assert.equal(availableDays(fullTime, '2026-08-10', []), 5);
});

test('un’assenza a cavallo dei bordi conta solo per i giorni interni alla settimana', () => {
  // Assenza da venerdì 14 a martedì 18: nella settimana del 17 pesa lun+mar.
  const timeOff = [off(1, '2026-08-14', '2026-08-18')];
  assert.equal(availableDays(fullTime, '2026-08-17', timeOff), 3);
});

test('assente tutta la settimana: capacità zero e utilization null', () => {
  const timeOff = [off(1, '2026-08-17', '2026-08-21')];
  assert.equal(availableDays(fullTime, '2026-08-17', timeOff), 0);
  assert.equal(utilization(0, 0), null);
});

test('assente tutta la settimana con allocazioni: conflitto, non zero per cento', () => {
  assert.equal(utilizationLevel(2, 0), 'conflict');
  assert.equal(utilizationLevel(0, 0), 'free');
});

test('part-time con un giorno di ferie scende a 2.4 — riduzione proporzionale', () => {
  const timeOff = [off(2, '2026-08-17', '2026-08-17')];
  assert.equal(availableDays(partTime, '2026-08-17', timeOff), 2.4);
});

test('le assenze di altre persone non toccano la capacità', () => {
  const timeOff = [off(99, '2026-08-17', '2026-08-21')];
  assert.equal(availableDays(fullTime, '2026-08-17', timeOff), 5);
  assert.equal(isOff(1, '2026-08-17', timeOff), false);
  assert.equal(isOff(99, '2026-08-17', timeOff), true);
});

test('le soglie di utilizzo separano sotto, pieno e sopra', () => {
  assert.equal(utilizationLevel(0, 5), 'free');
  assert.equal(utilizationLevel(3, 5), 'under');
  assert.equal(utilizationLevel(5, 5), 'full');
  assert.equal(utilizationLevel(6, 5), 'over');
});

test('utilization è il rapporto fra allocato e disponibile', () => {
  assert.equal(utilization(2.5, 5), 0.5);
  assert.equal(utilization(6, 5), 1.2);
});

test('una settimana piena resta full anche quando la somma sfora di un ULP', () => {
  // 0.8 + 0.8 + 0.8 + 0.6 fa 3.0000000000000004, non 3: mezze e quarti di
  // giornata non sono esatti in binario.
  assert.equal(utilizationLevel(0.8 + 0.8 + 0.8 + 0.6, 3), 'full');
  assert.equal(utilizationLevel(0.4 * 6, 2.4), 'full');
});

test('una sovrallocazione vera resta over anche con la tolleranza', () => {
  assert.equal(utilizationLevel(3.5, 3), 'over');
});

test('festività e assenza nello stesso giorno si perdono una volta sola', () => {
  // 2027-01-01 è venerdì; il lunedì di quella settimana è 2026-12-28.
  const timeOff = [off(1, '2027-01-01', '2027-01-01')];
  assert.equal(availableDays(fullTime, '2026-12-28', timeOff), 4);
});
