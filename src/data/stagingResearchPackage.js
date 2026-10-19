/**
 * Доступ к staging-пакету научных данных для интерфейса просмотра.
 *
 * Источник — только нормализованные JSON из
 * `data/research-staging/BOX_PROFILE_normalized_import/data/`.
 * Excel-файлы (source_files/*.xlsx, reports/*.xlsx) намеренно НЕ импортируются:
 * они не нужны интерфейсу и не должны попадать в клиентскую сборку.
 *
 * Данные пакета — предварительные. Модуль только читает их для просмотра:
 *  - записи не подключаются к RESEARCH_DATABASE / getAllResearch() /
 *    REFERENCE_MODELS / METRICS_CATALOG / fullAnalyzer;
 *  - appMetricId не заполняется;
 *  - отсутствующее значение (null) и числовой ноль различаются явно
 *    (`displayNumeric` / `hasNumericValue`);
 *  - исходный текст результата сохраняется как есть.
 */

import studiesRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/studies.json';
import cohortsRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/cohorts.json';
import protocolsRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/protocols.json';
import observationsRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/observations.json';
import metricCandidatesRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/metric_candidates.json';
import modelCandidatesRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/model_candidates.json';
import externalSourceCandidatesRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/external_source_candidates.json';
import reviewQueueRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/review_queue.json';
import manifestRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/data/import_manifest.json';
import integrityRaw from '../../data/research-staging/BOX_PROFILE_normalized_import/reports/integrity_check.json';

export const STAGING_PACKAGE_LABEL = 'BOX-PROFILE — нормализованный пакет (staging)';

export const stagingStudies = Array.isArray(studiesRaw) ? studiesRaw : [];
export const stagingCohorts = Array.isArray(cohortsRaw) ? cohortsRaw : [];
export const stagingProtocols = Array.isArray(protocolsRaw) ? protocolsRaw : [];
export const stagingObservations = Array.isArray(observationsRaw) ? observationsRaw : [];
export const stagingMetricCandidates = Array.isArray(metricCandidatesRaw) ? metricCandidatesRaw : [];
export const stagingModelCandidates = Array.isArray(modelCandidatesRaw) ? modelCandidatesRaw : [];
export const stagingExternalSources = Array.isArray(externalSourceCandidatesRaw) ? externalSourceCandidatesRaw : [];
export const stagingReviewQueue = Array.isArray(reviewQueueRaw) ? reviewQueueRaw : [];
export const stagingManifest = manifestRaw ?? null;
export const stagingIntegrity = integrityRaw ?? null;

export const STAGING_STUDY_STATUS_LABELS = {
  not_reverified_during_normalization: 'Не перепроверено при нормализации',
};

export const STAGING_NUMERICAL_USE_LABELS = {
  not_approved_for_reference_model: 'Не допущено к референтной модели',
};

export const STAGING_RECONCILIATION_LABELS = {
  title_exact_match_review: 'Совпадение по названию — на проверку',
  doi_exact_match_review_metadata: 'Совпадение по DOI — на проверку метаданных',
  url_exact_match_review_metadata: 'Совпадение по URL — на проверку метаданных',
  unmatched_needs_reconciliation: 'Нет соответствия — нужна сверка',
};

/** Перевод служебных статусов пакета на русский; неизвестное — как есть. */
export function stagingLabel(labels, value) {
  if (value == null || value === '') return null;
  return labels[value] || String(value);
}

/**
 * Числовое поле для отображения.
 * null означает отсутствие значения и НЕ равен нулю.
 */
export function toStagingNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return { hasValue: false, value: null, display: null };
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return { hasValue: false, value: null, display: null };
  }
  return { hasValue: true, value: num, display: String(num) };
}

/** Исходная ссылка на первоисточник, если она задана в записи. */
export function getStagingSourceLink(record) {
  if (!record || typeof record !== 'object') return null;
  const url = record.sourceUrl || record.sourceUrlOriginal || record.urlOriginal || null;
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) return null;
  return url.trim();
}

/** Исходные идентификаторы/локаторы записи (файл, лист, строка). */
export function getStagingProvenance(record) {
  if (!record || typeof record !== 'object') return null;
  const provenance = record.provenance || record.sourceProvenance || null;
  if (!provenance || typeof provenance !== 'object') return null;
  return {
    sourceFile: provenance.sourceFile ?? null,
    sheet: provenance.sheet ?? provenance.sourceSheet ?? null,
    row: provenance.row ?? null,
    sourceRecordId: provenance.sourceRecordId ?? null,
  };
}

export function getStagingStudy(studyId) {
  return stagingStudies.find((s) => s.studyId === studyId) || null;
}

export function getStagingCohort(cohortId) {
  return stagingCohorts.find((c) => c.cohortId === cohortId) || null;
}

export function getStagingProtocol(protocolId) {
  return stagingProtocols.find((p) => p.protocolId === protocolId) || null;
}

export function getStagingMetricCandidate(metricIdCandidate) {
  return stagingMetricCandidates.find((m) => m.metricIdCandidate === metricIdCandidate) || null;
}

export function getStagingExternalSource(sourceCandidateId) {
  return stagingExternalSources.find((s) => s.sourceCandidateId === sourceCandidateId) || null;
}

export function getStagingModelCandidate(modelCandidateId) {
  return stagingModelCandidates.find((m) => m.modelCandidateId === modelCandidateId) || null;
}

export function getStagingObservation(observationId) {
  return stagingObservations.find((o) => o.observationId === observationId) || null;
}

/** Сводка по пакету: счётчики, статусы, предупреждения манифеста. */
export function getStagingSummary() {
  const counts = stagingManifest?.counts || {};
  const integrity = stagingIntegrity || stagingManifest?.integrityChecks || {};

  const observationsWithValue = stagingObservations.filter((o) => toStagingNumeric(o.valueReported).hasValue).length;
  const observationsWithoutValue = stagingObservations.length - observationsWithValue;

  return {
    stage: stagingManifest?.stage ?? null,
    packageVersion: stagingManifest?.packageVersion ?? null,
    createdAt: stagingManifest?.createdAt ?? null,
    counts: {
      studies: stagingStudies.length,
      cohorts: stagingCohorts.length,
      protocols: stagingProtocols.length,
      observations: stagingObservations.length,
      metricCandidates: stagingMetricCandidates.length,
      modelCandidates: stagingModelCandidates.length,
      externalSourceCandidates: stagingExternalSources.length,
      reviewQueue: stagingReviewQueue.length,
    },
    declaredCounts: counts,
    integrity,
    observationsWithValue,
    observationsWithoutValue,
    observationsWithSd: stagingObservations.filter((o) => toStagingNumeric(o.sdReported).hasValue).length,
    observationsWithoutSampleSize: stagingObservations.filter(
      (o) => !toStagingNumeric(o.sampleSizeReported).hasValue,
    ).length,
    sourceCandidatesWithYearConflict: stagingExternalSources.filter((s) => s.yearConflict === true).length,
    modelCandidatesEligible: stagingModelCandidates.filter((m) => m.referenceModelEligible === true).length,
    metricCandidatesAssignedToCatalog: stagingMetricCandidates.filter((m) => m.appMetricId != null).length,
    referenceModelsPromoted: counts.referenceModelsPromoted ?? null,
    importantWarnings: Array.isArray(stagingManifest?.importantWarnings) ? stagingManifest.importantWarnings : [],
    countsMatchManifest:
      Number(counts.studies) === stagingStudies.length
      && Number(counts.observations) === stagingObservations.length
      && Number(counts.metricCandidates) === stagingMetricCandidates.length
      && Number(counts.modelCandidates) === stagingModelCandidates.length
      && Number(counts.externalSourceCandidates) === stagingExternalSources.length
      && Number(counts.reviewQueue) === stagingReviewQueue.length,
  };
}

// ---------------------------------------------------------------------------
// Строки таблиц (унифицированные для поиска, фильтров и CSV)
// ---------------------------------------------------------------------------

function joinText(values) {
  return values
    .map((v) => (v == null ? '' : String(v)))
    .filter(Boolean)
    .join(' ');
}

/** Исследования: сводка + исходные поля. */
export function getStagingStudyRows() {
  return stagingStudies.map((study) => ({
    id: study.studyId,
    year: toStagingNumeric(study.year),
    title: study.titleOriginal ?? null,
    authors: study.authorsOriginal ?? null,
    journal: study.journalOriginal ?? null,
    doi: study.doiNormalized ?? study.doiOriginal ?? null,
    url: getStagingSourceLink(study),
    domain: study.domainOriginal ?? null,
    subdomain: study.subdomainOriginal ?? null,
    design: study.studyDesignOriginal ?? null,
    sample: study.sampleDescriptionOriginal ?? null,
    sex: study.sexDescriptionOriginal ?? null,
    age: study.ageDescriptionOriginal ?? null,
    qualification: study.qualificationOriginal ?? null,
    weight: study.weightDescriptionOriginal ?? null,
    methods: study.methodsDescriptionOriginal ?? null,
    outcomeSummary: study.outcomeSummaryOriginal ?? null,
    extractionDepth: study.extractionDepthReported ?? null,
    limitations: study.limitationsOriginal ?? null,
    verificationStatus: study.verificationStatus ?? null,
    reviewStatus: study.reviewStatus ?? null,
    provenance: getStagingProvenance(study),
    raw: study,
    searchText: joinText([
      study.studyId, study.year, study.titleOriginal, study.authorsOriginal, study.journalOriginal,
      study.doiOriginal, study.doiNormalized, study.domainOriginal, study.subdomainOriginal,
      study.qualificationOriginal, study.outcomeSummaryOriginal,
    ]).toLowerCase(),
  }));
}

/** Наблюдения и их числовые результаты. */
export function getStagingObservationRows() {
  return stagingObservations.map((observation) => {
    const value = toStagingNumeric(observation.valueReported);
    const sd = toStagingNumeric(observation.sdReported);
    const min = toStagingNumeric(observation.minReported);
    const max = toStagingNumeric(observation.maxReported);
    const metricCandidate = getStagingMetricCandidate(observation.metricIdCandidate);
    const study = getStagingStudy(observation.studyId);

    return {
      id: observation.observationId,
      studyId: observation.studyId ?? null,
      studyTitle: study?.titleOriginal ?? null,
      cohortId: observation.studyCohortId ?? null,
      protocolId: observation.protocolSummaryId ?? null,
      metricIdCandidate: observation.metricIdCandidate ?? null,
      metricName: metricCandidate?.nameOriginal ?? observation.indicatorOriginal ?? null,
      indicator: observation.indicatorOriginal ?? null,
      groupOrCondition: observation.groupOrConditionOriginal ?? null,
      domain: observation.domainOriginal ?? null,
      value,
      sd,
      min,
      max,
      unit: observation.unitOriginal ?? null,
      statisticType: observation.statisticTypeOriginal ?? null,
      comparison: observation.comparisonOrPOriginal ?? null,
      reportedResult: observation.reportedResultOriginal ?? null,
      caveat: observation.caveatOriginal ?? null,
      sampleSize: toStagingNumeric(observation.sampleSizeReported),
      sex: observation.sexOriginal ?? null,
      qualification: observation.qualificationOriginal ?? null,
      weightCategory: observation.weightCategoryOriginal ?? null,
      extractionDepth: observation.extractionDepthReported ?? null,
      numericalUseStatus: observation.numericalUseStatus ?? null,
      verificationStatus: observation.verificationStatus ?? null,
      url: getStagingSourceLink(observation) || getStagingSourceLink(study) || null,
      provenance: getStagingProvenance(observation),
      raw: observation,
      searchText: joinText([
        observation.observationId, observation.studyId, observation.indicatorOriginal,
        metricCandidate?.nameOriginal, observation.groupOrConditionOriginal,
        observation.domainOriginal, observation.unitOriginal,
      ]).toLowerCase(),
    };
  });
}

/** Кандидаты показателей (со статусом ручного сопоставления с каталогом). */
export function getStagingMetricCandidateRows() {
  return stagingMetricCandidates.map((metric) => ({
    id: metric.metricIdCandidate,
    name: metric.nameOriginal ?? null,
    domain: metric.domainOriginal ?? null,
    unit: metric.unitOriginal ?? null,
    definition: metric.definitionOriginal ?? null,
    normalizationStatus: metric.normalizationStatus ?? null,
    appMetricId: metric.appMetricId ?? null,
    harmonizationNote: metric.harmonizationNote ?? null,
    provenanceRows: Array.isArray(metric.provenanceRows) ? metric.provenanceRows : [],
    raw: metric,
    searchText: joinText([
      metric.metricIdCandidate, metric.nameOriginal, metric.domainOriginal,
      metric.unitOriginal, metric.definitionOriginal,
    ]).toLowerCase(),
  }));
}

/**
 * Кандидаты модельных характеристик.
 * Числовая подсказка парсера показывается отдельно от исходного текста:
 * `±` не интерпретируется как SD/SEM (dispersionType остаётся null).
 */
export function getStagingModelCandidateRows() {
  return stagingModelCandidates.map((candidate) => {
    const parsed = candidate.candidateNumericParse || {};
    return {
      id: candidate.modelCandidateId,
      direction: candidate.directionOriginal ?? null,
      citation: candidate.citationOriginal ?? null,
      url: getStagingSourceLink(candidate),
      population: candidate.populationDescriptionOriginal ?? null,
      indicator: candidate.indicatorOriginal ?? null,
      reportedText: candidate.reportedNumericTextOriginal ?? null,
      styleNote: candidate.styleOrNoteOriginal ?? null,
      candidateCentralValue: toStagingNumeric(parsed.candidateCentralValue),
      candidateDispersion: toStagingNumeric(parsed.candidateDispersion),
      candidateUnit: parsed.candidateUnit ?? null,
      parsePattern: parsed.parsePattern ?? null,
      dispersionType: parsed.dispersionType ?? null,
      studyId: candidate.candidateStudyId ?? null,
      sourceCandidateId: candidate.sourceCandidateId ?? null,
      sourceMatchStatus: candidate.sourceMatchStatus ?? null,
      normalizationStatus: candidate.normalizationStatus ?? null,
      referenceModelEligible: candidate.referenceModelEligible === true,
      provenance: getStagingProvenance(candidate),
      raw: candidate,
      searchText: joinText([
        candidate.modelCandidateId, candidate.directionOriginal, candidate.citationOriginal,
        candidate.populationDescriptionOriginal, candidate.indicatorOriginal,
        candidate.reportedNumericTextOriginal,
      ]).toLowerCase(),
    };
  });
}

/** Сверка внешних источников с исследованиями основного реестра. */
export function getStagingExternalSourceRows() {
  return stagingExternalSources.map((source) => {
    const study = getStagingStudy(source.candidateStudyId);
    return {
      id: source.sourceCandidateId,
      citation: source.citationOriginal ?? null,
      title: source.titleCandidateOriginal ?? null,
      url: getStagingSourceLink(source),
      doi: source.doiCandidate ?? null,
      citationYear: toStagingNumeric(source.citationYearCandidate),
      candidateStudyId: source.candidateStudyId ?? null,
      candidateStudyYear: study ? toStagingNumeric(study.year) : { hasValue: false, value: null, display: null },
      matchBasis: source.matchBasis ?? null,
      reconciliationStatus: source.reconciliationStatus ?? null,
      yearConflict: source.yearConflict === true,
      reviewNotes: Array.isArray(source.reviewNotes) ? source.reviewNotes : [],
      requiresManualReview: source.requiresManualReview === true,
      verificationStatus: source.verificationStatus ?? null,
      provenance: getStagingProvenance(source),
      raw: source,
      searchText: joinText([
        source.sourceCandidateId, source.citationOriginal, source.titleCandidateOriginal,
        source.doiCandidate, source.matchBasis, source.reconciliationStatus,
      ]).toLowerCase(),
    };
  });
}

/** Очередь ручной проверки. */
export function getStagingReviewQueueRows() {
  return stagingReviewQueue.map((task) => ({
    id: task.taskId,
    priority: task.priority ?? null,
    recordType: task.recordType ?? null,
    recordId: task.recordId ?? null,
    studyIdCandidate: task.studyIdCandidate ?? null,
    sourceCandidateId: task.sourceCandidateId ?? null,
    indicator: task.indicator ?? null,
    rawValue: task.rawValue ?? null,
    reason: task.reason ?? null,
    sourceFile: task.sourceFile ?? null,
    sourceSheet: task.sourceSheet ?? null,
    sourceRow: task.sourceRow ?? null,
    status: task.status ?? null,
    raw: task,
    searchText: joinText([
      task.taskId, task.recordType, task.recordId, task.indicator, task.rawValue,
      task.reason, task.studyIdCandidate, task.sourceCandidateId,
    ]).toLowerCase(),
  }));
}

// ---------------------------------------------------------------------------
// CSV-экспорт (кандидаты показателей и очередь проверки)
// ---------------------------------------------------------------------------

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header, rows) {
  const lines = [header.map(csvCell).join(';')];
  for (const row of rows) lines.push(row.map(csvCell).join(';'));
  return `\uFEFF${lines.join('\r\n')}`;
}

/** CSV кандидатов показателей: ID, название, единица, статусы, происхождение. */
export function buildStagingMetricCandidatesCsv(rows = getStagingMetricCandidateRows()) {
  const header = [
    'metricIdCandidate',
    'Название',
    'Область',
    'Единица',
    'Определение',
    'Статус нормализации',
    'appMetricId (каталог приложения)',
    'Причина неопределённости',
    'Исходные локаторы',
  ];
  return toCsv(header, rows.map((row) => [
    row.id,
    row.name,
    row.domain,
    row.unit,
    row.definition,
    row.normalizationStatus,
    row.appMetricId ?? 'не сопоставлено',
    row.harmonizationNote,
    row.provenanceRows.join(' | '),
  ]));
}

/** CSV очереди проверки: задача, запись, причина, исходный файл/лист/строка. */
export function buildStagingReviewQueueCsv(rows = getStagingReviewQueueRows()) {
  const header = [
    'taskId',
    'Приоритет',
    'Тип записи',
    'ID записи',
    'Исследование (кандидат)',
    'Источник (кандидат)',
    'Показатель',
    'Исходное значение',
    'Причина проверки',
    'Исходный файл',
    'Лист',
    'Строка',
    'Статус',
  ];
  return toCsv(header, rows.map((row) => [
    row.id,
    row.priority,
    row.recordType,
    row.recordId,
    row.studyIdCandidate,
    row.sourceCandidateId,
    row.indicator,
    row.rawValue,
    row.reason,
    row.sourceFile,
    row.sourceSheet,
    row.sourceRow,
    row.status,
  ]));
}

export const STAGING_TABLES = [
  { id: 'studies', label: 'Исследования', count: stagingStudies.length },
  { id: 'observations', label: 'Наблюдения', count: stagingObservations.length },
  { id: 'metricCandidates', label: 'Кандидаты показателей', count: stagingMetricCandidates.length },
  { id: 'modelCandidates', label: 'Модельные характеристики', count: stagingModelCandidates.length },
  { id: 'externalSources', label: 'Сверка источников', count: stagingExternalSources.length },
  { id: 'reviewQueue', label: 'Очередь проверки', count: stagingReviewQueue.length },
];
