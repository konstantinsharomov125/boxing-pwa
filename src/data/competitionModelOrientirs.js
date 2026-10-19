/**
 * Модельные ориентиры соревновательных показателей по квалификационным группам.
 *
 * Назначение: раздельное сравнение показателей спортсмена с доступными
 * точечными ориентирами. Это НЕ верифицированные референтные нормативы и
 * НЕ производные от научных моделей — см. статус каждого значения.
 *
 * Принципы:
 *  - для отсутствующих значений используется null, без интерполяции;
 *  - каждый ориентир хранит единицу измерения, группу, источник и статус;
 *  - статус 'author_hypothesis' означает авторскую точечную оценку без
 *    статистик распределения и официального нормативного источника;
 *  - статус 'unverified' — есть первичный источник, но он не сверен;
 *  - статус 'verified_fulltext' / 'verified_primary' — можно рассматривать
 *    как подтверждённый ориентир.
 */

import { QUALIFICATIONS } from './qualifications.js';

const METRIC_UNITS = {
  density: 'уд/мин',
  keu: 'усл.ед.',
  kv: 'усл.ед.',
  jabsAcc: '%',
  powerAcc: '%',
};

const BASE_METRICS = Object.keys(METRIC_UNITS);

const AUTHOR_SOURCE = 'Авторские точечные ориентиры (не верифицированы)';

function makeEntry(value, qualificationId, status) {
  return {
    value,
    unit: null,
    qualificationGroup: qualificationId,
    source: value === null ? null : AUTHOR_SOURCE,
    status,
  };
}

/**
 * Структура ориентиров по группам.
 * Существующие значения из BoxDataView.jsx сохранены для МСМК, МС/КМС,
 * 1-го разряда. Остальные группы оставлены с null — их нужно заполнить
 * подтверждёнными данными.
 */
const ORIENTIRS_BY_GROUP = {
  msmk: {
    name: 'МСМК',
    metrics: {
      density: makeEntry(14.5, 'msmk', 'author_hypothesis'),
      keu: makeEntry(0.38, 'msmk', 'author_hypothesis'),
      kv: makeEntry(1.05, 'msmk', 'author_hypothesis'),
      jabsAcc: makeEntry(42, 'msmk', 'author_hypothesis'),
      powerAcc: makeEntry(32, 'msmk', 'author_hypothesis'),
    },
  },
  ms: {
    name: 'МС',
    metrics: {
      density: makeEntry(12.8, 'ms', 'author_hypothesis'),
      keu: makeEntry(0.32, 'ms', 'author_hypothesis'),
      kv: makeEntry(1.18, 'ms', 'author_hypothesis'),
      jabsAcc: makeEntry(35, 'ms', 'author_hypothesis'),
      powerAcc: makeEntry(26, 'ms', 'author_hypothesis'),
    },
  },
  kms: {
    name: 'КМС',
    metrics: {
      density: makeEntry(null, 'kms', null),
      keu: makeEntry(null, 'kms', null),
      kv: makeEntry(null, 'kms', null),
      jabsAcc: makeEntry(null, 'kms', null),
      powerAcc: makeEntry(null, 'kms', null),
    },
  },
  first_rank: {
    name: 'I спортивный разряд',
    metrics: {
      density: makeEntry(11.2, 'first_rank', 'author_hypothesis'),
      keu: makeEntry(0.26, 'first_rank', 'author_hypothesis'),
      kv: makeEntry(1.35, 'first_rank', 'author_hypothesis'),
      jabsAcc: makeEntry(28, 'first_rank', 'author_hypothesis'),
      powerAcc: makeEntry(20, 'first_rank', 'author_hypothesis'),
    },
  },
  second_rank: {
    name: 'II спортивный разряд',
    metrics: {
      density: makeEntry(null, 'second_rank', null),
      keu: makeEntry(null, 'second_rank', null),
      kv: makeEntry(null, 'second_rank', null),
      jabsAcc: makeEntry(null, 'second_rank', null),
      powerAcc: makeEntry(null, 'second_rank', null),
    },
  },
  third_rank: {
    name: 'III спортивный разряд',
    metrics: {
      density: makeEntry(null, 'third_rank', null),
      keu: makeEntry(null, 'third_rank', null),
      kv: makeEntry(null, 'third_rank', null),
      jabsAcc: makeEntry(null, 'third_rank', null),
      powerAcc: makeEntry(null, 'third_rank', null),
    },
  },
  zms: {
    name: 'ЗМС',
    metrics: {
      density: makeEntry(null, 'zms', null),
      keu: makeEntry(null, 'zms', null),
      kv: makeEntry(null, 'zms', null),
      jabsAcc: makeEntry(null, 'zms', null),
      powerAcc: makeEntry(null, 'zms', null),
    },
  },
};

export const COMPETITION_METRICS = BASE_METRICS;

/** Группы ориентиров для UI: только те, что есть в справочнике. */
export function getOrientirGroups() {
  return QUALIFICATIONS.filter((q) => ORIENTIRS_BY_GROUP[q.id])
    .map((q) => ({
      id: q.id,
      name: ORIENTIRS_BY_GROUP[q.id].name,
    }));
}

/** Возвращает ориентир для группы и метрики или null-запись. */
export function getOrientirValue(groupId, metricId) {
  const group = ORIENTIRS_BY_GROUP[groupId];
  if (!group) return { value: null, unit: METRIC_UNITS[metricId] || null, qualificationGroup: groupId, source: null, status: null };
  const metric = group.metrics[metricId];
  if (!metric) return { value: null, unit: METRIC_UNITS[metricId] || null, qualificationGroup: groupId, source: null, status: null };
  return { ...metric, unit: METRIC_UNITS[metricId] || null };
}

/** Все ориентиры выбранной группы. */
export function getOrientirGroupValues(groupId) {
  const result = {};
  for (const metricId of BASE_METRICS) {
    result[metricId] = getOrientirValue(groupId, metricId);
  }
  return result;
}

/** Сравнение фактических показателей с ориентирами группы. */
export function getOrientirComparison(groupId, athleteValues) {
  const group = ORIENTIRS_BY_GROUP[groupId];
  const groupName = group?.name || groupId;
  const comparison = {};
  let hasAnyOrientir = false;

  for (const metricId of BASE_METRICS) {
    const orientir = getOrientirValue(groupId, metricId);
    const actual = athleteValues?.[metricId];
    const hasActual = typeof actual === 'number' && Number.isFinite(actual);
    if (orientir.value !== null) {
      hasAnyOrientir = true;
    }

    comparison[metricId] = {
      metricId,
      hasOrientir: orientir.value !== null,
      orientirValue: orientir.value,
      orientirUnit: orientir.unit,
      source: orientir.source,
      status: orientir.status,
      actualValue: hasActual ? actual : null,
      hasActual,
      missingReason:
        orientir.value === null
          ? 'Нет подтверждённого модельного ориентира'
          : !hasActual
            ? 'Нет фактических данных спортсмена'
            : null,
    };
  }

  return { groupId, groupName, hasAnyOrientir, comparison };
}

/** Список групп, у которых есть хотя бы один подтверждённый ориентир. */
export function getGroupsWithOrientirs() {
  return Object.entries(ORIENTIRS_BY_GROUP)
    .filter(([, group]) => Object.values(group.metrics).some((m) => m.value !== null))
    .map(([id]) => id);
}

/** Метаданные группы по id. */
export function getOrientirGroupName(groupId) {
  return ORIENTIRS_BY_GROUP[groupId]?.name || groupId;
}
