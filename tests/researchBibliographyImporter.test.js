/**
 * Тесты импортёра библиографии.
 *
 * Проверяются нормализация, дедупликация, журналирование и экспорт.
 * Реальные сетевые запросы не выполняются.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createBibliographyEntry,
  titleFingerprint,
  deduplicateBibliography,
  createImportLog,
  addQueryToLog,
  exportBibliographyJSON,
  exportBibliographyCSV,
  buildBibliographyExport,
  BIBLIOGRAPHY_FILE_KIND,
  BIBLIOGRAPHY_FILE_VERSION,
} from '../src/utils/researchBibliographyImporter.js';

function pubmedFixture() {
  return createBibliographyEntry({
    sourceType: 'pubmed',
    sourceId: 'PMID:12345678',
    title: 'Reaction time in elite boxers',
    authors: ['Smith J.', 'Doe A.'],
    year: 2020,
    journal: 'Journal of Sports Sciences',
    doi: '10.1234/example',
    pmid: '12345678',
  });
}

function europepmcFixture() {
  return createBibliographyEntry({
    sourceType: 'europepmc',
    sourceId: 'PMC1234567',
    title: 'Reaction time in elite boxers',
    authors: ['Smith J.', 'Doe A.'],
    year: 2020,
    journal: 'Journal of Sports Sciences',
    doi: '10.1234/example',
    pmid: '12345678',
    pmcid: 'PMC1234567',
  });
}

function openalexFixture() {
  return createBibliographyEntry({
    sourceType: 'openalex',
    sourceId: 'https://openalex.org/W123456789',
    title: 'Choice reaction time in boxers',
    authors: ['Brown B.'],
    year: 2021,
    journal: 'Sports Medicine Open',
    openAlexId: 'https://openalex.org/W123456789',
  });
}

function crossrefFixture() {
  return createBibliographyEntry({
    sourceType: 'crossref',
    sourceId: '10.5678/crossref',
    title: 'Psychomotor performance in boxing',
    authors: ['Lee C.'],
    year: 2022,
    journal: 'Frontiers in Psychology',
    doi: '10.5678/crossref',
    crossrefDoi: '10.5678/crossref',
  });
}

// ---------------------------------------------------------------------------
// Нормализация
// ---------------------------------------------------------------------------

test('createBibliographyEntry нормализует поля и ставит статус abstract_only при наличии аннотации', () => {
  const entry = createBibliographyEntry({
    sourceType: 'pubmed',
    sourceId: 'PMID:12345678',
    title: 'Reaction time in elite boxers',
    authors: ['Smith J.', 'Doe A.'],
    year: 2020,
    journal: 'Journal of Sports Sciences',
    doi: '10.1234/example',
    pmid: '12345678',
    abstract: 'Sample abstract.',
  });

  assert.equal(entry.sourceType, 'pubmed');
  assert.equal(entry.title, 'Reaction time in elite boxers');
  assert.deepEqual(entry.authors, ['Smith J.', 'Doe A.']);
  assert.equal(entry.year, 2020);
  assert.equal(entry.doi, '10.1234/example');
  assert.equal(entry.pmid, '12345678');
  assert.equal(entry.dataQualityStatus, 'abstract_only');
  assert.equal(entry.abstractOnly, true);
  assert.ok(Array.isArray(entry.limitations));
  assert.ok(entry.importedAt);
});

test('createBibliographyEntry отбрасывает пустые и слишком длинные значения', () => {
  const entry = createBibliographyEntry({
    sourceType: 'test',
    title: '   ',
    year: '2019.5',
    doi: null,
  });
  assert.equal(entry.title, null);
  assert.equal(entry.year, 2019);
  assert.equal(entry.doi, null);
});

test('titleFingerprint приводит заголовок к каноническому виду', () => {
  assert.equal(
    titleFingerprint('Reaction Time in Elite Boxers!'),
    'reaction time in elite boxers',
  );
  assert.equal(titleFingerprint(''), '');
  assert.equal(titleFingerprint('!!!'), '');
});

// ---------------------------------------------------------------------------
// Дедупликация
// ---------------------------------------------------------------------------

test('deduplicateBibliography удаляет дубликаты по DOI', () => {
  const a = pubmedFixture();
  const b = europepmcFixture();
  const { entries, duplicates } = deduplicateBibliography([a, b]);
  assert.equal(entries.length, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].reason, 'duplicate_doi');
});

test('deduplicateBibliography удаляет дубликаты по PMID', () => {
  const a = pubmedFixture();
  const b = createBibliographyEntry({
    sourceType: 'europepmc',
    sourceId: 'PMC-OTHER',
    title: 'Reaction time in elite boxers',
    pmid: '12345678',
  });
  const { entries, duplicates } = deduplicateBibliography([a, b]);
  assert.equal(entries.length, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].reason, 'duplicate_pmid');
});

test('deduplicateBibliography удаляет дубликаты по fingerprint заголовка', () => {
  const a = pubmedFixture();
  const b = createBibliographyEntry({
    sourceType: 'crossref',
    sourceId: 'other',
    title: 'Reaction Time in Elite Boxers',
  });
  const { entries, duplicates } = deduplicateBibliography([a, b]);
  assert.equal(entries.length, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].reason, 'duplicate_title');
});

test('deduplicateBibliography сохраняет уникальные записи', () => {
  const entries = [pubmedFixture(), openalexFixture(), crossrefFixture()];
  const result = deduplicateBibliography(entries);
  assert.equal(result.entries.length, 3);
  assert.equal(result.duplicates.length, 0);
});

// ---------------------------------------------------------------------------
// Журналирование
// ---------------------------------------------------------------------------

test('createImportLog создаёт структуру журнала', () => {
  const log = createImportLog();
  assert.ok(log.startedAt);
  assert.equal(log.finishedAt, null);
  assert.deepEqual(log.totals, { searched: 0, unique: 0, duplicates: 0, errors: 0 });
  assert.deepEqual(log.queries, []);
  assert.deepEqual(log.errors, []);
});

test('addQueryToLog фиксирует успешный и неуспешный запросы', () => {
  const log = createImportLog();
  addQueryToLog(log, { sourceType: 'pubmed', query: 'boxers reaction time', count: 5 });
  addQueryToLog(log, { sourceType: 'openalex', query: 'boxing', error: 'timeout' });

  assert.equal(log.queries.length, 2);
  assert.equal(log.totals.searched, 5);
  assert.equal(log.totals.errors, 1);
  assert.equal(log.errors[0].message, 'timeout');
});

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------

test('buildBibliographyExport формирует конверт BOX-PROFILE', () => {
  const entries = [pubmedFixture(), crossrefFixture()];
  const log = createImportLog();
  const doc = buildBibliographyExport(entries, log);

  assert.equal(doc.app, 'BOX-PROFILE');
  assert.equal(doc.kind, BIBLIOGRAPHY_FILE_KIND);
  assert.equal(doc.version, BIBLIOGRAPHY_FILE_VERSION);
  assert.equal(doc.count, 2);
  assert.equal(doc.entries.length, 2);
  assert.ok(doc.log);
});

test('exportBibliographyJSON возвращает корректный JSON', () => {
  const json = exportBibliographyJSON([pubmedFixture()], createImportLog());
  const doc = JSON.parse(json);
  assert.equal(doc.kind, BIBLIOGRAPHY_FILE_KIND);
  assert.equal(doc.entries[0].sourceType, 'pubmed');
});

test('exportBibliographyCSV содержит заголовки и экранирует значения', () => {
  const entry = createBibliographyEntry({
    sourceType: 'pubmed',
    title: 'Title, with comma',
    authors: ['Author "Quoted"', 'Another'],
    year: 2020,
  });
  const csv = exportBibliographyCSV([entry]);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('sourceType,sourceId,title'));
  assert.ok(lines[1].includes('"Title, with comma"'));
  assert.ok(lines[1].includes('Author ""Quoted""'));
});
