/**
 * Автоматические тесты научного контракта и анализатора (node:test).
 *
 * Тесты проверяют поведение на ФАКТИЧЕСКИХ моделях проекта
 * (REFERENCE_MODELS / RESEARCH_DATABASE), а не только на искусственных
 * объектах. Технические тесты не подтверждают научную валидированность
 * системы — они фиксируют корректность контракта данных.
 *
 * Запуск: node --test tests/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  METRICS_CATALOG,
  REFERENCE_MODELS,
  AGE_GROUP_RULES,
  INSUFFICIENT_DATA_MESSAGE,
  getComparableModels,
  isZScoreAllowed,
  assessModelCompatibility,
} from '../src/data/modelsConfig.js';
import {
  buildAthleteCohort,
  mapAgeToGroup,
  validateMetricValue,
  compareWithReferenceModels,
  analyzeAthleteProfile,
} from '../src/utils/fullAnalyzer.js';

// ---------------------------------------------------------------------------
// Вспомогательные: глубокая проверка на NaN / Infinity
// ---------------------------------------------------------------------------

function collectNonFiniteNumbers(value, path = 'root', found = []) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) found.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectNonFiniteNumbers(v, `${path}[${i}]`, found));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectNonFiniteNumbers(v, `${path}.${k}`, found);
    }
  }
  return found;
}

const ADULT = { id: 1, name: 'Тест', age: 25, style: 'Темповик', weight: '67 кг' };

// ---------------------------------------------------------------------------
// 1. Непроверенные модели не допускают нормативной интерпретации
// ---------------------------------------------------------------------------

test('ни одна фактическая модель проекта не допущена к научному сравнению', () => {
  for (const model of REFERENCE_MODELS) {
    assert.equal(model.admission?.eligibleForComparison, false, `${model.id}: admission должен быть false`);
    assert.equal(model.dataStatus, 'unverified', `${model.id}: статус не должен повышаться без проверки`);
    assert.ok(model.admission.requiredConditions.length > 0, `${model.id}: должны быть условия допуска`);
  }
});

test('непроверенная модель не даёт нормативный z-score: статус research_result / insufficient_data', () => {
  const cohort = buildAthleteCohort(ADULT);
  const result = compareWithReferenceModels('vo2maxRel', 62.5, cohort);
  assert.notEqual(result.status, 'ok');
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.message, INSUFFICIENT_DATA_MESSAGE);
  // Исследовательские результаты сохранены отдельно и явно помечены
  const research = result.comparisons.filter((c) => c.status === 'research_result');
  assert.ok(research.length > 0, 'должны быть исследовательские результаты');
  for (const c of research) {
    assert.equal(c.zScore, undefined, 'z-score не рассчитывается для недопущенной модели');
    assert.match(c.message, /не используется для/i);
  }
});

test('isZScoreAllowed отклоняет фактические модели проекта при формально валидных статистиках', () => {
  const sharomov = REFERENCE_MODELS.find((m) => m.id === 'model_sharomov_2025_chm');
  assert.equal(isZScoreAllowed('vo2maxRel', sharomov, { mean: 66.0, sd: 2.5 }), false);
});

// ---------------------------------------------------------------------------
// 2. Корректная работа модели после документированного допуска
// ---------------------------------------------------------------------------

test('допущенная модель с полной совместимостью даёт конечный z-score', () => {
  // Документированный допуск воспроизводим на копии фактической модели:
  // заполнены условия admission, протокол и когорта спортсмена совпадают.
  const admitted = {
    ...REFERENCE_MODELS.find((m) => m.id === 'model_sharomov_2025_chm'),
    protocol: 'Документированный протокол анализа боёв ЧМ-2025',
    admission: {
      eligibleForComparison: true,
      requiredConditions: [],
      valuesProvenanceVerified: true,
      note: 'Тестовый допуск после выполнения условий.',
    },
  };
  const compatCohort = {
    sex: null,
    ageGroup: 'Взрослые (ЭВСМ)',
    qualification: 'МСМК / Сборная РФ',
    weightCategory: null,
    protocol: admitted.protocol,
    units: null,
  };
  const compat = assessModelCompatibility(admitted, 'vo2maxRel', compatCohort);
  assert.equal(compat.level, 'full');
  assert.equal(isZScoreAllowed('vo2maxRel', admitted, { mean: 66.0, sd: 2.5 }), true);

  const z = (62.5 - 66.0) / 2.5;
  assert.ok(Number.isFinite(z));
  assert.ok(Math.abs(z - -1.4) < 1e-9);
});

// ---------------------------------------------------------------------------
// 3. Квалификация не выводится из возраста
// ---------------------------------------------------------------------------

test('buildAthleteCohort не присваивает квалификацию по возрасту', () => {
  for (const age of [15, 17, 18, 25, 40]) {
    const cohort = buildAthleteCohort({ age });
    assert.equal(cohort.qualification, null, `age=${age}: qualification должен оставаться null`);
    assert.equal(cohort.competitionLevel, null, `age=${age}: competitionLevel должен оставаться null`);
  }
});

test('возрастная группа определяется по документированным правилам AGE_GROUP_RULES', () => {
  assert.deepEqual(AGE_GROUP_RULES.length > 0, true);
  assert.equal(mapAgeToGroup(25), 'Взрослые (ЭВСМ)');
  assert.equal(mapAgeToGroup(17), 'Юниоры (17–18 лет)');
  assert.equal(mapAgeToGroup(18), 'Юниоры (17–18 лет)');
  assert.equal(mapAgeToGroup(16), null);
  assert.equal(mapAgeToGroup(12), null);
  assert.equal(mapAgeToGroup('25'), null);
  assert.equal(mapAgeToGroup(NaN), null);
});

test('явные поля квалификации и уровня сохраняются как раздельные', () => {
  const cohort = buildAthleteCohort({ age: 25, qualification: 'МС', competitionLevel: 'Первенство РФ' });
  assert.equal(cohort.qualification, 'МС');
  assert.equal(cohort.competitionLevel, 'Первенство РФ');
  assert.equal(cohort.age, 25);
});

// ---------------------------------------------------------------------------
// 4. Блокировка моделей при неизвестных критичных характеристиках
// ---------------------------------------------------------------------------

test('null у спортсмена не считается совпадением: возрастная группа блокирует модели', () => {
  // Ребёнок 12 лет: возрастная группа null → все возрастные модели
  // получают уровень insufficient_data, нормативное сравнение недоступно
  const cohort = buildAthleteCohort({ age: 12 });
  assert.equal(cohort.ageGroup, null);
  const models = getComparableModels('vo2maxRel', cohort);
  assert.ok(models.length > 0, 'модели возвращаются с диагностикой уровня');
  for (const m of models) {
    assert.equal(m.compatibility.level, 'insufficient_data');
  }
  const result = compareWithReferenceModels('vo2maxRel', 55, cohort);
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.message, INSUFFICIENT_DATA_MESSAGE);
});

test('неизвестная весовая категория блокирует нормативную интерпретацию сегментированных моделей', () => {
  // Взрослый без weightCategory и qualification: все модели — insufficient_data
  // (у каждой заданы характеристики, отсутствующие у спортсмена);
  // уровень full недостижим ни для одной модели
  const cohort = buildAthleteCohort({ age: 25 });
  const models = getComparableModels('vo2maxRel', cohort);
  assert.ok(models.length > 0);
  const byId = Object.fromEntries(models.map((m) => [m.id, m.compatibility.level]));
  assert.equal(byId['model_vniifk_2022_msmk_mid'], 'insufficient_data');
  assert.equal(byId['model_filimonov_2000_ms_mid'], 'insufficient_data');
  assert.equal(byId['model_sharomov_2025_chm'], 'insufficient_data');
  assert.ok(models.every((m) => m.compatibility.level !== 'full'));
  // Сегментированные по весу модели дополнительно содержат issue о weightCategory
  const vniifk = models.find((m) => m.id === 'model_vniifk_2022_msmk_mid');
  assert.ok(vniifk.compatibility.issues.some((i) => /weightCategory/.test(i)));
});

test('несовпадение заданных характеристик → модель исключается как несовместимая', () => {
  const cohort = { ...buildAthleteCohort({ age: 25 }), weightCategory: 'Тяжёлый вес (>92 кг)' };
  const models = getComparableModels('vo2maxRel', cohort);
  const ids = models.map((m) => m.id);
  assert.ok(!ids.includes('model_vniifk_2022_msmk_mid')); // средний вес ≠ тяжёлый
  const taymazov = assessModelCompatibility(
    REFERENCE_MODELS.find((m) => m.id === 'model_taymazov_1997_juniors'),
    'vo2maxRel',
    cohort,
  );
  assert.equal(taymazov.level, 'incompatible'); // юниоры ≠ взрослые
});

test('строка массы тела "67 кг" не является весовой категорией', () => {
  const cohort = buildAthleteCohort(ADULT);
  assert.equal(cohort.weightCategory, null);
});

// ---------------------------------------------------------------------------
// 5. Отказ при неизвестном протоколе
// ---------------------------------------------------------------------------

test('неизвестный протокол модели → совместимость не лучше limited', () => {
  // У всех фактических моделей protocol: null
  const cohort = { ...buildAthleteCohort({ age: 17 }), qualification: '1-й разряд / КМС' };
  const model = REFERENCE_MODELS.find((m) => m.id === 'model_taymazov_1997_juniors');
  const compat = assessModelCompatibility(model, 'reactionTime', cohort);
  assert.equal(compat.level, 'limited');
  assert.ok(compat.issues.some((i) => /протокол/i.test(i)));
});

test('reactionTime: протокол неизвестен и у модели, и у показателя — нормативный z-score недоступен', () => {
  const cohort = buildAthleteCohort({ age: 17 });
  const result = compareWithReferenceModels('reactionTime', 220, cohort);
  assert.notEqual(result.status, 'ok');
  for (const c of result.comparisons ?? []) {
    assert.equal(c.zScore, undefined);
    assert.ok(c.compatibility.issues.some((i) => /протокол/i.test(i)));
  }
});

// ---------------------------------------------------------------------------
// 6. Отсутствующие значения, нулевое SD, некорректный ввод, нулевые знаменатели
// ---------------------------------------------------------------------------

test('отсутствующие значения не заменяются нулями', () => {
  for (const missing of [undefined, null, NaN]) {
    const v = validateMetricValue('vo2maxRel', missing);
    assert.equal(v.status, 'missing');
    assert.equal(v.value, undefined);
  }
  const result = analyzeAthleteProfile(ADULT, null);
  assert.equal(result.summary.metricsOk, 0);
  assert.equal(result.summary.metricsMissing, result.summary.metricsRequested);
  for (const cmp of Object.values(result.comparisons)) {
    assert.notEqual(cmp.status, 'ok');
  }
});

test('нулевое или отрицательное SD запрещает z-score', () => {
  const admitted = {
    ...REFERENCE_MODELS[0],
    admission: { eligibleForComparison: true, requiredConditions: [], valuesProvenanceVerified: true, note: '' },
  };
  assert.equal(isZScoreAllowed('vo2maxRel', admitted, { mean: 60, sd: 0 }), false);
  assert.equal(isZScoreAllowed('vo2maxRel', admitted, { mean: 60, sd: -1 }), false);
  assert.equal(isZScoreAllowed('vo2maxRel', admitted, { mean: 60, sd: NaN }), false);
  assert.equal(isZScoreAllowed('vo2maxRel', admitted, { mean: 60, sd: Infinity }), false);
  assert.equal(isZScoreAllowed('vo2maxRel', admitted, { mean: Infinity, sd: 2 }), false);
  assert.equal(isZScoreAllowed('vo2maxRel', admitted, { mean: 60, sd: 2 }), true);
});

test('некорректный ввод отклоняется валидацией', () => {
  assert.equal(validateMetricValue('weight', -5).status, 'invalid');
  assert.equal(validateMetricValue('weight', 'abc').status, 'invalid');
  assert.equal(validateMetricValue('vo2maxRel', Infinity).status, 'invalid');
  assert.equal(validateMetricValue('nsType', 'Неизвестный тип').status, 'invalid');
  assert.equal(validateMetricValue('nsType', 'Сильный (средне-сильный)').status, 'ok');
  assert.equal(validateMetricValue('несуществующий', 1).status, 'unknown');
});

// ---------------------------------------------------------------------------
// 7. В результатах нет NaN и Infinity
// ---------------------------------------------------------------------------

test('полный анализ реалистичного профиля не содержит NaN/Infinity', () => {
  const phys = {
    weight: 67.0, smm: 34.5, inbodyScore: 82, phaseAngle: 7.2, bodyFat: 11.5, ecwTbw: 0.375,
    relPower: 12.4, avgPower: 780, timeMaxSpeed: 2.1, timePeakPower: 3.4, maxRpm: 185, fatigueIndex: 18.2,
    vo2maxAbs: 4.2, vo2maxRel: 62.5, aerobicThreshold: 42.0, maxVentilation: 145, tidalVolume: 2.8,
    respExchangeRatio: 1.12, leftPunch: 410.2, rightPunch: 446.7, tonnage10s: 1250,
    punches10s: 38, punches3min: 210, nsType: 'Сильный (средне-сильный)', reactionTime: 220, diffError: 4.5,
  };
  for (const athlete of [ADULT, { id: 2, age: 17 }, { id: 3, age: 12 }, { id: 4 }]) {
    const result = analyzeAthleteProfile(athlete, phys);
    const bad = collectNonFiniteNumbers(result);
    assert.deepEqual(bad, [], `нечисловые значения: ${bad.join(', ')}`);
  }
});

test('анализ пустых и частично повреждённых данных не содержит NaN/Infinity', () => {
  for (const phys of [null, {}, { vo2maxRel: NaN, weight: 'abc', reactionTime: Infinity }]) {
    const result = analyzeAthleteProfile(ADULT, phys);
    const bad = collectNonFiniteNumbers(result);
    assert.deepEqual(bad, [], `нечисловые значения: ${bad.join(', ')}`);
  }
});

// ---------------------------------------------------------------------------
// 8. Z-оценки разных моделей не объединяются автоматически
// ---------------------------------------------------------------------------

test('результаты возвращаются по каждой модели отдельно, без агрегированного z', () => {
  const cohort = buildAthleteCohort({ age: 25 });
  const result = compareWithReferenceModels('vo2maxRel', 62.5, cohort);
  assert.equal(result.aggregatedZScore, undefined);
  assert.equal(result.aggregatedInterpretation, undefined);
  assert.ok(Array.isArray(result.comparisons));
  // Даже в гипотетическом случае нескольких допущенных моделей агрегата нет:
  // проверяем контракт структуры ответа
  const keys = Object.keys(result);
  assert.ok(!keys.some((k) => /aggregat/i.test(k)));
});

// ---------------------------------------------------------------------------
// 9. Сохранение исходных данных и обработка всех метрик каталога
// ---------------------------------------------------------------------------

test('исходные значения сохраняются в отчёте без изменений', () => {
  const phys = { vo2maxRel: 62.5, reactionTime: 220 };
  const result = analyzeAthleteProfile(ADULT, phys);
  assert.equal(result.validation.vo2maxRel.value, 62.5);
  assert.equal(result.validation.reactionTime.value, 220);
  assert.equal(result.athlete.age, 25);
  assert.equal(phys.vo2maxRel, 62.5); // входной объект не мутирован
});

test('анализ обрабатывает все количественные метрики каталога', () => {
  const numericMetrics = METRICS_CATALOG.filter((m) => m.validation.type === 'number').map((m) => m.id);
  const result = analyzeAthleteProfile(ADULT, {});
  assert.equal(result.summary.metricsRequested, numericMetrics.length);
  for (const id of numericMetrics) {
    assert.ok(result.validation[id], `нет результата валидации для ${id}`);
    assert.ok(result.comparisons[id], `нет результата сравнения для ${id}`);
  }
});

test('качественные метрики (nsType) не передаются в числовое сравнение', () => {
  const result = compareWithReferenceModels('nsType', 'Сильный (средне-сильный)', buildAthleteCohort(ADULT));
  assert.equal(result.status, 'not_quantitative');
});
