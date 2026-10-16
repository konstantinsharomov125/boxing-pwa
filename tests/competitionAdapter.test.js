import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFightRecord,
  computeBoutMetrics,
  summarizeCompetitionMetrics,
} from '../src/utils/competitionAdapter.js';
import { analyzeAthleteProfile } from '../src/utils/fullAnalyzer.js';

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
});
