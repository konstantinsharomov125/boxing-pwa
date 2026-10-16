/**
 * Анализатор цифрового профиля боксёра (этап 2, ревизия 2.1).
 *
 * Работает поверх контракта данных из `src/data/modelsConfig.js`:
 * проверяет качество и полноту данных, отсекает недопустимые значения,
 * подбирает сопоставимые референтные модели и рассчитывает отклонения
 * только для моделей, явно допущенных к научному сравнению
 * (admission.eligibleForComparison === true).
 *
 * Принципы:
 *  - отсутствующие данные не заменяются нулями;
 *  - статус проверки публикации, качество извлечённых данных, пригодность
 *    модели и её совместимость со спортсменом — четыре разных вопроса,
 *    они не смешиваются;
 *  - нормативная интерпретация недоступна для моделей без документированного
 *    допуска; такие модели возвращаются как research_result — отдельные
 *    исследовательские результаты, не используемые для автоматических
 *    рекомендаций;
 *  - z-оценки разных моделей не усредняются и не объединяются;
 *  - null в характеристике спортсмена не считается совпадением с моделью;
 *  - если сопоставимых допущенных моделей нет, возвращается
 *    INSUFFICIENT_DATA_MESSAGE, а не числовая оценка.
 */

import {
  METRICS_CATALOG,
  AGE_GROUP_RULES,
  DATA_QUALITY_STATUSES,
  COMPARABILITY_LEVELS,
  INSUFFICIENT_DATA_MESSAGE,
  getMetricById,
  getComparableModels,
  isZScoreAllowed,
} from '../data/modelsConfig.js';
import { getAllResearch } from '../data/researchDatabase.js';
import { COMPETITION_METRIC_IDS, summarizeCompetitionMetrics } from './competitionAdapter.js';

// ---------------------------------------------------------------------------
// Когорта спортсмена
// ---------------------------------------------------------------------------

/**
 * Возрастная группа определяется только по документированным правилам
 * AGE_GROUP_RULES из фактического возраста. Спортивная квалификация
 * из возраста НЕ выводится.
 */
export function mapAgeToGroup(age) {
  if (typeof age !== 'number' || !Number.isFinite(age)) return null;
  const rule = AGE_GROUP_RULES.find(
    (r) => age >= r.minAge && (r.maxAge == null || age <= r.maxAge),
  );
  return rule ? rule.ageGroup : null;
}

/**
 * Собирает когорту спортсмена для подбора моделей.
 * Все характеристики — раздельные поля:
 *  - age — фактический возраст (полных лет);
 *  - ageGroup — возрастная группа по AGE_GROUP_RULES;
 *  - qualification / competitionLevel — спортивная квалификация и
 *    соревновательный уровень: берутся только из явных полей объекта
 *    спортсмена, из возраста не выводятся;
 *  - sex — пол;
 *  - weightCategory — официальная весовая категория. Строка массы тела
 *    вида "67 кг" НЕ является подтверждением принадлежности к категории
 *    и здесь не используется;
 *  - protocol — протокол обследования, если он документирован.
 * Неизвестные характеристики — null (не совпадение, а отсутствие данных).
 */
export function buildAthleteCohort(athlete = {}) {
  return {
    sex: athlete.sex ?? null,
    age: typeof athlete.age === 'number' && Number.isFinite(athlete.age) ? athlete.age : null,
    ageGroup: mapAgeToGroup(athlete.age),
    qualification: athlete.qualification ?? null,
    competitionLevel: athlete.competitionLevel ?? null,
    weightCategory: athlete.weightCategory ?? null,
    protocol: athlete.examinationProtocol ?? null,
    units: null,
  };
}

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/** Статистики источника для показателя по объединённой базе исследований. */
function getSourceStats(model, metricId) {
  if (!model || !model.sourceRef) return null;
  const source = getAllResearch().find((r) => r.id === model.sourceRef);
  return source?.metrics?.[metricId] || null;
}

/** Признак «значение отсутствует» — нули сюда не входят и не подставляются. */
function isMissing(value) {
  return value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value));
}

// ---------------------------------------------------------------------------
// Валидация данных
// ---------------------------------------------------------------------------

/**
 * Проверяет один показатель против правил из METRICS_CATALOG.
 * Возвращает { status: 'ok'|'missing'|'invalid'|'unknown', ... }.
 */
export function validateMetricValue(metricId, rawValue) {
  const metric = getMetricById(metricId);
  if (!metric) {
    return { metricId, status: 'unknown', issues: ['Показатель отсутствует в каталоге modelsConfig.'] };
  }
  if (isMissing(rawValue)) {
    return {
      metricId,
      status: 'missing',
      issues: ['Значение отсутствует.'],
      policy: metric.missingData,
    };
  }

  const issues = [];
  const rule = metric.validation;

  if (rule.type === 'number') {
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) {
      return { metricId, status: 'invalid', issues: ['Значение не является конечным числом.'] };
    }
    if (rule.min != null && value < rule.min) {
      issues.push(`Значение ${value} ниже допустимой границы ${rule.min} ${metric.unit || ''}.`);
    }
    if (rule.max != null && value > rule.max) {
      issues.push(`Значение ${value} выше допустимой границы ${rule.max} ${metric.unit || ''}.`);
    }
    return {
      metricId,
      status: issues.length ? 'invalid' : 'ok',
      value,
      issues,
    };
  }

  if (rule.type === 'enum') {
    const ok = rule.values.includes(rawValue);
    return {
      metricId,
      status: ok ? 'ok' : 'invalid',
      value: rawValue,
      issues: ok ? [] : [`Значение «${rawValue}» не входит в допустимый перечень: ${rule.values.join(', ')}.`],
    };
  }

  return { metricId, status: 'ok', value: rawValue, issues: [] };
}

// ---------------------------------------------------------------------------
// Сравнение с референтными моделями
// ---------------------------------------------------------------------------

/**
 * Положение значения относительно среднего модели в единицах SD.
 * Это описательная характеристика, а НЕ валидированный спортивный
 * норматив: пороги ±1 SD и ±2 SD — общая статистическая эвристика.
 */
function interpretZScore(z, direction) {
  const abs = Math.abs(z);
  const base = {
    normative: false,
    normativeNote:
      'Пороги ±1 SD / ±2 SD — статистическая эвристика описания распределения, ' +
      'а не валидированный спортивный норматив.',
  };
  if (abs < 1) return { ...base, zone: 'within', label: 'В пределах ±1 SD от среднего модели' };
  const above = z > 0;
  let favorable;
  if (direction === 'higher_better') favorable = above;
  else if (direction === 'lower_better') favorable = !above;
  else favorable = null; // optimal_range / none — без оценки благоприятности
  return {
    ...base,
    zone: abs < 2 ? 'moderate_deviation' : 'strong_deviation',
    label:
      abs < 2 ? 'Умеренное отклонение (1–2 SD)' : 'Выраженное отклонение (>2 SD)',
    favorable,
  };
}

/** Результат по одной модели, когда числовое сравнение недопустимо. */
function blockedComparison(base, status, message, extra = {}) {
  return { ...base, status, message, ...extra };
}

/**
 * Сравнивает значение показателя с референтными моделями.
 *
 * Статусы результата:
 *  - 'ok'                — нормативное сравнение: модель допущена
 *                          (admission) и полностью сопоставима ('full');
 *  - 'research_result'   — исследовательский результат: модель не допущена
 *                          к научному сравнению или сопоставимость
 *                          ограничена; числовые значения показаны для
 *                          информации, но НЕ используются для нормативных
 *                          выводов и автоматических рекомендаций;
 *  - 'insufficient_data' — недостаточно сопоставимых научных данных.
 *
 * z-оценки разных моделей не усредняются: возвращаются отдельные
 * результаты по каждой модели.
 *
 * @param {string} metricId
 * @param {number} value — предварительно провалидированное значение
 * @param {object} cohort — результат buildAthleteCohort()
 */
export function compareWithReferenceModels(metricId, value, cohort) {
  const metric = getMetricById(metricId);
  if (!metric) {
    return { metricId, status: 'unknown_metric', message: 'Показатель отсутствует в каталоге.' };
  }
  if (metric.validation.type !== 'number') {
    return {
      metricId,
      status: 'not_quantitative',
      message: 'Качественный показатель: числовое сравнение с моделями неприменимо.',
    };
  }

  const models = getComparableModels(metricId, cohort);
  if (models.length === 0) {
    return {
      metricId,
      status: 'insufficient_data',
      message: INSUFFICIENT_DATA_MESSAGE,
      limitations: ['Ни одна референтная модель не прошла проверку сопоставимости.'],
    };
  }

  const comparisons = models.map((model) => {
    const compat = model.compatibility;
    const base = {
      modelId: model.id,
      sourceRef: model.sourceRef,
      modelKind: model.modelKind,
      dataStatus: model.dataStatus,
      dataStatusLabel: DATA_QUALITY_STATUSES[model.dataStatus]?.labelRu || model.dataStatus,
      compatibility: {
        level: compat.level,
        levelLabel: COMPARABILITY_LEVELS[compat.level],
        issues: compat.issues,
      },
      applicabilityLimits: model.applicabilityLimits,
    };
    const stats = getSourceStats(model, metricId);
    const unitMatch = stats ? stats.unit === metric.unit : null;
    const unitIssue =
      unitMatch === false
        ? `Единица источника (${stats.unit}) отличается от каталожной (${metric.unit}) — сравнение не выполняется до приведения единиц.`
        : null;

    // 1. Допуск модели к научному сравнению — главный гейт
    if (model.admission?.eligibleForComparison !== true) {
      return blockedComparison(
        base,
        'research_result',
        'Модель не допущена к научному сравнению (admission не предоставлен). ' +
          'Результат носит исследовательский характер и не используется для ' +
          'нормативных отклонений и автоматических рекомендаций.',
        {
          reference:
            stats && typeof stats.mean === 'number' && Number.isFinite(stats.mean)
              ? {
                  mean: stats.mean,
                  sd: typeof stats.sd === 'number' && Number.isFinite(stats.sd) && stats.sd > 0 ? stats.sd : null,
                  unit: stats.unit,
                }
              : null,
          admission: model.admission ?? null,
          limitations: [unitIssue, ...compat.issues].filter(Boolean),
        },
      );
    }

    // 2. Совместимость со спортсменом
    if (compat.level === 'insufficient_data') {
      return blockedComparison(
        base,
        'insufficient_data',
        INSUFFICIENT_DATA_MESSAGE + ': характеристики спортсмена неполны.',
        { limitations: compat.issues },
      );
    }
    if (compat.level === 'limited') {
      return blockedComparison(
        base,
        'research_result',
        'Ограниченная сопоставимость: нормативная интерпретация запрещена.',
        {
          reference:
            stats && typeof stats.mean === 'number'
              ? { mean: stats.mean, sd: typeof stats.sd === 'number' && stats.sd > 0 ? stats.sd : null, unit: stats.unit }
              : null,
          limitations: compat.issues,
        },
      );
    }

    // 3. compat.level === 'full' и модель допущена — проверка статистик
    if (!stats || typeof stats.mean !== 'number' || !Number.isFinite(stats.mean)) {
      return blockedComparison(
        base,
        'no_mean',
        'В источнике отсутствует среднее значение; числовое сравнение не выполняется.',
      );
    }
    if (unitMatch === false) {
      return blockedComparison(base, 'incompatible_units', unitIssue);
    }
    if (!isZScoreAllowed(metricId, model, stats)) {
      return blockedComparison(
        base,
        'qualitative_only',
        'Пригодное стандартное отклонение отсутствует: z-score не рассчитывается, ' +
          'допустимо только качественное сравнение со средним.',
        { reference: { mean: stats.mean, sd: null, unit: stats.unit }, difference: value - stats.mean },
      );
    }

    const z = (value - stats.mean) / stats.sd;
    if (!Number.isFinite(z)) {
      return blockedComparison(base, 'qualitative_only', 'Расчёт z-score дал неконечное значение.');
    }
    return {
      ...base,
      status: 'ok',
      reference: { mean: stats.mean, sd: stats.sd, unit: stats.unit },
      zScore: Number(z.toFixed(2)),
      interpretation: interpretZScore(z, metric.direction),
      limitations: [metric.interpretationLimits, ...compat.issues].filter(Boolean),
    };
  });

  const normative = comparisons.filter((c) => c.status === 'ok');
  if (normative.length === 0) {
    const hasResearch = comparisons.some((c) => c.status === 'research_result');
    return {
      metricId,
      status: 'insufficient_data',
      message: INSUFFICIENT_DATA_MESSAGE,
      comparisons,
      limitations: [
        hasResearch
          ? 'Доступны только исследовательские результаты: модели не допущены к научному сравнению или сопоставимость ограничена. Числовые значения показаны для информации и не являются нормативными отклонениями.'
          : 'Модели найдены, но ни одна не даёт пригодного числового сравнения.',
      ],
    };
  }

  // Нормативные результаты возвращаются по каждой допущенной модели отдельно;
  // усреднение z-оценок разных исследований не выполняется.
  return {
    metricId,
    status: 'ok',
    value,
    unit: metric.unit,
    direction: metric.direction,
    comparisons,
    uncertainty: [
      'Результаты приведены отдельно по каждой допущенной модели; объединение z-оценок не выполнялось.',
      metric.interpretationLimits,
    ].filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Главная точка входа
// ---------------------------------------------------------------------------

/**
 * Полный анализ профиля спортсмена.
 *
 * @param {object} athlete — объект спортсмена ({ id, name, age, sex, qualification,
 *        competitionLevel, weightCategory, examinationProtocol, ... })
 * @param {object|null} physData — данные формы box_phys_<id> (или null)
 * @param {object} options
 * @param {string[]} [options.metricIds] — ограничить анализ перечнем показателей;
 *                                         по умолчанию — все количественные из каталога
 * @returns объект отчёта анализатора
 */
export function analyzeAthleteProfile(athlete = {}, physData = null, options = {}) {
  const cohort = buildAthleteCohort(athlete);
  const competition = summarizeCompetitionMetrics(athlete.id, {
    history: options.competitionHistory,
  });
  const competitionMetricIds = new Set(COMPETITION_METRIC_IDS);
  const longitudinal = buildLongitudinalReport(athlete, physData, options);
  const metricIds =
    options.metricIds ||
    METRICS_CATALOG.filter((m) => m.validation.type === 'number').map((m) => m.id);

  const validation = {};
  const comparisons = {};
  const summary = {
    metricsRequested: metricIds.length,
    metricsOk: 0,
    metricsMissing: 0,
    metricsInvalid: 0,
    metricsCompared: 0,
    metricsResearchOnly: 0,
    metricsInsufficientData: 0,
  };

  for (const metricId of metricIds) {
    const rawValue = competitionMetricIds.has(metricId)
      ? physData?.[metricId] ?? competition.metrics[metricId]?.value
      : physData?.[metricId];
    const v = validateMetricValue(metricId, rawValue);
    validation[metricId] = v;

    if (v.status === 'unknown') continue;
    if (v.status === 'missing') {
      summary.metricsMissing += 1;
      comparisons[metricId] = {
        metricId,
        status: 'missing_data',
        message: 'Данные отсутствуют; подстановка значений не выполняется.',
        policy: v.policy,
      };
      continue;
    }
    if (v.status === 'invalid') {
      summary.metricsInvalid += 1;
      comparisons[metricId] = {
        metricId,
        status: 'invalid_data',
        message: 'Значение не прошло валидацию; сравнение с моделями не выполняется.',
        issues: v.issues,
      };
      continue;
    }

    summary.metricsOk += 1;
    const cmp = compareWithReferenceModels(metricId, v.value, cohort);
    comparisons[metricId] = cmp;
    if (cmp.status === 'ok') summary.metricsCompared += 1;
    if (cmp.status === 'insufficient_data') {
      summary.metricsInsufficientData += 1;
      if (cmp.comparisons?.some((c) => c.status === 'research_result')) {
        summary.metricsResearchOnly += 1;
      }
    }
  }

  return {
    athlete: {
      id: athlete.id ?? null,
      name: athlete.name ?? null,
      age: athlete.age ?? null,
      style: athlete.style ?? null,
    },
    cohort,
    cohortLimitations: [
      cohort.sex == null ? 'Пол спортсмена не указан — совместимость по полу неустановлена.' : null,
      cohort.qualification == null ? 'Квалификация не указана — совместимость по квалификации неустановлена.' : null,
      cohort.competitionLevel == null ? 'Соревновательный уровень не указан.' : null,
      cohort.weightCategory == null ? 'Весовая категория не указана — совместимость по весу неустановлена.' : null,
      cohort.ageGroup == null ? 'Возраст вне документированных групп (AGE_GROUP_RULES) — сопоставимых когорт нет.' : null,
      cohort.protocol == null ? 'Протокол обследования не указан — совместимость по протоколу неустановлена.' : null,
    ].filter(Boolean),
    summary,
    competition,
    longitudinal,
    validation,
    comparisons,
    globalDisclaimer:
      'Все референтные модели проекта имеют статус «' +
      DATA_QUALITY_STATUSES.unverified.labelRu +
      '» и не допущены к научному сравнению. Числовые результаты носят ' +
      'исследовательский характер, не являются нормативными отклонениями и ' +
      'не должны использоваться для автоматических рекомендаций до ' +
      'верификации источников и документированного допуска моделей.',
  };
}

const LONGITUDINAL_PHYSICAL_METRICS = [
  'vo2maxRel',
  'reactionTime',
  'relPower',
  'fatigueIndex',
  'rightPunch',
  'leftPunch',
  'punches3min',
  'diffError',
];

function parseLongitudinalDate(value, fallbackIndex = 0) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const ruDate = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const parsed = ruDate
      ? new Date(Number(ruDate[3]), Number(ruDate[2]) - 1, Number(ruDate[1]))
      : new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.getTime();
  }
  return fallbackIndex;
}

/**
 * Формирует интервальный профиль: каждый период связывает показатели боя
 * с последним доступным физическим тестированием и его нормативным статусом.
 * Это намеренно не усредняет разнородные единицы измерения в один score.
 */
export function buildLongitudinalReport(athlete = {}, physData = null, options = {}) {
  const competition = summarizeCompetitionMetrics(athlete.id, {
    history: options.competitionHistory,
  });
  const physicalHistory = Array.isArray(options.physHistory) ? options.physHistory : [];
  const currentPhysical = physData && typeof physData === 'object' ? physData : null;
  const events = [
    ...competition.observations.map((observation, index) => ({
      kind: 'competition',
      date: observation.date,
      timestamp: parseLongitudinalDate(observation.date, index),
      observation,
    })),
    ...physicalHistory.map((entry, index) => {
      const data = entry?.data ?? entry?.physData ?? entry?.values ?? null;
      const date = entry?.date ?? entry?.recordedAt ?? entry?.createdAt ?? null;
      return {
        kind: 'physical',
        date,
        timestamp: parseLongitudinalDate(date, competition.observations.length + index),
        data: data && typeof data === 'object' ? data : null,
      };
    }),
  ].filter((event) => event.observation || event.data);

  if (events.length === 0 && currentPhysical) {
    events.push({
      kind: 'physical',
      date: options.currentDate ?? null,
      timestamp: parseLongitudinalDate(options.currentDate, 0),
      data: currentPhysical,
    });
  }

  events.sort((a, b) => a.timestamp - b.timestamp);
  let latestPhysical = null;
  const physicalFallback = physicalHistory.length === 0 ? currentPhysical : null;
  const periods = events.map((event, index) => {
    if (event.kind === 'physical') latestPhysical = event.data;
    const physical = latestPhysical ?? physicalFallback;
    const competitionValues = event.observation?.values ?? {};
    const physicalValues = {};
    for (const metricId of LONGITUDINAL_PHYSICAL_METRICS) {
      const value = physical?.[metricId];
      physicalValues[metricId] = Number.isFinite(value) ? value : null;
    }

    const competitionValuesPresent = COMPETITION_METRIC_IDS.filter(
      (metricId) => Number.isFinite(competitionValues[metricId]),
    );
    const physicalValuesPresent = LONGITUDINAL_PHYSICAL_METRICS.filter(
      (metricId) => Number.isFinite(physicalValues[metricId]),
    );

    return {
      id: event.observation?.fightId ?? `period_${index + 1}`,
      date: event.date ?? null,
      timestamp: event.timestamp,
      source: event.kind,
      competition: competitionValues,
      physical: physicalValues,
      coverage: {
        competition: competitionValuesPresent.length / COMPETITION_METRIC_IDS.length,
        physical: physicalValuesPresent.length / LONGITUDINAL_PHYSICAL_METRICS.length,
      },
      available: {
        competition: competitionValuesPresent,
        physical: physicalValuesPresent,
      },
    };
  });

  const delta = {};
  for (const metricId of [...COMPETITION_METRIC_IDS, ...LONGITUDINAL_PHYSICAL_METRICS]) {
    const values = periods
      .map((period) => period.competition[metricId] ?? period.physical[metricId])
      .filter((value) => Number.isFinite(value));
    const firstValue = values[0] ?? null;
    const lastValue = values.at(-1) ?? null;
    delta[metricId] =
      Number.isFinite(firstValue) && Number.isFinite(lastValue) ? lastValue - firstValue : null;
  }

  return {
    athleteId: athlete.id ?? null,
    periods,
    delta,
    metricGroups: {
      competition: [...COMPETITION_METRIC_IDS],
      physical: [...LONGITUDINAL_PHYSICAL_METRICS],
    },
    source: {
      competitionRecords: competition.source.records,
      competitionPeriods: competition.observations.length,
      physicalRecords: physicalHistory.length + (currentPhysical && physicalHistory.length === 0 ? 1 : 0),
    },
  };
}
