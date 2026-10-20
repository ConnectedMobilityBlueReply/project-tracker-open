import assert from 'node:assert/strict';
import test from 'node:test';
import {
  barGeometry, centerScrollLeft, currentWeekIndex, isoWeekNumber, monthSpans, shiftMonthKey, SIDEBAR_WIDTH,
  fillWeekWidth, weeksOfMonth, weekEdges, uniformWeekEdges, MIN_MONTH_WIDTH, clampMonthWidth,
} from './timelineGeometry.ts';
import { weeksInRange } from './consuntivazioneRange.ts';

test('monthSpans raggruppa per mese del lunedì, anche a cavallo d anno', () => {
  // Arrange
  const weeks = ['2025-12-22', '2025-12-29', '2026-01-05', '2026-01-12'];

  // Act
  const spans = monthSpans(weeks);

  // Assert
  assert.deepEqual(spans, [
    { key: '2025-12', label: 'dic 2025', weekCount: 2 },
    { key: '2026-01', label: 'gen 2026', weekCount: 2 },
  ]);
});

test('monthSpans copre tutte le settimane dell anno senza perderne', () => {
  const weeks = weeksInRange('2026-01-01', '2026-12-31');
  const total = monthSpans(weeks).reduce((sum, span) => sum + span.weekCount, 0);
  assert.equal(total, weeks.length);
});

test('monthSpans con lista vuota restituisce lista vuota', () => {
  assert.deepEqual(monthSpans([]), []);
});

test('currentWeekIndex trova la settimana che contiene il giorno, domenica inclusa', () => {
  const weeks = ['2025-12-29', '2026-01-05'];
  assert.equal(currentWeekIndex(weeks, '2026-01-01'), 0); // giovedì
  assert.equal(currentWeekIndex(weeks, '2026-01-04'), 0); // domenica: settimana del 29/12
  assert.equal(currentWeekIndex(weeks, '2026-01-05'), 1); // lunedì
});

test('currentWeekIndex restituisce -1 fuori intervallo', () => {
  assert.equal(currentWeekIndex(['2025-12-29', '2026-01-05'], '2027-01-10'), -1);
});

test('isoWeekNumber: il lunedì 29/12/2025 è la W1 del 2026', () => {
  assert.equal(isoWeekNumber('2025-12-29'), 1);
  assert.equal(isoWeekNumber('2026-09-14'), 38);
});

test('barGeometry converte indice e durata in pixel dai bordi', () => {
  const edges = uniformWeekEdges(10, 48);
  assert.deepEqual(barGeometry(edges, 3, 2), { left: 144, width: 96 });
  assert.deepEqual(barGeometry(uniformWeekEdges(1, 12), 0, 1), { left: 0, width: 12 });
});

test('barGeometry segue le larghezze diverse per mese', () => {
  // gennaio: 2 settimane in 300px (150 l una), febbraio: 2 settimane a 20px
  const edges = weekEdges(['2026-01-05', '2026-01-12', '2026-02-02', '2026-02-09'], 20, { '2026-01': 300 });
  assert.deepEqual(barGeometry(edges, 1, 2), { left: 150, width: 170 });
});

test('uniformWeekEdges: n+1 bordi a passo costante', () => {
  assert.deepEqual(uniformWeekEdges(3, 10), [0, 10, 20, 30]);
  assert.deepEqual(uniformWeekEdges(0, 10), [0]);
});

test('weekEdges senza larghezze personalizzate equivale a uniformWeekEdges', () => {
  const weeks = ['2025-12-29', '2026-01-05', '2026-01-12'];
  assert.deepEqual(weekEdges(weeks, 12, {}), uniformWeekEdges(3, 12));
});

test('weekEdges divide la larghezza del mese fra le sue settimane, il resto resta di default', () => {
  const weeks = ['2025-12-29', '2026-01-05', '2026-01-12', '2026-02-02'];
  assert.deepEqual(weekEdges(weeks, 12, { '2026-01': 100 }), [0, 12, 62, 112, 124]);
});

test('clampMonthWidth non scende sotto il minimo', () => {
  assert.equal(clampMonthWidth(10), MIN_MONTH_WIDTH);
  assert.equal(clampMonthWidth(240), 240);
});

test('centerScrollLeft porta la settimana al centro dell area visibile', () => {
  // Area timeline visibile = 1288 - 288 = 1000px; centro settimana 10 = 504px.
  assert.equal(centerScrollLeft(uniformWeekEdges(20, 48), 10, SIDEBAR_WIDTH + 1000), 4);
});

test('centerScrollLeft usa il centro reale di una settimana allargata', () => {
  // gennaio 200px su 2 settimane: la settimana 2 va da 112 a 212, centro 162; visibile 100 -> 112
  const edges = weekEdges(['2025-12-29', '2026-01-05', '2026-01-12'], 12, { '2026-01': 200 });
  assert.equal(centerScrollLeft(edges, 2, SIDEBAR_WIDTH + 100), 112);
});

test('centerScrollLeft non va mai sotto zero', () => {
  assert.equal(centerScrollLeft(uniformWeekEdges(20, 48), 0, SIDEBAR_WIDTH + 1000), 0);
});

test('centerScrollLeft con viewport più stretto del pannello usa una colonna come area', () => {
  // visibile = max(200 - 288, 48) = 48 -> 5*48 + 24 - 24 = 240
  assert.equal(centerScrollLeft(uniformWeekEdges(20, 48), 5, 200), 240);
});

test('weeksOfMonth tiene i lunedì del mese, come fa monthSpans', () => {
  const weeks = ['2025-12-29', '2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02'];

  assert.deepEqual(weeksOfMonth(weeks, '2026-01'), ['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']);
  assert.deepEqual(weeksOfMonth(weeks, '2026-03'), []);
});

test('shiftMonthKey avanza e arretra di mesi attraversando gli anni', () => {
  assert.equal(shiftMonthKey('2026-10', 1), '2026-11');
  assert.equal(shiftMonthKey('2026-10', -1), '2026-09');
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01');
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
});

test('fillWeekWidth riempie lo spazio a destra del pannello, mai sotto il minimo', () => {
  // 1288 - 288 = 1000px per 4 settimane
  assert.equal(fillWeekWidth(SIDEBAR_WIDTH + 1000, 4, 180), 250);
  // arrotonda per difetto: niente barra di scroll orizzontale per un pixel
  assert.equal(fillWeekWidth(SIDEBAR_WIDTH + 1001, 3, 180), 333);
  // schermo stretto: vale il minimo, si scorre
  assert.equal(fillWeekWidth(SIDEBAR_WIDTH + 400, 5, 180), 180);
  // misura non ancora disponibile o nessuna settimana: minimo
  assert.equal(fillWeekWidth(0, 4, 180), 180);
  assert.equal(fillWeekWidth(1600, 0, 180), 180);
});
