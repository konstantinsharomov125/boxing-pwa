/**
 * Тесты хранилища библиографических записей.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const {
  loadBibliography,
  addBibliographyEntries,
  deleteBibliographyEntry,
  updateBibliographyEntry,
  exportBibliographyJSON,
  importBibliographyFile,
} = await import('../src/data/bibliographyStore.js');

beforeEach(() => storage.clear());

function sampleEntry(overrides = {}) {
  return {
    sourceType: 'pubmed',
    sourceId: 'PMID:111',
    title: 'Reaction time in boxers',
    authors: ['Smith J.'],
    year: 2020,
    doi: '10.1000/example',
    pmid: '111',
    dataQualityStatus: 'abstract_only',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

test('loadBibliography возвращает пустой массив при отсутствии данных', () => {
  assert.deepEqual(loadBibliography(), []);
});

test('addBibliographyEntries добавляет валидные записи', () => {
  const result = addBibliographyEntries([sampleEntry()]);
  assert.equal(result.added.length, 1);
  assert.equal(result.skipped.length, 0);
  assert.equal(loadBibliography().length, 1);
  assert.ok(loadBibliography()[0].id.startsWith('bib_'));
});

test('addBibliographyEntries отклоняет дубликаты по DOI/PMID/sourceId', () => {
  addBibliographyEntries([sampleEntry()]);
  const result = addBibliographyEntries([sampleEntry({ sourceId: 'PMID:111' })]);
  assert.equal(result.added.length, 0);
  assert.equal(result.skipped.length, 1);
  assert.equal(loadBibliography().length, 1);
});

test('addBibliographyEntries не добавляет запись без идентификаторов и названия', () => {
  const result = addBibliographyEntries([{ sourceType: 'pubmed' }]);
  assert.equal(result.added.length, 0);
  assert.equal(result.skipped.length, 1);
});

test('deleteBibliographyEntry удаляет запись', () => {
  const { entries } = addBibliographyEntries([sampleEntry()]);
  const id = entries[0].id;
  deleteBibliographyEntry(id);
  assert.deepEqual(loadBibliography(), []);
});

test('updateBibliographyEntry изменяет поля', () => {
  const { entries } = addBibliographyEntries([sampleEntry()]);
  const id = entries[0].id;
  updateBibliographyEntry(id, { title: 'Updated' });
  const updated = loadBibliography().find((e) => e.id === id);
  assert.equal(updated.title, 'Updated');
  assert.ok(updated.updatedAt);
});

// ---------------------------------------------------------------------------
// Экспорт/импорт
// ---------------------------------------------------------------------------

test('exportBibliographyJSON формирует конверт BOX-PROFILE', () => {
  addBibliographyEntries([sampleEntry()]);
  const json = exportBibliographyJSON();
  const doc = JSON.parse(json);
  assert.equal(doc.app, 'BOX-PROFILE');
  assert.equal(doc.kind, 'box_bibliography');
  assert.equal(doc.version, 1);
  assert.equal(doc.count, 1);
});

test('importBibliographyFile принимает конверт и голый массив', () => {
  addBibliographyEntries([sampleEntry()]);
  const json = exportBibliographyJSON();
  storage.clear();

  const result = importBibliographyFile(json);
  assert.equal(result.ok, true);
  assert.equal(result.added, 1);
  assert.equal(loadBibliography().length, 1);

  const arr = JSON.parse(json).entries;
  const second = importBibliographyFile(JSON.stringify(arr));
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 1);
});

test('importBibliographyFile отклоняет чужой формат', () => {
  const result = importBibliographyFile(JSON.stringify({ kind: 'box_fights_history', entries: [] }));
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});

test('importBibliographyFile работает в режиме replace', () => {
  addBibliographyEntries([sampleEntry({ title: 'Old' })]);
  const incoming = JSON.stringify({
    app: 'BOX-PROFILE',
    kind: 'box_bibliography',
    version: 1,
    entries: [sampleEntry({ title: 'New', sourceId: 'PMID:222', doi: '10.1000/new', pmid: '222' })],
  });
  const result = importBibliographyFile(incoming, { mode: 'replace' });
  assert.equal(result.ok, true);
  assert.equal(result.added, 1);
  assert.equal(result.removed, 1);
  assert.equal(loadBibliography().length, 1);
  assert.equal(loadBibliography()[0].title, 'New');
});
