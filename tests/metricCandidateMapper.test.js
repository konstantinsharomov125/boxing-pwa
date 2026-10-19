/**
 * Тесты сопоставления кандидатов показателей с METRICS_CATALOG.
 *
 * Проверяются политика маппинга (точное название + единица, конфликты,
 * неоднозначность, защитные правила) и неизменность каталога.
 * Сетевых вызовов и записи данных нет.
 *
 * Запуск: node --test tests/metricCandidateMapper.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  METRICS_CATALOG,
  getMetricById,
} from '../src/data/modelsConfig.js';
import { USER_ENTRY_METRICS } from '../src/data/userResearchStore.js';
import {
  MAPPING_STATUS,
  buildCatalogIndex,
  buildMappingReport,
  findOverlapGuard,
  loadMetricCandidates,
  mapCandidate,
  normalizeUnit,
  unitsCompatible,
  DEFAULT_METRIC_CANDIDATES_FILE,
} from '../src/utils/metricCandidateMapper.mjs';

function candidate(overrides = {}) {
  return {
    metricIdCandidate: 'metriccand_test',
    nameOriginal: 'Масса тела',
    unitOriginal: 'кг',
    domainOriginal: 'Антропометрия',
    normalizationStatus: 'candidate_not_harmonized',
    appMetricId: null,
    provenanceRows: ['Результаты!2'],
    ...overrides,
  };
}

const CATALOG_SNAPSHOT = JSON.stringify(METRICS_CATALOG);

// ---------------------------------------------------------------------------
// Единицы измерения
// ---------------------------------------------------------------------------

test('normalizeUnit эквивалентирует записи VO2 и секунд', () => {
  assert.equal(normalizeUnit('мл/мин/кг'), normalizeUnit('мл·кг⁻¹·мин⁻¹'));
  assert.equal(normalizeUnit('сек'), normalizeUnit('с'));
  assert.equal(normalizeUnit(' КГ '), normalizeUnit('кг'));
  assert.equal(normalizeUnit(''), null);
  assert.equal(normalizeUnit(null), null);
});

test('unitsCompatible не путает разные единицы и не считает пустую единицу совпадением', () => {
  assert.equal(unitsCompatible('кг', 'кг'), true);
  assert.equal(unitsCompatible('W/kg', 'Вт/кг'), false);
  assert.equal(unitsCompatible('кг', null), false);
  assert.equal(unitsCompatible('Н', 'кг'), false);
});

// ---------------------------------------------------------------------------
// Прямое соответствие
// ---------------------------------------------------------------------------

test('точное название и единица дают прямое соответствие, но не норматив', () => {
  const result = mapCandidate(candidate());
  assert.equal(result.status, MAPPING_STATUS.direct_match);
  assert.equal(result.appMetricId, 'weight');
  assert.match(result.reason, /подтверждение эксперта/i);
  assert.ok(!/норматив/i.test(result.reason) || /не норматив|подтвержд/i.test(result.reason));
});

test('прямое соответствие возможно для %-показателя жира тела', () => {
  const result = mapCandidate(candidate({ metricIdCandidate: 'metriccand_fat', nameOriginal: 'Процент жира в теле', unitOriginal: '%' }));
  assert.equal(result.status, MAPPING_STATUS.direct_match);
  assert.equal(result.appMetricId, 'bodyFat');
});

test('VO₂max относительный сопоставляется при эквивалентной записи единицы', () => {
  const result = mapCandidate(candidate({ nameOriginal: 'Относительное МПК', unitOriginal: 'мл·кг⁻¹·мин⁻¹' }));
  assert.equal(result.status, MAPPING_STATUS.direct_match);
  assert.equal(result.appMetricId, 'vo2maxRel');
});

// ---------------------------------------------------------------------------
// Конфликты и неоднозначность
// ---------------------------------------------------------------------------

test('совпадение названия при другой единице — конфликт единиц, без appMetricId', () => {
  const result = mapCandidate(candidate({ unitOriginal: 'фунт' }));
  assert.equal(result.status, MAPPING_STATUS.unit_conflict);
  assert.equal(result.appMetricId, null);
  assert.match(result.reason, /единица/i);
});

test('показатель без названия в каталоге не сопоставляется автоматически', () => {
  const result = mapCandidate(candidate({ nameOriginal: 'ЧСС восстановления 1 мин', unitOriginal: 'уд/мин' }));
  assert.equal(result.status, MAPPING_STATUS.no_catalog_metric);
  assert.equal(result.appMetricId, null);
});

test('защитное правило для «Количество ударов» (уд/мин) — неоднозначность', () => {
  const result = mapCandidate(candidate({ nameOriginal: 'Количество ударов', unitOriginal: 'ударов/мин' }));
  assert.equal(result.status, MAPPING_STATUS.ambiguous);
  assert.equal(result.appMetricId, null);
  assert.ok(result.candidates.some((c) => c.appMetricId === 'density'));
  assert.ok(result.candidates.some((c) => c.appMetricId === 'punches3min'));
});

test('«Сила удара» без руки и единицы — неоднозначность, не leftPunch', () => {
  const result = mapCandidate(candidate({ nameOriginal: 'Сила удара cross', unitOriginal: 'Н' }));
  assert.equal(result.status, MAPPING_STATUS.ambiguous);
  assert.equal(result.appMetricId, null);
  assert.ok(result.candidates.some((c) => c.appMetricId === 'leftPunch'));
  assert.ok(result.candidates.some((c) => c.appMetricId === 'rightPunch'));
});

test('findOverlapGuard не срабатывает на точное каталоговое название', () => {
  assert.equal(findOverlapGuard({ nameOriginal: 'Масса тела', unitOriginal: 'кг' }), null);
});

test('несколько каталоговых метрик с одинаковым названием — неоднозначность', () => {
  const catalog = [
    { id: 'a', nameRu: 'Тест', unit: 'кг' },
    { id: 'b', nameRu: 'Тест', unit: 'кг' },
  ];
  const result = mapCandidate(candidate({ nameOriginal: 'Тест' }), buildCatalogIndex(catalog));
  assert.equal(result.status, MAPPING_STATUS.ambiguous);
  assert.equal(result.appMetricId, null);
  assert.deepEqual(result.candidates.map((c) => c.appMetricId).sort(), ['a', 'b']);
});

test('некорректная запись кандидата помечается invalid_record', () => {
  assert.equal(mapCandidate(null).status, MAPPING_STATUS.invalid_record);
  assert.equal(mapCandidate({ nameOriginal: 'Масса тела' }).status, MAPPING_STATUS.invalid_record);
});

// ---------------------------------------------------------------------------
// Сводный отчёт
// ---------------------------------------------------------------------------

test('buildMappingReport считает статусы и покрытие каталога', () => {
  const report = buildMappingReport([
    candidate(),
    candidate({ metricIdCandidate: 'metriccand_2', unitOriginal: 'фунт' }),
    candidate({ metricIdCandidate: 'metriccand_3', nameOriginal: 'Нечто иное', unitOriginal: 'уд/мин' }),
  ]);

  assert.equal(report.summary.candidateCount, 3);
  assert.equal(report.summary.directMatchCount, 1);
  assert.equal(report.summary.unitConflictCount, 1);
  assert.equal(report.summary.noCatalogMetricCount, 1);
  assert.equal(report.summary.manualReviewCount, 2);
  assert.ok(report.summary.catalogMetricsWithCandidate.includes('weight'));
  assert.ok(report.summary.catalogMetricsWithoutCandidate.includes('vo2maxRel'));
  assert.equal(report.summary.promotedToNormativeStatus, false);
});

test('отчёт не изменяет METRICS_CATALOG и не проставляет appMetricId в кандидатах', () => {
  const input = [candidate()];
  const report = buildMappingReport(input);
  assert.equal(report.records[0].appMetricId, 'weight');
  assert.equal(input[0].appMetricId, null, 'исходный кандидат не должен мутировать');
  assert.equal(JSON.stringify(METRICS_CATALOG), CATALOG_SNAPSHOT);
});

test('сводка сообщает о метриках пользовательских исследований без кандидатов', () => {
  const report = buildMappingReport([candidate()]);
  for (const metricId of USER_ENTRY_METRICS) {
    const hasCandidate = report.summary.catalogMetricsWithCandidate.includes(metricId);
    if (!hasCandidate) {
      assert.ok(report.summary.userEntryMetricsWithoutCandidate.includes(metricId));
    }
  }
  assert.ok(getMetricById('weight'));
});

// ---------------------------------------------------------------------------
// Чтение файла
// ---------------------------------------------------------------------------

test('loadMetricCandidates сообщает об отсутствии файла без создания данных', async () => {
  const result = await loadMetricCandidates('data/research-staging/__missing__/metric_candidates.json');
  assert.equal(result.ok, false);
  assert.match(result.error, /не удалось прочитать/);
});

test('путь к пакету по умолчанию указывает на staging-каталог', () => {
  assert.ok(DEFAULT_METRIC_CANDIDATES_FILE.includes('research-staging'));
  assert.ok(DEFAULT_METRIC_CANDIDATES_FILE.endsWith('metric_candidates.json'));
});
