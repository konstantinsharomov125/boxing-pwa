/**
 * Адаптер соревновательных данных (шаг 4 дорожной карты).
 *
 * Связывает историю боёв в `localStorage` (`box_fights_history_<athleteId>`)
 * с расчётными показателями каталога METRICS_CATALOG категории 'competition':
 * density, keu, kv, а также вспомогательными jabsAcc и powerAcc.
 *
 * Зачем нужен адаптер:
 *  - формулы плотности, КЭУ и КВ были встроены в компонент BoxDataView, а
 *    анализатор их не видел вовсе — соревновательные показатели не попадали
 *    в научное сравнение;
 *  - запись боя хранила только округлённые итоги, поэтому значения нельзя
 *    было ни пересчитать, ни проверить по первичным данным;
 *  - здесь формулы живут в одном месте: их использует и сохранение боя, и
 *    анализ; неприменимое значение возвращается null, а не подставным 0 или 1.00.
 *
 * Принципы (совпадают с принципами fullAnalyzer.js):
 *  - отсутствующие данные не заменяются нулями: неприменимое значение — null;
 *  - поточная раскладка имеет приоритет над сохранёнными итогами: если в
 *    записи есть rounds, показатели пересчитываются из неё;
 *  - запись с недостоверными числами (отрицательные удары, «в цель» больше,
 *    чем «всего», неконечные значения) отклоняется целиком и попадает в
 *    rejected с причиной, а не «чинится» подстановкой;
 *  - значение показателя по боям и разброс между боями — разные величины:
 *    разброс между боями НЕ является стандартным отклонением референтной
 *    модели и не участвует в z-оценках;
 *  - единицы измерения берутся из каталога: адаптер не изобретает своих.
 *
 * Схема записи истории (новая, формируется buildFightRecord):
 * {
 *   id: number,                 // метка времени создания
 *   date: string,               // «дд.мм.гггг» для таблицы
 *   opponent: string,
 *   format: { roundsCount: number | null, roundDurationMin: number | null },
 *   rounds: [{ id, jabsTotal, jabsTarget, powerTotal, powerTarget }],
 *   totalPunches, targetPunches, density, jabsAcc, keu, kv   // итоговые числа
 * }
 * Старые записи (без format/rounds) читаются как stored_summary: значения
 * берутся из сохранённых полей, пересчёт невозможен — это отражается в
 * provenance и в ограничениях отчёта.
 */

import { getMetricById } from '../data/modelsConfig.js';

/** Префикс ключа истории боёв в localStorage. */
export const FIGHT_HISTORY_KEY_PREFIX = 'box_fights_history_';

/** Показатели категории «соревновательная деятельность», которые считает адаптер. */
export const COMPETITION_METRIC_IDS = ['density', 'keu', 'kv', 'jabsAcc', 'powerAcc'];

/** Дроби, по которым взвешивается метрика при агрегировании нескольких боёв. */
const POOLING = {
  density: { numerator: 'punches', denominator: 'minutes' },
  keu: { numerator: 'target', denominator: 'punches' },
  jabsAcc: { numerator: 'jabsTarget', denominator: 'jabs' },
  powerAcc: { numerator: 'powerTarget', denominator: 'power' },
  // kv — отношение активностей первого и финального раунда, в одну дробь
  // не сводится: только среднее по боям.
  kv: null,
};

/** Знаков после запятой для отображения (презентация, не расчёт). */
const DISPLAY_PRECISION = { density: 1, keu: 2, kv: 2, jabsAcc: 1, powerAcc: 1 };

// ---------------------------------------------------------------------------
// Мелкие утилиты
// ---------------------------------------------------------------------------

function safeGetItem(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Конечное число из number/строки; всё остальное — null (нули не подставляются). */
function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

/** Целое число ударов: конечное, ≥ 0; дробное или отрицательное — null. */
function toCount(value) {
  const num = toFiniteNumber(value);
  if (num === null) return null;
  return Number.isInteger(num) && num >= 0 ? num : null;
}

function roundTo(value, digits) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Выборочное стандартное отклонение (n − 1), как в остальном коде проекта. */
function sampleStats(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  const n = nums.length;
  if (n === 0) return { n: 0, mean: null, sd: null, sem: null, min: null, max: null };
  const mean = nums.reduce((acc, v) => acc + v, 0) / n;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (n < 2) return { n, mean, sd: null, sem: null, min, max };
  const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  return { n, mean, sd, sem: sd / Math.sqrt(n), min, max };
}

// ---------------------------------------------------------------------------
// 1. Формулы: один источник правды для интерфейса, сохранения боя и анализа
// ---------------------------------------------------------------------------

/**
 * Считает показатели одного боя по поточной раскладке.
 *
 * @param {object} input
 * @param {Array<{jabsTotal, jabsTarget, powerTotal, powerTarget}>} input.rounds
 * @param {number} [input.roundsCount] — заявленное число раундов (по умолчанию — длина rounds)
 * @param {number|null} [input.roundDurationMin] — длительность раунда в минутах
 * @returns {{
 *   totals: object, minutes: number|null, playedRounds: number,
 *   values: { density: number|null, keu: number|null, kv: number|null,
 *             jabsAcc: number|null, powerAcc: number|null },
 *   issues: string[]
 * }}
 */
export function computeBoutMetrics(input = {}) {
  const rounds = Array.isArray(input.rounds) ? input.rounds.filter((r) => r && typeof r === 'object') : [];
  const issues = [];

  let jabs = 0;
  let jabsTarget = 0;
  let power = 0;
  let powerTarget = 0;
  let punches = 0;
  let target = 0;

  for (const round of rounds) {
    const rJabs = toCount(round.jabsTotal);
    const rJabsTarget = toCount(round.jabsTarget);
    const rPower = toCount(round.powerTotal);
    const rPowerTarget = toCount(round.powerTarget);

    if (rJabs === null || rJabsTarget === null || rPower === null || rPowerTarget === null) {
      issues.push(`Раунд ${round.id ?? '—'}: счётчики ударов должны быть целыми числами не меньше нуля.`);
      continue;
    }
    if (rJabsTarget > rJabs) {
      issues.push(`Раунд ${round.id ?? '—'}: джебов в цель (${rJabsTarget}) больше, чем всего джебов (${rJabs}).`);
    }
    if (rPowerTarget > rPower) {
      issues.push(`Раунд ${round.id ?? '—'}: силовых в цель (${rPowerTarget}) больше, чем всего силовых (${rPower}).`);
    }

    jabs += rJabs;
    jabsTarget += rJabsTarget;
    power += rPower;
    powerTarget += rPowerTarget;
    punches += rJabs + rPower;
    target += rJabsTarget + rPowerTarget;
  }

  // Заявленное число раундов не должно расходиться с фактической таблицей
  const declaredRounds = toCount(input.roundsCount);
  if (declaredRounds !== null && declaredRounds !== rounds.length) {
    issues.push(`Заявлено раундов: ${declaredRounds}, в записи: ${rounds.length} — плотность считана по фактической таблице.`);
  }
  const roundsCount = rounds.length > 0 ? rounds.length : declaredRounds;

  const durationMin = toFiniteNumber(input.roundDurationMin);
  let minutes = null;
  if (durationMin !== null && durationMin > 0 && roundsCount > 0) {
    minutes = roundsCount * durationMin;
  } else if (punches > 0) {
    issues.push('Длительность раунда не задана — плотность боя не рассчитывается.');
  }

  const density = minutes !== null && minutes > 0 && punches > 0 ? punches / minutes : null;
  const keu = punches > 0 ? target / punches : null;
  const jabsAcc = jabs > 0 ? (jabsTarget / jabs) * 100 : null;
  const powerAcc = power > 0 ? (powerTarget / power) * 100 : null;

  // КВ: активность (удары в цель) первого и финального сыгранного раунда.
  // Финальным считается последний раунд с ненулевой активностью: пустые строки
  // таблицы (бой окончен досрочно, лишние раунды не заданы) не дают деления на
  // ноль и фиктивного значения 1.00.
  const activities = rounds
    .map((r) => {
      const t = toCount(r.jabsTarget);
      const p = toCount(r.powerTarget);
      return t !== null && p !== null ? t + p : null;
    })
    .filter((v) => v !== null);
  const played = activities.filter((v) => v > 0);
  const first = played.length > 0 ? played[0] : null;
  const last = played.length > 0 ? played[played.length - 1] : null;

  let kv = null;
  if (first !== null && last !== null && last > 0) {
    kv = first / last;
  } else if (punches > 0) {
    issues.push('Нет ни одного раунда с попаданием в цель — КВ не рассчитывается.');
  }
  if (played.length === 1 && kv !== null) {
    issues.push('КВ по одному сыгранному раунду неинформативен: первое и последнее значения совпадают.');
  }

  return {
    totals: { punches, target, jabs, jabsTarget, power, powerTarget },
    minutes,
    playedRounds: played.length,
    values: { density, keu, kv, jabsAcc, powerAcc },
    issues,
  };
}

/**
 * Собирает запись истории боёв в том виде, в каком её сохраняет BoxDataView.
 * Итоговые поля округляются для таблицы, но первичные данные (rounds, format)
 * сохраняются, чтобы адаптер мог пересчитать и проверить показатели.
 *
 * @param {object} input { rounds, roundsCount, roundDurationMin, opponent, date, id }
 */
export function buildFightRecord(input = {}) {
  const rounds = Array.isArray(input.rounds) ? input.rounds : [];
  const bout = computeBoutMetrics({
    rounds,
    roundsCount: input.roundsCount,
    roundDurationMin: input.roundDurationMin,
  });

  return {
    id: input.id ?? Date.now(),
    date: input.date ?? new Date().toLocaleDateString('ru-RU'),
    opponent: input.opponent || 'Турнирный бой',
    format: {
      roundsCount: toCount(input.roundsCount) ?? (rounds.length > 0 ? rounds.length : null),
      roundDurationMin: toFiniteNumber(input.roundDurationMin),
    },
    rounds: rounds.map((r) => ({
      id: r.id,
      jabsTotal: toCount(r.jabsTotal) ?? 0,
      jabsTarget: toCount(r.jabsTarget) ?? 0,
      powerTotal: toCount(r.powerTotal) ?? 0,
      powerTarget: toCount(r.powerTarget) ?? 0,
    })),
    totalPunches: bout.totals.punches,
    targetPunches: bout.totals.target,
    density: roundTo(bout.values.density, DISPLAY_PRECISION.density),
    jabsAcc: roundTo(bout.values.jabsAcc, DISPLAY_PRECISION.jabsAcc),
    powerAcc: roundTo(bout.values.powerAcc, DISPLAY_PRECISION.powerAcc),
    keu: roundTo(bout.values.keu, DISPLAY_PRECISION.keu),
    kv: roundTo(bout.values.kv, DISPLAY_PRECISION.kv),
  };
}

// ---------------------------------------------------------------------------
// 2. Чтение истории боёв
// ---------------------------------------------------------------------------

/** Ключ хранилища с историей боёв спортсмена. */
export function fightsHistoryKey(athleteId) {
  return `${FIGHT_HISTORY_KEY_PREFIX}${athleteId}`;
}

/**
 * Читает историю боёв из localStorage.
 * Повреждённый JSON или невыбранный спортсмен — пустой список с причиной:
 * анализ не должен падать из-за битой записи.
 */
export function loadFightsHistory(athleteId) {
  const storageKey = athleteId === null || athleteId === undefined ? null : fightsHistoryKey(athleteId);
  if (!storageKey) {
    return { storageKey: null, records: [], parseError: 'Спортсмен не выбран — история боёв недоступна.' };
  }
  const raw = safeGetItem(storageKey);
  if (!raw) return { storageKey, records: [], parseError: null };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { storageKey, records: [], parseError: 'История боёв повреждена (некорректный JSON) — показатели не рассчитаны.' };
  }
  if (!Array.isArray(parsed)) {
    return { storageKey, records: [], parseError: 'История боёв имеет неожиданный формат — ожидается массив записей.' };
  }
  return { storageKey, records: parsed, parseError: null };
}

/**
 * Нормализует одну запись истории в наблюдение для агрегирования.
 * Возвращает { ok, label, issues, observation }.
 */
export function normalizeFightRecord(raw, index = 0) {
  const label = raw && typeof raw === 'object' ? (raw.date || raw.opponent || `бой #${index + 1}`) : `бой #${index + 1}`;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, label, issues: ['Запись не является объектом статистики боя.'], observation: null };
  }

  const issues = [];
  const fightId = raw.id != null ? raw.id : `fight_${index + 1}`;

  // 1. Приоритет — поточная раскладка: показатели пересчитываются из неё
  const rounds = Array.isArray(raw.rounds) ? raw.rounds : null;
  if (rounds && rounds.length > 0) {
    const bout = computeBoutMetrics({
      rounds,
      roundsCount: raw.format?.roundsCount,
      roundDurationMin: raw.format?.roundDurationMin,
    });
    // Недостоверные первичные числа (отрицательные, дробные, «в цель» больше
    // «всего») делают запись непригодной: её нельзя ни показать, ни проверить.
    const fatal = bout.issues.filter((text) => /целыми числами|больше, чем/.test(text));
    if (fatal.length > 0) {
      return { ok: false, label, issues: bout.issues, observation: null };
    }
    return {
      ok: true,
      label,
      issues: bout.issues,
      observation: {
        fightId,
        date: raw.date ?? null,
        opponent: raw.opponent ?? null,
        provenance: 'rounds',
        recomputable: true,
        minutes: bout.minutes,
        punches: bout.totals.punches > 0 ? bout.totals.punches : null,
        target: bout.totals.punches > 0 ? bout.totals.target : null,
        jabs: bout.totals.jabs > 0 ? bout.totals.jabs : null,
        jabsTarget: bout.totals.jabs > 0 ? bout.totals.jabsTarget : null,
        power: bout.totals.power > 0 ? bout.totals.power : null,
        powerTarget: bout.totals.power > 0 ? bout.totals.powerTarget : null,
        values: bout.values,
      },
    };
  }

  // 2. Старый формат: только сохранённые итоги — пересчёт невозможен
  const stored = {
    density: toFiniteNumber(raw.density),
    keu: toFiniteNumber(raw.keu),
    kv: toFiniteNumber(raw.kv),
    jabsAcc: toFiniteNumber(raw.jabsAcc),
    powerAcc: toFiniteNumber(raw.powerAcc),
  };
  const punches = toFiniteNumber(raw.totalPunches);
  const target = toFiniteNumber(raw.targetPunches);

  for (const [metricId, value] of Object.entries(stored)) {
    const metric = getMetricById(metricId);
    if (value === null) continue;
    if (metric?.validation?.min != null && value < metric.validation.min) {
      issues.push(`${metric.nameRu}: сохранённое значение ${value} ниже каталожной границы ${metric.validation.min}.`);
    }
    if (metric?.validation?.max != null && value > metric.validation.max) {
      issues.push(`${metric.nameRu}: сохранённое значение ${value} выше каталожной границы ${metric.validation.max}.`);
    }
  }

  // Самопроверка сохранённого КЭУ по сохранённым же счётчикам
  if (punches !== null && punches > 0 && target !== null && stored.keu !== null) {
    const expected = target / punches;
    if (Math.abs(expected - stored.keu) > 0.01) {
      issues.push(
        `КЭУ в записи (${stored.keu}) не сходится с ударами (${target}/${punches} = ${roundTo(expected, 2)}) — ` +
        'первичные данные раундов утрачены, значение принято из сохранённого итога.',
      );
    }
  }

  const fatal = issues.filter((text) => /каталожной границы/.test(text));
  if (fatal.length > 0) {
    return { ok: false, label, issues, observation: null };
  }

  return {
    ok: true,
    label,
    issues,
    observation: {
      fightId,
      date: raw.date ?? null,
      opponent: raw.opponent ?? null,
      provenance: 'stored_summary',
      recomputable: false,
      minutes: null,
      punches: punches !== null && punches > 0 ? punches : null,
      target: punches !== null && punches > 0 ? target : null,
      jabs: null,
      jabsTarget: null,
      power: null,
      powerTarget: null,
      values: stored,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Агрегирование по боям
// ---------------------------------------------------------------------------

/**
 * Сводит историю боёв спортсмена к значениям показателей для анализатора.
 *
 * @param {number|string|null} athleteId
 * @param {object} [options]
 * @param {Array} [options.history] — готовый массив записей (тесты, вызов вне
 *        браузера); по умолчанию история читается из localStorage
 * @returns {object} соревновательный срез профиля
 */
export function summarizeCompetitionMetrics(athleteId, options = {}) {
  const source = options.history
    ? { storageKey: fightsHistoryKey(athleteId), records: options.history, parseError: null }
    : loadFightsHistory(athleteId);

  const limitations = [];
  if (source.parseError) limitations.push(source.parseError);

  const observations = [];
  const rejected = [];
  const warnings = [];

  source.records.forEach((raw, index) => {
    const normalized = normalizeFightRecord(raw, index);
    if (normalized.ok) {
      observations.push(normalized.observation);
      normalized.issues.forEach((text) => warnings.push(`${normalized.label}: ${text}`));
    } else {
      rejected.push({ index: index + 1, label: normalized.label, issues: normalized.issues });
    }
  });

  const metrics = {};
  for (const metricId of COMPETITION_METRIC_IDS) {
    const metric = getMetricById(metricId);
    const perFight = observations
      .map((obs, i) => ({
        fightId: obs.fightId,
        index: i + 1,
        date: obs.date,
        value: obs.values?.[metricId] ?? null,
        provenance: obs.provenance,
      }))
      .filter((row) => Number.isFinite(row.value));

    const stats = sampleStats(perFight.map((row) => row.value));

    // Взвешенное (пуловое) значение — если каждый пригодный бой даёт и
    // числитель, и знаменатель; иначе — среднее по боям.
    let pooled = null;
    let aggregation = 'mean';
    const pooling = POOLING[metricId];
    if (pooling && observations.length > 0) {
      let numerator = 0;
      let denominator = 0;
      let complete = true;
      for (const obs of observations) {
        const num = obs[pooling.numerator];
        const den = obs[pooling.denominator];
        if (num === null || num === undefined || den === null || den === undefined || den <= 0) {
          complete = false;
          break;
        }
        numerator += num;
        denominator += den;
      }
      if (complete && denominator > 0 && numerator > 0) {
        const ratio = numerator / denominator;
        pooled = metric?.unit === '%' ? ratio * 100 : ratio;
        aggregation = 'pooled';
      }
    }

    const value = pooled !== null ? pooled : stats.mean;
    const provenances = new Set(perFight.map((row) => row.provenance));

    metrics[metricId] = {
      metricId,
      nameRu: metric?.nameRu ?? metricId,
      unit: metric?.unit ?? null,
      value,
      displayValue: roundTo(value, DISPLAY_PRECISION[metricId] ?? 2),
      aggregation: perFight.length > 0 ? aggregation : null,
      n: stats.n,
      mean: stats.mean,
      sd: stats.sd,
      sem: stats.sem,
      min: stats.min,
      max: stats.max,
      perFight,
      provenance: provenances.size === 0 ? null : provenances.size > 1 ? 'mixed' : [...provenances][0],
    };
  }

  return {
    athleteId: athleteId ?? null,
    storageKey: source.storageKey,
    metrics,
    observations,
    rejected,
    warnings,
    limitations,
    source: {
      records: source.records.length,
      validRecords: observations.length,
      rejectedRecords: rejected.length,
      hasRoundData: observations.some((observation) => observation.provenance === 'rounds'),
      hasStoredSummaries: observations.some((observation) => observation.provenance === 'stored_summary'),
    },
  };
}
