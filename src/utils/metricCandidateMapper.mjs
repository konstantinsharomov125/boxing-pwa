/**
 * Сопоставление кандидатов показателей staging-пакета с METRICS_CATALOG.
 *
 * Модуль изолирован: он читает `data/research-staging/.../metric_candidates.json`
 * и каталог из `src/data/modelsConfig.js`, но ничего не записывает в
 * приложение, не меняет METRICS_CATALOG и не влияет на расчёты спортсменов.
 *
 * Политика маппинга:
 *  - сопоставление автоматическое только при точном совпадении нормализованного
 *    названия и совместимой единицы измерения;
 *  - любое расхождение единиц, неоднозначность (несколько кандидатов или
 *    несколько метрик каталога) и отсутствие метрики в каталоге дают статус
 *    ручной проверки, а не guess;
 *  - статус `direct_match` означает «кандидат на экспертное подтверждение»,
 *    а не присвоение норматива;
 *  - научные ограничения пакета (numericalUseStatus, verificationStatus)
 *    никогда не переопределяются: модуль только читает их.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { METRICS_CATALOG } from '../data/modelsConfig.js';
import { USER_ENTRY_METRICS } from '../data/userResearchStore.js';

export const DEFAULT_METRIC_CANDIDATES_FILE = path.join(
  'data',
  'research-staging',
  'BOX_PROFILE_normalized_import',
  'data',
  'metric_candidates.json',
);

/** Статусы сопоставления. */
export const MAPPING_STATUS = {
  direct_match: 'direct_match',
  unit_conflict: 'unit_conflict',
  ambiguous: 'ambiguous',
  no_catalog_metric: 'no_catalog_metric',
  invalid_record: 'invalid_record',
};

/** Кандидаты, название которых требует экспертного разбора (не автосопоставление). */
export const OVERLAP_GUARDS = [
  {
    pattern: /количество ударов|ударов\s*\/\s*мин|удары\s+в\s+минуту/i,
    unitPattern: /^ударов?\s*\/\s*мин$|^уд\/мин$/i,
    catalogMetricIds: ['density', 'punches10s', 'punches3min'],
    note:
      '"Количество ударов" в уд/мин невозможно отнести к плотности боя, ударам за 10 с ' +
      'или за 3 мин без протокола: единица совпадает с density, но условия подсчёта не проверены.',
  },
  {
    pattern: /мл·кг⁻¹·мин⁻¹|мл\/мин\/кг/i,
    catalogMetricIds: ['vo2maxRel', 'aerobicThreshold'],
    note:
      'Единица VO₂ совпадает и с относительным МПК, и с аэробным порогом; ' +
      'без указания критерия порога/максимума сопоставление неоднозначно.',
  },
  {
    pattern: /^сила удара/i,
    catalogMetricIds: ['leftPunch', 'rightPunch', 'tonnage10s'],
    note:
      'Название «Сила удара» не различает руку, тип удара и единицу (Н или кг); ' +
      'каталоговые leftPunch/rightPunch используют кг.',
  },
];

export const MAPPING_STATUS_LABELS = {
  direct_match: 'Прямое соответствие (требует экспертного подтверждения)',
  unit_conflict: 'Совпадение названия, конфликт единиц измерения',
  ambiguous: 'Неоднозначное соответствие — требуется ручной выбор',
  no_catalog_metric: 'В каталоге нет метрики с таким названием',
  invalid_record: 'Запись кандидата некорректна',
};

/** Единицы, которые считаются эквивалентными для сопоставления. */
const EQUIVALENT_UNIT_GROUPS = [
  ['мл/мин/кг', 'мл·кг⁻¹·мин⁻¹', 'мл/кг/мин'],
  ['сек', 'с', 'с.'],
];

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[²₂]/g, '2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Каноническая единица для сравнения (без учёта пробелов и регистра). */
export function normalizeUnit(unit) {
  const raw = normalizeText(unit).replace(/\s/g, '');
  if (!raw) return null;
  for (const group of EQUIVALENT_UNIT_GROUPS) {
    if (group.some((candidate) => normalizeText(candidate).replace(/\s/g, '') === raw)) {
      return normalizeText(group[0]).replace(/\s/g, '');
    }
  }
  return raw;
}

/** Совместимы ли две единицы измерения. */
export function unitsCompatible(a, b) {
  const left = normalizeUnit(a);
  const right = normalizeUnit(b);
  if (!left || !right) return false;
  return left === right;
}

/** Индекс каталога по нормализованному названию → список метрик. */
export function buildCatalogIndex(catalog = METRICS_CATALOG) {
  const index = new Map();
  for (const metric of catalog) {
    const key = normalizeText(metric.nameRu);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(metric);
  }
  return index;
}

/**
 * Ищет защищающее правило для кандидата без точного совпадения названия.
 * Возвращает правило, если название пересекается с каталоговым показателем
 * по смыслу/единице, но требует ручного решения.
 */
export function findOverlapGuard(candidate) {
  const name = String(candidate?.nameOriginal ?? '');
  const unit = String(candidate?.unitOriginal ?? '').trim();
  return (
    OVERLAP_GUARDS.find(
      (guard) =>
        guard.pattern.test(name)
        || (guard.unitPattern && /удар/i.test(name) && guard.unitPattern.test(unit)),
    ) || null
  );
}

/**
 * Сопоставляет одного кандидата с каталогом.
 * @returns {{
 *   metricIdCandidate: string,
 *   status: string,
 *   appMetricId: string|null,
 *   candidates: Array<{ appMetricId: string, unit: string|null }>,
 *   reason: string,
 * }}
 */
export function mapCandidate(candidate, catalogIndex = buildCatalogIndex()) {
  if (!candidate || typeof candidate !== 'object') {
    return {
      metricIdCandidate: null,
      status: MAPPING_STATUS.invalid_record,
      appMetricId: null,
      candidates: [],
      reason: 'Запись кандидата не является объектом.',
    };
  }

  const id = candidate.metricIdCandidate ?? null;
  if (typeof id !== 'string' || !id.trim()) {
    return {
      metricIdCandidate: null,
      status: MAPPING_STATUS.invalid_record,
      appMetricId: null,
      candidates: [],
      reason: 'У кандидата отсутствует metricIdCandidate.',
    };
  }

  const catalogMatches = catalogIndex.get(normalizeText(candidate.nameOriginal)) || [];
  if (catalogMatches.length === 0) {
    const guard = findOverlapGuard(candidate);
    if (guard) {
      return {
        metricIdCandidate: id,
        status: MAPPING_STATUS.ambiguous,
        appMetricId: null,
        candidates: guard.catalogMetricIds.map((metricId) => ({ appMetricId: metricId, unit: null })),
        reason: `Точного названия в каталоге нет. ${guard.note}`,
      };
    }
    return {
      metricIdCandidate: id,
      status: MAPPING_STATUS.no_catalog_metric,
      appMetricId: null,
      candidates: [],
      reason: `В METRICS_CATALOG нет метрики с названием «${candidate.nameOriginal ?? '—'}».`,
    };
  }

  const unitCompatible = catalogMatches.filter((metric) =>
    unitsCompatible(metric.unit, candidate.unitOriginal),
  );
  const listed = catalogMatches.map((metric) => ({ appMetricId: metric.id, unit: metric.unit ?? null }));

  if (unitCompatible.length === 1 && catalogMatches.length === 1) {
    return {
      metricIdCandidate: id,
      status: MAPPING_STATUS.direct_match,
      appMetricId: unitCompatible[0].id,
      candidates: listed,
      reason:
        `Совпадают название «${unitCompatible[0].nameRu}» и единица измерения ` +
        `(${candidate.unitOriginal} ≙ ${unitCompatible[0].unit}). Требуется подтверждение эксперта.`,
    };
  }

  if (unitCompatible.length === 0) {
    return {
      metricIdCandidate: id,
      status: MAPPING_STATUS.unit_conflict,
      appMetricId: null,
      candidates: listed,
      reason:
        `Название совпадает с «${catalogMatches[0].nameRu}», но единица ` +
        `«${candidate.unitOriginal ?? '—'}» не совпадает с каталогом ` +
        `(${catalogMatches.map((m) => m.unit ?? '—').join(', ')}).`,
    };
  }

  return {
    metricIdCandidate: id,
    status: MAPPING_STATUS.ambiguous,
    appMetricId: null,
    candidates: listed,
    reason:
      `Найдено несколько вариантов сопоставления (${listed.map((c) => c.appMetricId).join(', ')}). ` +
      'Автоматический выбор не выполняется.',
  };
}

/**
 * Строит сводный отчёт по всем кандидатам.
 * Не изменяет ни каталог, ни кандидатов.
 */
export function buildMappingReport(candidates, catalog = METRICS_CATALOG) {
  const catalogIndex = buildCatalogIndex(catalog);
  const records = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    const mapping = mapCandidate(candidate, catalogIndex);
    return {
      metricIdCandidate: mapping.metricIdCandidate,
      nameOriginal: candidate?.nameOriginal ?? null,
      unitOriginal: candidate?.unitOriginal ?? null,
      domainOriginal: candidate?.domainOriginal ?? null,
      normalizationStatus: candidate?.normalizationStatus ?? null,
      appMetricIdExisting: candidate?.appMetricId ?? null,
      status: mapping.status,
      statusLabel: MAPPING_STATUS_LABELS[mapping.status],
      appMetricId: mapping.appMetricId,
      candidates: mapping.candidates,
      reason: mapping.reason,
    };
  });

  const byStatus = {};
  for (const record of records) {
    byStatus[record.status] = (byStatus[record.status] || 0) + 1;
  }

  const mappedMetricIds = new Set(records.filter((r) => r.status === MAPPING_STATUS.direct_match).map((r) => r.appMetricId));
  const catalogMetricIds = catalog.map((m) => m.id);

  const summary = {
    candidateCount: records.length,
    directMatchCount: byStatus[MAPPING_STATUS.direct_match] || 0,
    unitConflictCount: byStatus[MAPPING_STATUS.unit_conflict] || 0,
    ambiguousCount: byStatus[MAPPING_STATUS.ambiguous] || 0,
    noCatalogMetricCount: byStatus[MAPPING_STATUS.no_catalog_metric] || 0,
    invalidRecordCount: byStatus[MAPPING_STATUS.invalid_record] || 0,
    manualReviewCount: records.length - (byStatus[MAPPING_STATUS.direct_match] || 0),
    byStatus,
    catalogMetricCount: catalogMetricIds.length,
    catalogMetricsWithCandidate: catalogMetricIds.filter((id) => mappedMetricIds.has(id)),
    catalogMetricsWithoutCandidate: catalogMetricIds.filter((id) => !mappedMetricIds.has(id)),
    userEntryMetricsWithoutCandidate: USER_ENTRY_METRICS.filter((id) => !mappedMetricIds.has(id)),
    existingAppMetricIdsInCandidates: records.filter((r) => r.appMetricIdExisting != null).length,
    promotedToNormativeStatus: false,
    normalizedCatalogUntouched: true,
  };

  return { summary, records };
}

/** Читает metric_candidates.json; возвращает { ok, value } или { ok: false, error }. */
export async function loadMetricCandidates(filePath = DEFAULT_METRIC_CANDIDATES_FILE) {
  let text;
  try {
    text = await readFile(path.resolve(filePath), 'utf8');
  } catch (error) {
    return { ok: false, error: `не удалось прочитать ${filePath}: ${error.code || error.message}` };
  }
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    return { ok: false, error: `некорректный JSON в ${filePath}: ${error.message}` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: `${filePath}: ожидался массив кандидатов` };
  }
  return { ok: true, value: parsed };
}
