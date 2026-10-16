import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFightRecord,
  computeBoutMetrics,
  summarizeCompetitionMetrics,
} from '../src/utils/competitionAdapter.js';
import { analyzeAthleteProfile, buildLongitudinalReport } from '../src/utils/fullAnalyzer.js';

const rounds = [
  { id: 1, jabsTotal: 20, jabsTarget: 8, powerTotal: 10, powerTarget: 4 },
  { id: 2, jabsTotal: 30, jabsTarget: 9, powerTotal: 20, powerTarget: 6 },
  { id: 3, jabsTotal: 40, jabsTarget: 8, powerTotal: 20, powerTarget: 4 },
];

const secondRounds = [
  { id: 1, jabsTotal: 10, jabsTarget: 5, powerTotal: 10, powerTarget: 5 },
];

test('computeBoutMetrics рассчитывает density, keu, kv и точность из раундов', () => {
  const result = computeBoutMetrics({ rounds, roundDurationMin: 3 });

  assert.deepEqual(result.totals, {
    punches: 140,
    target: 39,
    jabs: 90,
    jabsTarget: 25,
    power: 50,
    powerTarget: 14,
  });
  assert.equal(result.minutes, 9);
  assert.equal(result.values.density, 140 / 9);
  assert.equal(result.values.keu, 39 / 140);
  assert.equal(result.values.kv, 1);
  assert.equal(result.values.jabsAcc, (25 / 90) * 100);
  assert.equal(result.values.powerAcc, (14 / 50) * 100);
  assert.deepEqual(result.issues, []);
});

test('адаптер агрегирует историю боёв с весами для ratios и средним kv', () => {
  const history = [
    buildFightRecord({ id: 1, rounds, roundsCount: 3, roundDurationMin: 3 }),
    buildFightRecord({ id: 2, rounds: secondRounds, roundsCount: 1, roundDurationMin: 4 }),
  ];
  const result = summarizeCompetitionMetrics(42, { history });

  assert.equal(result.source.records, 2);
  assert.equal(result.source.validRecords, 2);
  assert.equal(result.metrics.density.aggregation, 'pooled');
  assert.equal(result.metrics.density.value, 160 / 13);
  assert.equal(result.metrics.keu.value, 49 / 160);
  assert.equal(result.metrics.jabsAcc.value, 30);
  assert.equal(result.metrics.powerAcc.value, (19 / 60) * 100);
  assert.equal(result.metrics.kv.aggregation, 'mean');
  assert.equal(result.metrics.kv.value, 1);
});

test('fullAnalyzer подключает competition-метрики к валидации и сравнениям', () => {
  const history = [buildFightRecord({ id: 7, rounds, roundsCount: 3, roundDurationMin: 3 })];
  const result = analyzeAthleteProfile(
    { id: 'athlete-7', name: 'Тест', age: 25 },
    {},
    { metricIds: ['density', 'keu', 'kv'], competitionHistory: history },
  );

  assert.equal(result.competition.source.validRecords, 1);
  assert.equal(result.validation.density.value, 140 / 9);
  assert.equal(result.validation.keu.value, 39 / 140);
  assert.equal(result.validation.kv.value, 1);
  assert.equal(result.summary.metricsOk, 3);
  assert.equal(result.comparisons.density.metricId, 'density');
  assert.equal(result.comparisons.keu.metricId, 'keu');
  assert.equal(result.comparisons.kv.metricId, 'kv');
  assert.ok(result.longitudinal);
  assert.equal(result.longitudinal.source.competitionPeriods, 1);
});

test('интервальный отчёт связывает бой с последним физическим тестированием', () => {
  const history = [
    buildFightRecord({
      id: 1,
      date: '10.01.2026',
      rounds: secondRounds,
      roundsCount: 1,
      roundDurationMin: 2,
    }),
    buildFightRecord({
      id: 2,
      date: '10.03.2026',
      rounds,
      roundsCount: 3,
      roundDurationMin: 3,
    }),
  ];
  const physHistory = [
    { date: '01.01.2026', data: { vo2maxRel: 55, reactionTime: 240 } },
    { date: '01.03.2026', data: { vo2maxRel: 60, reactionTime: 220 } },
  ];

  const result = buildLongitudinalReport(
    { id: 42, age: 25 },
    null,
    { competitionHistory: history, physHistory },
  );
  const fights = result.periods.filter((period) => period.source === 'competition');

  assert.equal(result.periods.length, 4);
  assert.equal(fights[0].physical.vo2maxRel, 55);
  assert.equal(fights[0].physical.reactionTime, 240);
  assert.equal(fights[1].physical.vo2maxRel, 60);
  assert.equal(fights[1].competition.density, 140 / 9);
  assert.equal(result.source.competitionPeriods, 2);
  assert.equal(result.source.physicalRecords, 2);
});

test('интервальный отчёт рассчитывает изменение одинаковых метрик между периодами', () => {
  const physHistory = [
    { date: '01.01.2026', data: { vo2maxRel: 55, reactionTime: 240 } },
    { date: '01.03.2026', data: { vo2maxRel: 61, reactionTime: 215 } },
  ];
  const result = buildLongitudinalReport(
    { id: 'longitudinal' },
    null,
    { competitionHistory: [], physHistory },
  );

  assert.equal(result.delta.vo2maxRel, 6);
  assert.equal(result.delta.reactionTime, -25);
  assert.equal(result.delta.density, null);
  assert.equal(result.periods[1].coverage.physical, 2 / 8);
});
