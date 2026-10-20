import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pct, wbsSegments, lastMonths, monthlyTrack, trackDelta, trackBanner,
  progressSummary, progressBanner, notchFill, monthWeeks, timelineRows, filterDashboardProjects, watchlist,
} from './dashboardModel.ts';

test('pct: 0 se il totale è 0 o non finito, limitato a 0–100', () => {
  assert.equal(pct(1, 0), 0);
  assert.equal(pct(Number.NaN, 10), 0);
  assert.equal(pct(5, 10), 50);
  assert.equal(pct(15, 10), 100);
  assert.equal(pct(-1, 10), 0);
});

test('wbsSegments: ordine in corso, aperto, chiuso; percentuali; vuoto senza NaN', () => {
  const s = wbsSegments({ aperto: 6, in_corso: 12, chiuso: 4, total: 22, projects: 3 });
  assert.deepEqual(s.map(x => x.key), ['in_corso', 'aperto', 'chiuso']);
  assert.deepEqual(s.map(x => x.count), [12, 6, 4]);
  assert.equal(Math.round(s[0].share), 55);
  const empty = wbsSegments({ aperto: 0, in_corso: 0, chiuso: 0, total: 0, projects: 0 });
  assert.ok(empty.every(x => x.share === 0));
});

test('lastMonths: n mesi fino al corrente, a cavallo d\'anno', () => {
  assert.deepEqual(lastMonths('2026-01-15', 3), ['2025-11', '2025-12', '2026-01']);
  assert.deepEqual(lastMonths('2026-10-06', 1), ['2026-10']);
});

const rows = [
  { project_id: 1, project_name: 'A', month: '2026-09', planned_days: 10, actual_days: 4 },
  { project_id: 1, project_name: 'A', month: '2026-10', planned_days: 8, actual_days: 6 },
  { project_id: 2, project_name: 'B', month: '2026-10', planned_days: 2, actual_days: 3 },
];

test('monthlyTrack: somma per mese, filtro progetto, residuo mai negativo, mesi vuoti a zero', () => {
  const all = monthlyTrack(rows, null, ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(all.map(p => [p.month, p.planned, p.actual, p.residual]), [
    ['2026-08', 0, 0, 0], ['2026-09', 10, 4, 6], ['2026-10', 10, 9, 1],
  ]);
  const b = monthlyTrack(rows, 2, ['2026-10']);
  assert.deepEqual(b.map(p => p.residual), [0]);
  assert.equal(all[1].label, 'set');
});

test('trackDelta e trackBanner: delta sul consuntivo, non definito se mese precedente vuoto', () => {
  const all = monthlyTrack(rows, null, ['2026-09', '2026-10']);
  assert.deepEqual(trackDelta(all), { current: 9, previous: 4, deltaPct: 125 });
  assert.match(trackBanner(trackDelta(all)), /\+125%/);
  const none = trackDelta(monthlyTrack([], null, ['2026-09', '2026-10']));
  assert.equal(none.deltaPct, null);
  assert.doesNotMatch(trackBanner(none), /Infinity|NaN/);
});

test('progressSummary: avanzamento, consumo stima, punti del mese; vuoto a zero', () => {
  const projects = [
    { estimated_days: 20, actual_days: 10 },
    { estimated_days: 0, actual_days: 0 },
  ];
  const listed = [{ total_actual_days: 10, total_stima: 40 }, { total_actual_days: 0, total_stima: 0 }];
  const s = progressSummary(projects, listed, 4);
  assert.deepEqual(s, { progressPct: 50, budgetPct: 25, progressDeltaPts: 20 });
  assert.deepEqual(progressSummary([], [], 0), { progressPct: 0, budgetPct: 0, progressDeltaPts: 0 });
  assert.match(progressBanner(s), /\+20 punti/);
  assert.doesNotMatch(progressBanner(progressSummary([], [], 0)), /NaN/);
});

test('notchFill: tacche piene arrotondate e limitate', () => {
  assert.equal(notchFill(0, 30), 0);
  assert.equal(notchFill(89, 30), 27);
  assert.equal(notchFill(150, 30), 30);
});

test('monthWeeks: lunedì che coprono il mese', () => {
  const weeks = monthWeeks('2026-10-06');
  assert.equal(weeks[0].start, '2026-09-28');
  assert.equal(weeks.at(-1).start, '2026-10-26');
  assert.equal(weeks.length, 5);
});

test('timelineRows: solo progetti che toccano il mese, tagliati ai bordi, mai span negativi', () => {
  const weeks = monthWeeks('2026-10-06');
  const list = [
    { id: 1, name: 'Dentro', start_date: '2026-10-05', end_date: '2026-10-16' },
    { id: 2, name: 'Prima', start_date: '2026-08-01', end_date: '2026-09-15' },
    { id: 3, name: 'Lungo', start_date: '2026-09-01', end_date: '2026-12-31' },
    { id: 4, name: 'Senza date', start_date: null, end_date: null },
  ];
  const r = timelineRows(list, weeks);
  assert.deepEqual(r.map(x => [x.project.id, x.startIndex, x.span]), [[1, 1, 2], [3, 0, 5]]);
});

test('filterDashboardProjects: testo su nome, chip e tipi task; stato', () => {
  const list = [
    { id: 1, name: 'Portale', status: 'in lavorazione', societa: 'UNS', area: null, codice_offerta: 'OFF-1', tasks: [{ task_type: 'DEV' }] },
    { id: 2, name: 'App', status: 'da lavorare', societa: null, area: 'Digital', codice_offerta: null, tasks: [{ task_type: 'SIT' }] },
  ];
  assert.deepEqual(filterDashboardProjects(list, 'off-1', 'all').map(p => p.id), [1]);
  assert.deepEqual(filterDashboardProjects(list, 'sit', 'all').map(p => p.id), [2]);
  assert.deepEqual(filterDashboardProjects(list, '', 'da lavorare').map(p => p.id), [2]);
  assert.deepEqual(filterDashboardProjects(list, '  ', 'all').map(p => p.id), [1, 2]);
});

test('trackBanner: decimali in formato it-IT e delta zero neutro', () => {
  assert.match(trackBanner({ current: 4.5, previous: 0, deltaPct: null }), /4,5 gg/);
  assert.match(trackBanner({ current: 0, previous: 4, deltaPct: 1250 }), /\+1\.250%/);
  assert.equal(trackBanner({ current: 4, previous: 4, deltaPct: 0 }), 'Consuntivo stabile rispetto al mese precedente.');
});

test('progressBanner: ore senza stima, meno di un punto, nessun avanzamento', () => {
  const zero = { progressPct: 0, budgetPct: 0, progressDeltaPts: 0 };
  assert.equal(progressBanner(zero, { currentMonthActual: 5, estimatedDays: 0 }), 'Nessuna stima di allocazione: avanzamento non calcolabile.');
  assert.equal(progressBanner(zero, { currentMonthActual: 1, estimatedDays: 400 }), 'Meno di 1 punto di avanzamento nel mese corrente.');
  assert.equal(progressBanner(zero, { currentMonthActual: 0, estimatedDays: 400 }), 'Nessun avanzamento registrato nel mese corrente.');
});

const p = (over) => ({
  name: 'P', status: 'in lavorazione', estimated_days: 100, actual_days: 10,
  start_date: '2026-01-01', end_date: '2026-12-31', ...over,
});
const TODAY = '2026-07-02'; // ~50% dell'anno trascorso

test('watchlist: sopra stima è danger e non duplica in esaurimento né consumo', () => {
  const [item] = watchlist([p({ actual_days: 120 })], TODAY);
  assert.deepEqual(item.signals, ['overEstimate']);
  assert.equal(item.severity, 'danger');
});

test('watchlist: in esaurimento dal 90%', () => {
  assert.deepEqual(watchlist([p({ actual_days: 90 })], TODAY)[0].signals, ['nearEstimate', 'burnAhead']);
  assert.equal(watchlist([p({ actual_days: 89 })], TODAY)[0]?.signals.includes('nearEstimate') ?? false, false);
});

test('watchlist: scaduto se fine passata e non concluso', () => {
  const [item] = watchlist([p({ end_date: '2026-06-30', actual_days: 10 })], TODAY);
  assert.ok(item.signals.includes('overdue'));
  assert.equal(watchlist([p({ end_date: '2026-06-30', status: 'concluso' })], TODAY).length, 0);
});

test('watchlist: data di fine stringa vuota è assente, non scaduta', () => {
  assert.equal(watchlist([p({ end_date: '' })], TODAY).flatMap(i => i.signals).includes('overdue'), false);
});

test('watchlist: consumo più veloce del tempo oltre 15 punti', () => {
  assert.deepEqual(watchlist([p({ actual_days: 70 })], TODAY)[0].signals, ['burnAhead']);
  assert.equal(watchlist([p({ actual_days: 60 })], TODAY).length, 0);
});

test('watchlist: niente divisioni per zero', () => {
  assert.equal(watchlist([p({ estimated_days: 0, actual_days: 5 })], TODAY).length, 0);
  assert.equal(watchlist([p({ start_date: '2026-07-01', end_date: '2026-07-01', actual_days: 70 })], TODAY)
    .flatMap(i => i.signals).includes('burnAhead'), false);
  assert.equal(watchlist([p({ start_date: null, end_date: null, actual_days: 70 })], TODAY).length, 0);
});

test('watchlist: lavorato a consuntivo salta le regole sulla stima ma non la scadenza', () => {
  assert.equal(watchlist([p({ status: 'lavorato a consuntivo', actual_days: 500 })], TODAY).length, 0);
  assert.deepEqual(watchlist([p({ status: 'lavorato a consuntivo', end_date: '2026-06-01' })], TODAY)[0].signals, ['overdue']);
});

test('watchlist: ordine danger, poi warning, poi nome; date con orario accettate', () => {
  const list = watchlist([
    p({ name: 'Zeta', actual_days: 92 }),
    p({ name: 'Beta', actual_days: 130 }),
    p({ name: 'Alfa', actual_days: 95 }),
    p({ name: 'Gamma', end_date: '2026-06-30T00:00:00' }),
  ], TODAY);
  assert.deepEqual(list.map(i => i.project.name), ['Beta', 'Gamma', 'Alfa', 'Zeta']);
});
