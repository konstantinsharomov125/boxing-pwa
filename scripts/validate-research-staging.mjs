#!/usr/bin/env node
/**
 * Проверка целостности staging-пакета научных данных BOX-PROFILE.
 *
 * Использование:
 *   node scripts/validate-research-staging.mjs [--package <путь>] [--json]
 *
 * По умолчанию проверяется каталог
 *   data/research-staging/BOX_PROFILE_normalized_import
 *
 * Скрипт только читает пакет и никогда не изменяет его файлы. Найденные
 * расхождения выводятся как ошибки (exit code 1), а не «исправляются».
 * Нормативные статусы не повышаются: любая запись, объявленная как
 * допущенная к нормативному сравнению или как reference model, считается
 * несоответствием схеме staging-пакета.
 */

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PACKAGE_DIR = path.join(
  'data',
  'research-staging',
  'BOX_PROFILE_normalized_import',
);

/** Обязательные файлы пакета и соответствующие счётчики манифеста. */
export const REQUIRED_FILES = [
  'README_IMPORT.md',
  'reports/normalization_report.md',
  'reports/integrity_check.json',
  'data/import_manifest.json',
  'data/studies.json',
  'data/cohorts.json',
  'data/protocols.json',
  'data/observations.json',
  'data/metric_candidates.json',
  'data/model_candidates.json',
  'data/external_source_candidates.json',
  'data/review_queue.json',
  'data/field_mapping.json',
  'source_files/source_checksums.json',
];

/** Файлы-массивы записей и ключ уникального идентификатора. */
const RECORD_SETS = {
  studies: { file: 'data/studies.json', idKey: 'studyId', countKey: 'studies' },
  cohorts: { file: 'data/cohorts.json', idKey: 'cohortId', countKey: null },
  protocols: { file: 'data/protocols.json', idKey: 'protocolId', countKey: null },
  observations: { file: 'data/observations.json', idKey: 'observationId', countKey: 'observations' },
  metricCandidates: {
    file: 'data/metric_candidates.json',
    idKey: 'metricIdCandidate',
    countKey: 'metricCandidates',
  },
  modelCandidates: {
    file: 'data/model_candidates.json',
    idKey: 'modelCandidateId',
    countKey: 'modelCandidates',
  },
  externalSourceCandidates: {
    file: 'data/external_source_candidates.json',
    idKey: 'sourceCandidateId',
    countKey: 'externalSourceCandidates',
  },
  reviewQueue: { file: 'data/review_queue.json', idKey: 'taskId', countKey: 'reviewQueue' },
};

/** Граф ссылок между сущностями пакета. */
const REFERENCES = [
  { from: 'cohorts', field: 'studyId', to: 'studies', required: true },
  { from: 'protocols', field: 'studyId', to: 'studies', required: true },
  { from: 'observations', field: 'studyId', to: 'studies', required: true },
  { from: 'observations', field: 'studyCohortId', to: 'cohorts', required: true },
  { from: 'observations', field: 'protocolSummaryId', to: 'protocols', required: true },
  { from: 'observations', field: 'metricIdCandidate', to: 'metricCandidates', required: true },
  { from: 'modelCandidates', field: 'candidateStudyId', to: 'studies', required: false },
  { from: 'modelCandidates', field: 'sourceCandidateId', to: 'externalSourceCandidates', required: false },
  { from: 'externalSourceCandidates', field: 'candidateStudyId', to: 'studies', required: false },
];

/** Типы записей очереди ревью → сущность, на которую ссылается recordId. */
const REVIEW_RECORD_TARGETS = {
  study: 'studies',
  observation: 'observations',
  cohort: 'cohorts',
  protocol: 'protocols',
  metricCandidate: 'metricCandidates',
  modelCandidate: 'modelCandidates',
  externalSourceCandidate: 'externalSourceCandidates',
};

/** Значения, при которых результат считается допущенным к нормативу. */
const ELEVATED_NUMERICAL_USE_STATUSES = new Set([
  'approved_for_reference_model',
  'reference_model',
  'normative',
  'approved',
]);

const ELEVATED_VERIFICATION_STATUSES = new Set(['verified_fulltext', 'verified_primary']);
const ELEVATED_NORMALIZATION_STATUSES = new Set(['harmonized', 'approved', 'matched', 'confirmed']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function describeSet(name) {
  return RECORD_SETS[name]?.file || name;
}

/**
 * Читает и разбирает JSON из пакета.
 * @returns {{ ok: true, value: any } | { ok: false, error: string }}
 */
async function readJson(packageDir, relativePath) {
  const absolute = path.join(packageDir, relativePath);
  let text;
  try {
    text = await readFile(absolute, 'utf8');
  } catch (error) {
    return { ok: false, error: `не удалось прочитать файл (${error.code || error.message})` };
  }
  try {
    return { ok: true, value: JSON.parse(text.replace(/^\uFEFF/, '')) };
  } catch (error) {
    return { ok: false, error: `некорректный JSON: ${error.message}` };
  }
}

function createCollector() {
  const errors = [];
  const warnings = [];
  return {
    errors,
    warnings,
    error: (check, message, context = null) => errors.push({ check, message, context }),
    warn: (check, message, context = null) => warnings.push({ check, message, context }),
  };
}

async function checkRequiredFiles(packageDir, report) {
  const present = {};
  for (const relativePath of REQUIRED_FILES) {
    const absolute = path.join(packageDir, relativePath);
    try {
      const info = await stat(absolute);
      present[relativePath] = info.isFile();
      if (!info.isFile()) {
        report.error('required_files', `${relativePath}: ожидался файл, найден каталог`);
      }
    } catch {
      present[relativePath] = false;
      report.error('required_files', `отсутствует обязательный файл: ${relativePath}`);
    }
  }
  return present;
}

async function loadRecords(packageDir, report) {
  const records = {};
  for (const [name, meta] of Object.entries(RECORD_SETS)) {
    const result = await readJson(packageDir, meta.file);
    if (!result.ok) {
      report.error('json_structure', `${meta.file}: ${result.error}`);
      records[name] = [];
      continue;
    }
    if (!Array.isArray(result.value)) {
      report.error('json_structure', `${meta.file}: ожидался массив записей`);
      records[name] = [];
      continue;
    }
    const invalid = result.value.filter((item) => !isPlainObject(item)).length;
    if (invalid > 0) {
      report.error('json_structure', `${meta.file}: ${invalid} элемент(ов) не являются объектами`);
    }
    records[name] = result.value.filter(isPlainObject);
  }
  return records;
}

function checkUniqueIds(records, report) {
  const idSets = {};
  for (const [name, meta] of Object.entries(RECORD_SETS)) {
    const seen = new Map();
    const duplicates = [];
    for (const record of records[name] || []) {
      const id = record[meta.idKey];
      if (!isNonEmptyString(id)) {
        report.error('unique_ids', `${meta.file}: запись без ${meta.idKey}`);
        continue;
      }
      if (seen.has(id)) duplicates.push(id);
      else seen.set(id, record);
    }
    for (const id of duplicates) {
      report.error('unique_ids', `${meta.file}: повторяющийся ${meta.idKey} «${id}»`);
    }
    idSets[name] = seen;
  }
  return idSets;
}

function checkReferences(records, idSets, report) {
  for (const ref of REFERENCES) {
    const targetIds = idSets[ref.to];
    if (!targetIds) continue;
    const missing = [];
    for (const record of records[ref.from] || []) {
      const value = record[ref.field];
      if (value == null || value === '') {
        if (ref.required) {
          missing.push(`${record[RECORD_SETS[ref.from].idKey]}: пустая ссылка ${ref.field}`);
        }
        continue;
      }
      if (!targetIds.has(value)) {
        missing.push(`${record[RECORD_SETS[ref.from].idKey]}: ${ref.field} = «${value}» не найдено в ${describeSet(ref.to)}`);
      }
    }
    for (const message of missing) {
      report.error('references', message, { from: ref.from, to: ref.to, field: ref.field });
    }
  }
}

function checkCrossStudyConsistency(records, idSets, report) {
  const studyOfRef = (setName, id) => idSets[setName]?.get(id)?.studyId ?? null;
  for (const observation of records.observations || []) {
    const id = observation.observationId;
    const cohortStudy = observation.studyCohortId
      ? studyOfRef('cohorts', observation.studyCohortId)
      : null;
    const protocolStudy = observation.protocolSummaryId
      ? studyOfRef('protocols', observation.protocolSummaryId)
      : null;
    if (cohortStudy && observation.studyId && cohortStudy !== observation.studyId) {
      report.error(
        'cross_study',
        `${id}: когорта «${observation.studyCohortId}» относится к исследованию ${cohortStudy}, а наблюдение — к ${observation.studyId}`,
      );
    }
    if (protocolStudy && observation.studyId && protocolStudy !== observation.studyId) {
      report.error(
        'cross_study',
        `${id}: протокол «${observation.protocolSummaryId}» относится к исследованию ${protocolStudy}, а наблюдение — к ${observation.studyId}`,
      );
    }
  }

  const studiesMap = idSets.studies;
  for (const source of records.externalSourceCandidates || []) {
    if (!source.candidateStudyId || !studiesMap) continue;
    const study = studiesMap.get(source.candidateStudyId);
    const studyYear = Number(study?.year);
    const candidateYear = Number(source.citationYearCandidate);
    const hasConflict = source.yearConflict === true;
    const actuallyConflicts =
      Number.isFinite(studyYear) && Number.isFinite(candidateYear) && studyYear !== candidateYear;
    if (actuallyConflicts && !hasConflict) {
      report.error(
        'year_conflict',
        `${source.sourceCandidateId}: год источника (${candidateYear}) не совпадает с годом исследования ${source.candidateStudyId} (${studyYear}), но yearConflict не отмечен`,
      );
    }
    if (!actuallyConflicts && hasConflict) {
      report.error(
        'year_conflict',
        `${source.sourceCandidateId}: отмечен yearConflict, но годы совпадают (${studyYear}) — требуется ручная проверка пометки`,
      );
    }
    if (hasConflict && source.reconciliationStatus !== 'unmatched_needs_reconciliation'
      && source.matchBasis != null) {
      report.warn(
        'year_conflict',
        `${source.sourceCandidateId}: yearConflict=true сохранён как кандидат на ручную сверку (matchBasis=${source.matchBasis}); автоматическое объединение запрещено`,
      );
    }
  }
}

function checkEvidenceStatuses(records, report) {

  for (const observation of records.observations || []) {
    const id = observation.observationId;
    if (ELEVATED_NUMERICAL_USE_STATUSES.has(observation.numericalUseStatus)) {
      report.error(
        'status_escalation',
        `${id}: numericalUseStatus = «${observation.numericalUseStatus}» — наблюдение staging-пакета не может быть допущено к нормативному сравнению`,
      );
    }
    if (ELEVATED_VERIFICATION_STATUSES.has(observation.verificationStatus)) {
      report.error(
        'status_escalation',
        `${id}: verificationStatus = «${observation.verificationStatus}» без независимой верификации по первоисточнику`,
      );
    }
  }

  for (const study of records.studies || []) {
    if (ELEVATED_VERIFICATION_STATUSES.has(study.verificationStatus)) {
      report.error(
        'status_escalation',
        `${study.studyId}: verificationStatus = «${study.verificationStatus}» без независимой верификации`,
      );
    }
  }

  for (const candidate of records.modelCandidates || []) {
    if (candidate.referenceModelEligible === true) {
      report.error(
        'status_escalation',
        `${candidate.modelCandidateId}: referenceModelEligible = true — кандидат модельного ориентира не может быть допущен автоматически`,
      );
    }
    if (ELEVATED_NORMALIZATION_STATUSES.has(candidate.normalizationStatus)) {
      report.error(
        'status_escalation',
        `${candidate.modelCandidateId}: normalizationStatus = «${candidate.normalizationStatus}» превышает staging-статус`,
      );
    }
    const parsed = candidate.candidateNumericParse;
    if (isPlainObject(parsed)) {
      if (parsed.dispersionType === 'SD' || parsed.dispersionType === 'sd') {
        report.error(
          'status_escalation',
          `${candidate.modelCandidateId}: знак ± истолкован как стандартное отклонение без проверки первоисточника`,
        );
      }
      if (parsed.candidateCentralValue != null && !Array.isArray(parsed.numericTokens)) {
        report.warn(
          'provenance',
          `${candidate.modelCandidateId}: числовое разложение без исходных numericTokens`,
        );
      }
    }
  }

  for (const metric of records.metricCandidates || []) {
    if (ELEVATED_NORMALIZATION_STATUSES.has(metric.normalizationStatus)) {
      report.error(
        'status_escalation',
        `${metric.metricIdCandidate}: normalizationStatus = «${metric.normalizationStatus}» — кандидат показателя сопоставляется с METRICS_CATALOG только вручную`,
      );
    }
    if (metric.appMetricId != null) {
      report.error(
        'status_escalation',
        `${metric.metricIdCandidate}: appMetricId = «${metric.appMetricId}» — автоматическое сопоставление с каталогом метрик отсутствует`,
      );
    }
  }

  const integrity = records.__integrityCheck;
  const manifest = records.__manifest;
  if (manifest) {
    if (Number(manifest.counts?.referenceModelsPromoted) !== 0) {
      report.error(
        'status_escalation',
        `import_manifest.json: referenceModelsPromoted = ${manifest.counts?.referenceModelsPromoted}, ожидается 0`,
      );
    }
    if (manifest.counts?.allScientificRecordsReverifiedDuringNormalization === true) {
      report.error(
        'status_escalation',
        'import_manifest.json: allScientificRecordsReverifiedDuringNormalization = true противоречит staging-статусу',
      );
    }
  }
  if (integrity && Object.keys(integrity).length === 0) {
    report.error('json_structure', 'reports/integrity_check.json пуст');
  }
}

function checkProvenance(records, report) {
  const perRecordSources = [
    'studies',
    'cohorts',
    'protocols',
    'modelCandidates',
    'externalSourceCandidates',
  ];
  for (const name of perRecordSources) {
    const provenanceKey = name === 'observations' ? 'sourceProvenance' : 'provenance';
    for (const record of records[name] || []) {
      const id = record[RECORD_SETS[name].idKey];
      const provenance = record[provenanceKey];
      if (!isPlainObject(provenance)) {
        report.error('provenance', `${describeSet(name)}: ${id} без объекта ${provenanceKey}`);
        continue;
      }
      if (!isNonEmptyString(provenance.sourceFile)) {
        report.error('provenance', `${describeSet(name)}: ${id} — не указан исходный файл`);
      }
      if (provenance.row == null) {
        report.error('provenance', `${describeSet(name)}: ${id} — не указана исходная строка`);
      }
    }
  }

  for (const observation of records.observations || []) {
    const provenance = observation.sourceProvenance;
    if (!isPlainObject(provenance)) {
      report.error('provenance', `observations: ${observation.observationId} без sourceProvenance`);
    }
  }

  for (const metric of records.metricCandidates || []) {
    if (!Array.isArray(metric.provenanceRows) || metric.provenanceRows.length === 0) {
      report.error(
        'provenance',
        `${metric.metricIdCandidate}: отсутствуют исходные локаторы provenanceRows`,
      );
    }
    if (!isNonEmptyString(metric.harmonizationNote)) {
      report.error(
        'provenance',
        `${metric.metricIdCandidate}: отсутствует harmonizationNote о ручном сопоставлении`,
      );
    }
  }

  for (const task of records.reviewQueue || []) {
    if (!isNonEmptyString(task.sourceFile) || task.sourceRow == null) {
      report.error(
        'provenance',
        `${task.taskId}: в задаче ревью не указан исходный файл или строка`,
      );
    }
    const target = REVIEW_RECORD_TARGETS[task.recordType];
    if (!target) {
      report.error('references', `${task.taskId}: неизвестный recordType «${task.recordType}»`);
      continue;
    }
    if (!isNonEmptyString(task.recordId)) {
      report.error('references', `${task.taskId}: пустой recordId`);
    }
  }
}

function checkReviewQueueReferences(records, idSets, report) {
  for (const task of records.reviewQueue || []) {
    const target = REVIEW_RECORD_TARGETS[task.recordType];
    if (!target || !isNonEmptyString(task.recordId)) continue;
    if (!idSets[target]?.has(task.recordId)) {
      report.error(
        'references',
        `${task.taskId}: recordId «${task.recordId}» не найден в ${describeSet(target)}`,
      );
    }
    if (task.studyIdCandidate != null && !idSets.studies?.has(task.studyIdCandidate)) {
      report.error(
        'references',
        `${task.taskId}: studyIdCandidate «${task.studyIdCandidate}» не найден в studies`,
      );
    }
    if (
      task.sourceCandidateId != null
      && !idSets.externalSourceCandidates?.has(task.sourceCandidateId)
    ) {
      report.error(
        'references',
        `${task.taskId}: sourceCandidateId «${task.sourceCandidateId}» не найден в external_source_candidates`,
      );
    }
  }
}

function checkManifestCounts(records, manifest, report) {
  if (!isPlainObject(manifest)) {
    report.error('json_structure', 'data/import_manifest.json: ожидался объект манифеста');
    return;
  }
  const counts = manifest.counts;
  if (!isPlainObject(counts)) {
    report.error('json_structure', 'data/import_manifest.json: отсутствует объект counts');
    return;
  }
  for (const [name, meta] of Object.entries(RECORD_SETS)) {
    if (!meta.countKey) continue;
    const declared = counts[meta.countKey];
    const actual = (records[name] || []).length;
    if (typeof declared !== 'number') {
      report.error('manifest_counts', `import_manifest.json: отсутствует counts.${meta.countKey}`);
    } else if (declared !== actual) {
      report.error(
        'manifest_counts',
        `import_manifest.json: counts.${meta.countKey} = ${declared}, фактически ${actual} в ${meta.file}`,
      );
    }
  }

  const firstSource = Array.isArray(manifest.sourceFiles) ? manifest.sourceFiles[0] : null;
  const secondSource = Array.isArray(manifest.sourceFiles) ? manifest.sourceFiles[1] : null;
  const pairs = [
    ['sourceFiles[0].studies', firstSource?.studies, counts.studies],
    ['sourceFiles[0].resultRows', firstSource?.resultRows, counts.observations],
    ['sourceFiles[1].modelDataRows', secondSource?.modelDataRows, counts.modelCandidates],
    ['sourceFiles[1].sourceRows', secondSource?.sourceRows, counts.externalSourceCandidates],
  ];
  for (const [label, a, b] of pairs) {
    if (typeof a === 'number' && typeof b === 'number' && a !== b) {
      report.error('manifest_counts', `import_manifest.json: ${label} = ${a}, counts = ${b}`);
    }
  }

  if (manifest.stage !== 'staging_not_production') {
    report.warn('manifest_stage', `import_manifest.json: stage = «${manifest.stage}», ожидается staging_not_production`);
  }
}

function checkIntegrityReport(records, manifest, integrity, report) {
  if (!isPlainObject(integrity)) {
    report.error('json_structure', 'reports/integrity_check.json: ожидался объект');
    return;
  }
  if (!isPlainObject(manifest?.integrityChecks)) {
    report.error('json_structure', 'import_manifest.json: отсутствует integrityChecks');
  } else {
    for (const [key, value] of Object.entries(integrity)) {
      const manifestValue = manifest.integrityChecks[key];
      if (manifestValue === undefined) {
        report.warn('integrity_report', `integrity_check.json: поле ${key} отсутствует в манифесте`);
      } else if (manifestValue !== value) {
        report.error(
          'integrity_report',
          `integrity_check.json: ${key} = ${value}, в манифесте ${manifestValue}`,
        );
      }
    }
  }

  if (typeof integrity.observation_count === 'number'
    && integrity.observation_count !== (records.observations || []).length) {
    report.error(
      'integrity_report',
      `integrity_check.json: observation_count = ${integrity.observation_count}, фактически ${(records.observations || []).length}`,
    );
  }

  for (const [key, value] of Object.entries(integrity)) {
    if (/^(duplicate_|observations_with_|model_candidates_with_unknown_|source_candidates_with_unknown_)/.test(key)
      && typeof value === 'number'
      && value !== 0) {
      report.error(
        'integrity_report',
        `integrity_check.json: ${key} = ${value} — заявленные расхождения требуют ручного анализа`,
      );
    }
  }
}

/**
 * Проверяет контрольные суммы исходных Excel-книг, если они присутствуют.
 * Отсутствие файла — предупреждение (в пакете остаётся checksums-файл).
 */
async function checkSourceChecksums(packageDir, report) {
  const checksums = await readJson(packageDir, 'source_files/source_checksums.json');
  if (!checksums.ok) {
    report.error('source_checksums', `source_files/source_checksums.json: ${checksums.error}`);
    return;
  }
  if (!isPlainObject(checksums.value)) {
    report.error('source_checksums', 'source_files/source_checksums.json: ожидался объект');
    return;
  }
  for (const [file, meta] of Object.entries(checksums.value)) {
    const absolute = path.join(packageDir, 'source_files', file);
    let buffer;
    try {
      buffer = await readFile(absolute);
    } catch {
      report.warn(
        'source_checksums',
        `исходный файл ${file} отсутствует в source_files — контрольная сумма не проверена`,
      );
      continue;
    }
    if (typeof meta?.bytes === 'number' && meta.bytes !== buffer.length) {
      report.error(
        'source_checksums',
        `${file}: размер ${buffer.length} байт не совпадает с заявленным ${meta.bytes}`,
      );
    }
    if (isNonEmptyString(meta?.sha256)) {
      const digest = createHash('sha256').update(buffer).digest('hex');
      if (digest !== meta.sha256) {
        report.error('source_checksums', `${file}: sha256 не совпадает с заявленным`);
      }
    } else {
      report.error('source_checksums', `${file}: в checksums нет sha256`);
    }
  }
}

/**
 * Полная проверка пакета. Ничего не пишет и не изменяет.
 * @param {string} packageDir — путь к каталогу пакета
 * @returns {Promise<{ok: boolean, packageDir: string, counts: object, errors: object[], warnings: object[]}>}
 */
export async function validateResearchStagingPackage(packageDir = DEFAULT_PACKAGE_DIR) {
  const report = createCollector();

  let dirOk = false;
  try {
    dirOk = (await stat(packageDir)).isDirectory();
  } catch {
    dirOk = false;
  }
  if (!dirOk) {
    report.error('package', `каталог пакета не найден: ${packageDir}`);
    return { ok: false, packageDir, counts: {}, errors: report.errors, warnings: report.warnings };
  }

  await checkRequiredFiles(packageDir, report);

  const records = await loadRecords(packageDir, report);

  const manifest = await readJson(packageDir, 'data/import_manifest.json');
  records.__manifest = manifest.ok ? manifest.value : null;
  if (!manifest.ok) report.error('json_structure', `data/import_manifest.json: ${manifest.error}`);

  const integrity = await readJson(packageDir, 'reports/integrity_check.json');
  records.__integrityCheck = integrity.ok ? integrity.value : null;
  if (!integrity.ok) report.error('json_structure', `reports/integrity_check.json: ${integrity.error}`);

  const idSets = checkUniqueIds(records, report);
  checkReferences(records, idSets, report);
  checkCrossStudyConsistency(records, idSets, report);
  checkReviewQueueReferences(records, idSets, report);
  checkEvidenceStatuses(records, report);
  checkProvenance(records, report);
  checkManifestCounts(records, records.__manifest, report);
  checkIntegrityReport(records, records.__manifest, records.__integrityCheck, report);
  await checkSourceChecksums(packageDir, report);

  const counts = {};
  for (const name of Object.keys(RECORD_SETS)) {
    counts[name] = (records[name] || []).length;
  }

  return {
    ok: report.errors.length === 0,
    packageDir,
    counts,
    errors: report.errors,
    warnings: report.warnings,
  };
}

function parseArgs(argv) {
  const args = { packageDir: DEFAULT_PACKAGE_DIR, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--package') args.packageDir = argv[i + 1] || DEFAULT_PACKAGE_DIR;
    if (argv[i] === '--json') args.json = true;
  }
  return args;
}

/** Вывод отчёта в консоль (без изменения данных). */
export function formatReport(result) {
  const lines = [];
  lines.push(`Пакет: ${result.packageDir}`);
  const counts = Object.entries(result.counts)
    .map(([name, value]) => `${name}=${value}`)
    .join(', ');
  if (counts) lines.push(`Записи: ${counts}`);
  lines.push(`Ошибки: ${result.errors.length}, предупреждения: ${result.warnings.length}`);
  for (const item of result.errors) lines.push(`  ✖ [${item.check}] ${item.message}`);
  for (const item of result.warnings) lines.push(`  ⚠ [${item.check}] ${item.message}`);
  lines.push(result.ok ? 'Итог: целостность пакета подтверждена.' : 'Итог: найдены несоответствия — импорт не должен выполняться.');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await validateResearchStagingPackage(args.packageDir);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReport(result)}\n`);
  }
  process.exitCode = result.ok ? 0 : 1;
}

function isInvokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

const invokedDirectly = isInvokedDirectly();

if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`Валидатор завершился с ошибкой: ${error.message}\n`);
    process.exitCode = 1;
  });
}
