/**
 * Тесты валидатора staging-пакета научных данных (node:test).
 *
 * Проверяются только сам валидатор и его правила. Фикстуры создаются во
 * временном каталоге ОС; исходный пакет в data/research-staging не читается
 * и не изменяется.
 *
 * Запуск: node --test tests/researchStagingValidator.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  validateResearchStagingPackage,
  DEFAULT_PACKAGE_DIR,
} from '../scripts/validate-research-staging.mjs';

function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

const STUDY = {
  studyId: 'B001',
  year: 1995,
  verificationStatus: 'not_reverified_during_normalization',
  provenance: { sourceFile: 'source.xlsx', sheet: 'Исследования', row: 2 },
};

const COHORT = {
  cohortId: 'cohort_B001',
  studyId: 'B001',
  provenance: { sourceFile: 'source.xlsx', sheet: 'Исследования', row: 2 },
};

const PROTOCOL = {
  protocolId: 'protocol_summary_B001',
  studyId: 'B001',
  provenance: { sourceFile: 'source.xlsx', sheet: 'Исследования', row: 2 },
};

const OBSERVATION = {
  observationId: 'M001',
  studyId: 'B001',
  studyCohortId: 'cohort_B001',
  protocolSummaryId: 'protocol_summary_B001',
  metricIdCandidate: 'metriccand_1',
  numericalUseStatus: 'not_approved_for_reference_model',
  verificationStatus: 'not_reverified_during_normalization',
  sourceProvenance: { sourceFile: 'source.xlsx', sheet: 'Результаты', row: 2 },
};

const METRIC_CANDIDATE = {
  metricIdCandidate: 'metriccand_1',
  normalizationStatus: 'candidate_not_harmonized',
  appMetricId: null,
  harmonizationNote: 'Требуется экспертное подтверждение.',
  provenanceRows: ['Результаты!2'],
};

const MODEL_CANDIDATE = {
  modelCandidateId: 'MC001',
  candidateStudyId: 'B001',
  sourceCandidateId: 'MSC001',
  normalizationStatus: 'candidate_only_manual_review_required',
  referenceModelEligible: false,
  candidateNumericParse: { numericTokens: [1, 2], candidateCentralValue: 1, candidateDispersion: 2, dispersionType: null },
  provenance: { sourceFile: 'models.xlsx', sheet: 'Таблица данных', row: 2 },
};

const SOURCE_CANDIDATE = {
  sourceCandidateId: 'MSC001',
  candidateStudyId: 'B001',
  citationYearCandidate: 1995,
  yearConflict: false,
  verificationStatus: 'not_reverified_during_normalization',
  provenance: { sourceFile: 'models.xlsx', sheet: 'Источники', row: 2 },
};

const REVIEW_TASK = {
  taskId: 'review_MC001',
  recordType: 'modelCandidate',
  recordId: 'MC001',
  studyIdCandidate: 'B001',
  sourceCandidateId: 'MSC001',
  sourceFile: 'models.xlsx',
  sourceRow: 2,
};

const FIELD_MAPPING = [
  {
    sourceFile: 'source.xlsx',
    sourceSheet: 'Результаты',
    sourceField: 'Value',
    targetEntity: 'observation',
    targetField: 'valueReported',
  },
];

function buildManifest(counts) {
  return {
    packageName: 'fixture',
    stage: 'staging_not_production',
    sourceFiles: [
      { file: 'source.xlsx', studies: counts.studies, resultRows: counts.observations },
      { file: 'models.xlsx', modelDataRows: counts.modelCandidates, sourceRows: counts.externalSourceCandidates },
    ],
    counts: { ...counts, referenceModelsPromoted: 0, allScientificRecordsReverifiedDuringNormalization: false },
    integrityChecks: {
      observation_count: counts.observations,
      duplicate_observation_ids: 0,
      duplicate_study_ids: 0,
      duplicate_model_candidate_ids: 0,
    },
  };
}

/**
 * Создаёт минимальный корректный пакет во временном каталоге.
 * `override` позволяет заменить отдельные файлы (SQL-подобный патч для тестов).
 */
function makeFixture(override = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'box-staging-'));
  mkdirSync(path.join(root, 'data'), { recursive: true });
  mkdirSync(path.join(root, 'reports'), { recursive: true });
  mkdirSync(path.join(root, 'source_files'), { recursive: true });

  const records = {
    studies: [STUDY],
    cohorts: [COHORT],
    protocols: [PROTOCOL],
    observations: [OBSERVATION],
    metricCandidates: [METRIC_CANDIDATE],
    modelCandidates: [MODEL_CANDIDATE],
    externalSourceCandidates: [SOURCE_CANDIDATE],
    reviewQueue: [REVIEW_TASK],
  };

  const counts = {
    studies: records.studies.length,
    observations: records.observations.length,
    metricCandidates: records.metricCandidates.length,
    modelCandidates: records.modelCandidates.length,
    externalSourceCandidates: records.externalSourceCandidates.length,
    reviewQueue: records.reviewQueue.length,
  };

  const files = {
    'README_IMPORT.md': '# fixture',
    'reports/normalization_report.md': '# fixture',
    'reports/integrity_check.json': jsonText(buildManifest(counts).integrityChecks),
    'data/import_manifest.json': jsonText(buildManifest(counts)),
    'data/studies.json': jsonText(records.studies),
    'data/cohorts.json': jsonText(records.cohorts),
    'data/protocols.json': jsonText(records.protocols),
    'data/observations.json': jsonText(records.observations),
    'data/metric_candidates.json': jsonText(records.metricCandidates),
    'data/model_candidates.json': jsonText(records.modelCandidates),
    'data/external_source_candidates.json': jsonText(records.externalSourceCandidates),
    'data/review_queue.json': jsonText(records.reviewQueue),
    'data/field_mapping.json': jsonText(FIELD_MAPPING),
    'source_files/source_checksums.json': jsonText({}),
    ...override,
  };

  for (const [relativePath, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(root, relativePath), content);
  }
  return root;
}

function validate(root) {
  return validateResearchStagingPackage(root);
}

function checks(result) {
  return result.errors.map((e) => e.check);
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Корректный пакет
// ---------------------------------------------------------------------------

test('корректная фикстура проходит проверку', async () => {
  const root = makeFixture();
  try {
    const result = await validate(root);
    assert.equal(result.ok, true, result.errors.map((e) => e.message).join('\n'));
    assert.equal(result.counts.observations, 1);
  } finally {
    cleanup(root);
  }
});

test('отсутствующий каталог пакета — ошибка без создания файлов', async () => {
  const missing = path.join(tmpdir(), 'box-staging-does-not-exist-123');
  const result = await validate(missing);
  assert.equal(result.ok, false);
  assert.ok(checks(result).includes('package'));
});

// ---------------------------------------------------------------------------
// Структура и JSON
// ---------------------------------------------------------------------------

test('некорректный JSON и отсутствующий файл обнаруживаются', async () => {
  const root = makeFixture({
    'data/protocols.json': '{ broken',
    'data/field_mapping.json': null,
  });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(checks(result).includes('required_files'));
    assert.ok(checks(result).includes('json_structure'));
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Манифест и отчёт о целостности
// ---------------------------------------------------------------------------

test('расхождение счётчиков манифеста обнаруживается', async () => {
  const counts = {
    studies: 1,
    observations: 216,
    metricCandidates: 1,
    modelCandidates: 1,
    externalSourceCandidates: 1,
    reviewQueue: 1,
  };
  const manifest = buildManifest(counts);
  manifest.integrityChecks.observation_count = 216;
  const root = makeFixture({
    'data/import_manifest.json': jsonText(manifest),
    'reports/integrity_check.json': jsonText(manifest.integrityChecks),
  });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(checks(result).includes('manifest_counts'));
    assert.ok(result.errors.some((e) => /counts\.observations = 216/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

test('повышение referenceModelsPromoted обнаруживается', async () => {
  const counts = {
    studies: 1,
    observations: 1,
    metricCandidates: 1,
    modelCandidates: 1,
    externalSourceCandidates: 1,
    reviewQueue: 1,
  };
  const manifest = buildManifest(counts);
  manifest.counts.referenceModelsPromoted = 2;
  const root = makeFixture({ 'data/import_manifest.json': jsonText(manifest) });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.check === 'status_escalation' && /referenceModelsPromoted/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Уникальность и ссылки
// ---------------------------------------------------------------------------

test('дубликаты идентификаторов обнаруживаются', async () => {
  const duplicateObservations = [OBSERVATION, { ...OBSERVATION }];
  const counts = {
    studies: 1,
    observations: 2,
    metricCandidates: 1,
    modelCandidates: 1,
    externalSourceCandidates: 1,
    reviewQueue: 1,
  };
  const manifest = buildManifest(counts);
  const root = makeFixture({
    'data/observations.json': jsonText(duplicateObservations),
    'data/import_manifest.json': jsonText(manifest),
    'reports/integrity_check.json': jsonText(manifest.integrityChecks),
  });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.check === 'unique_ids' && /M001/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

test('битые ссылки на исследование, когорту, протокол и кандидата показателя обнаруживаются', async () => {
  const observation = {
    ...OBSERVATION,
    studyId: 'B999',
    studyCohortId: 'cohort_404',
    protocolSummaryId: 'protocol_404',
    metricIdCandidate: 'metriccand_404',
  };
  const root = makeFixture({ 'data/observations.json': jsonText([observation]) });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    const messages = result.errors.filter((e) => e.check === 'references').map((e) => e.message);
    for (const field of ['studyId', 'studyCohortId', 'protocolSummaryId', 'metricIdCandidate']) {
      assert.ok(messages.some((m) => m.includes(field)), `не найдена ошибка ссылки ${field}`);
    }
  } finally {
    cleanup(root);
  }
});

test('ссылка наблюдения на когорту другого исследования обнаруживается', async () => {
  const cohort = { ...COHORT, cohortId: 'cohort_other', studyId: 'B002' };
  const study = { ...STUDY, studyId: 'B002' };
  const root = makeFixture({
    'data/studies.json': jsonText([STUDY, study]),
    'data/cohorts.json': jsonText([COHORT, cohort]),
    'data/observations.json': jsonText([{ ...OBSERVATION, studyCohortId: 'cohort_other' }]),
  });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.check === 'cross_study' && /когорта/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

test('задача ревью с несуществующей записью обнаруживается', async () => {
  const root = makeFixture({
    'data/review_queue.json': jsonText([{ ...REVIEW_TASK, recordId: 'MC999' }]),
  });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.check === 'references' && /MC999/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Статусы и происхождение
// ---------------------------------------------------------------------------

test('непроверенное наблюдение не может быть допущено к нормативному сравнению', async () => {
  const observation = { ...OBSERVATION, numericalUseStatus: 'approved_for_reference_model' };
  const root = makeFixture({ 'data/observations.json': jsonText([observation]) });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.check === 'status_escalation' && /M001/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

test('кандидат модельного ориентира не может быть допущен автоматически', async () => {
  const candidate = { ...MODEL_CANDIDATE, referenceModelEligible: true };
  const root = makeFixture({ 'data/model_candidates.json': jsonText([candidate]) });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.check === 'status_escalation' && /referenceModelEligible/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

test('знак ± не может быть назначен стандартным отклонением без проверки', async () => {
  const candidate = {
    ...MODEL_CANDIDATE,
    candidateNumericParse: { ...MODEL_CANDIDATE.candidateNumericParse, dispersionType: 'SD' },
  };
  const root = makeFixture({ 'data/model_candidates.json': jsonText([candidate]) });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /стандартное отклонение/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

test('кандидат показателя не может быть автоматически сопоставлен с каталогом', async () => {
  const metric = { ...METRIC_CANDIDATE, appMetricId: 'density' };
  const root = makeFixture({ 'data/metric_candidates.json': jsonText([metric]) });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /appMetricId/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

test('пропущенное происхождение записи обнаруживается', async () => {
  const cohort = { ...COHORT };
  delete cohort.provenance;
  const metric = { ...METRIC_CANDIDATE };
  delete metric.provenanceRows;
  const root = makeFixture({
    'data/cohorts.json': jsonText([cohort]),
    'data/metric_candidates.json': jsonText([metric]),
  });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    const provenanceErrors = result.errors.filter((e) => e.check === 'provenance');
    assert.ok(provenanceErrors.some((e) => /cohort_B001/.test(e.message)));
    assert.ok(provenanceErrors.some((e) => /provenanceRows/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

test('несовпадение года кандидата источника и исследования обнаруживается', async () => {
  const source = { ...SOURCE_CANDIDATE, citationYearCandidate: 2006, yearConflict: false };
  const root = makeFixture({
    'data/external_source_candidates.json': jsonText([source]),
  });
  try {
    const result = await validate(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.check === 'year_conflict' && /MSC001/.test(e.message)));
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// Исходный пакет проекта
// ---------------------------------------------------------------------------

test('исходный пакет проекта виден валидатору по умолчанию', () => {
  assert.equal(DEFAULT_PACKAGE_DIR, path.join('data', 'research-staging', 'BOX_PROFILE_normalized_import'));
});
