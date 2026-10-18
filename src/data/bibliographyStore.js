/**
 * Хранилище библиографических записей научной библиотеки.
 *
 * Записи сохраняются в localStorage под ключом `box_bibliography`.
 * Это библиографические карточки, полученные из открытых API или введённые
 * вручную. Они НЕ являются автоматически проверенными референтными моделями
 * и не подмешиваются в getAllResearch() без явной верификации пользователя.
 *
 * Схема записи:
 * {
 *   id: 'bib_<timestamp>_<counter>',
 *   sourceType: 'pubmed' | 'europepmc' | 'openalex' | 'crossref' | 'manual',
 *   sourceId: string,
 *   title: string|null,
 *   authors: string[],
 *   year: number|null,
 *   journal: string|null,
 *   abstract: string|null,
 *   doi: string|null,
 *   pmid: string|null,
 *   pmcid: string|null,
 *   openAlexId: string|null,
 *   crossrefDoi: string|null,
 *   url: string|null,
 *   language: string|null,
 *   keywords: string[],
 *   dataQualityStatus: 'metadata_only' | 'abstract_only' | ...,
 *   abstractOnly: boolean,
 *   hasFullText: boolean|null,
 *   extractedResults: boolean,
 *   admission: { eligibleForComparison: false, note: string },
 *   limitations: string[],
 *   importedAt: ISO,
 *   updatedAt: ISO,
 * }
 */

const STORAGE_KEY = 'box_bibliography';
const FILE_KIND = 'box_bibliography';
const FILE_VERSION = 1;
const MAX_IMPORT_ENTRIES = 2000;

import { DATA_QUALITY_STATUSES } from './modelsConfig.js';

let counter = 0;

function makeId() {
  counter += 1;
  return `bib_${Date.now()}_${counter.toString(36)}`;
}

function safeGetItem(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadBibliography() {
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e === 'object' && e.id) : [];
  } catch {
    return [];
  }
}

export function saveBibliography(list) {
  return safeSetItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

export function isValidDataStatus(status) {
  return Object.prototype.hasOwnProperty.call(DATA_QUALITY_STATUSES, status);
}

export function validateBibliographyEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    errors.push('Запись не является объектом.');
    return { valid: false, errors };
  }
  if (!entry.title && !entry.doi && !entry.pmid && !entry.sourceId) {
    errors.push('Запись должна содержать хотя бы одно из: название, DOI, PMID, sourceId.');
  }
  if (entry.year != null) {
    const currentYear = new Date().getFullYear();
    const y = Number(entry.year);
    if (!Number.isFinite(y) || y < 1500 || y > currentYear + 1) {
      errors.push(`Год публикации должен быть числом от 1500 до ${currentYear + 1}.`);
    }
  }
  if (!isValidDataStatus(entry.dataQualityStatus)) {
    errors.push('Недопустимый статус достоверности данных.');
  }
  return { valid: errors.length === 0, errors };
}

function normalizeBibliographyEntry(entry) {
  const now = new Date().toISOString();
  return {
    id: typeof entry.id === 'string' && entry.id.startsWith('bib_') ? entry.id : makeId(),
    sourceType: String(entry.sourceType || 'manual'),
    sourceId: entry.sourceId ? String(entry.sourceId) : null,
    title: entry.title ? String(entry.title) : null,
    authors: Array.isArray(entry.authors) ? entry.authors.filter(Boolean) : [],
    year: entry.year != null ? Number(entry.year) : null,
    journal: entry.journal ? String(entry.journal) : null,
    abstract: entry.abstract ? String(entry.abstract) : null,
    doi: entry.doi ? String(entry.doi) : null,
    pmid: entry.pmid ? String(entry.pmid) : null,
    pmcid: entry.pmcid ? String(entry.pmcid) : null,
    openAlexId: entry.openAlexId ? String(entry.openAlexId) : null,
    crossrefDoi: entry.crossrefDoi ? String(entry.crossrefDoi) : null,
    url: entry.url ? String(entry.url) : null,
    language: entry.language ? String(entry.language) : null,
    keywords: Array.isArray(entry.keywords) ? entry.keywords.filter(Boolean) : [],
    dataQualityStatus: isValidDataStatus(entry.dataQualityStatus) ? entry.dataQualityStatus : 'metadata_only',
    abstractOnly: Boolean(entry.abstractOnly ?? true),
    hasFullText: entry.hasFullText === true || entry.hasFullText === false ? entry.hasFullText : null,
    extractedResults: Boolean(entry.extractedResults),
    admission: {
      eligibleForComparison: false,
      note: entry.admission?.note || 'Библиографическая запись: допуск к сравнению требует верификации числовых результатов по первоисточнику.',
    },
    limitations: Array.isArray(entry.limitations) ? entry.limitations.map(String) : [],
    importedAt: entry.importedAt || now,
    updatedAt: now,
  };
}

export function addBibliographyEntries(entries, options = {}) {
  const existing = loadBibliography();
  const { mode = 'merge' } = options;
  const next = mode === 'replace' ? [] : existing.slice();
  const seenIds = new Set(next.map((e) => e.id));
  const seenDoi = new Set(next.map((e) => e.doi).filter(Boolean));
  const seenPmid = new Set(next.map((e) => e.pmid).filter(Boolean));
  const seenSourceId = new Set(next.map((e) => e.sourceId).filter(Boolean));

  const added = [];
  const removedCount = mode === 'replace' ? existing.length : 0;
  const skipped = [];

  for (const raw of entries) {
    const normalized = normalizeBibliographyEntry(raw);
    const duplicate =
      (normalized.doi && seenDoi.has(normalized.doi)) ||
      (normalized.pmid && seenPmid.has(normalized.pmid)) ||
      (normalized.sourceId && seenSourceId.has(normalized.sourceId)) ||
      seenIds.has(normalized.id);

    if (duplicate) {
      skipped.push(normalized);
      continue;
    }

    const validation = validateBibliographyEntry(normalized);
    if (!validation.valid) {
      skipped.push({ entry: normalized, reason: 'validation', errors: validation.errors });
      continue;
    }

    seenIds.add(normalized.id);
    if (normalized.doi) seenDoi.add(normalized.doi);
    if (normalized.pmid) seenPmid.add(normalized.pmid);
    if (normalized.sourceId) seenSourceId.add(normalized.sourceId);
    next.push(normalized);
    added.push(normalized);
  }

  const saved = saveBibliography(next);
  return { saved, added, skipped, removed: removedCount, entries: next };
}

export function deleteBibliographyEntry(id) {
  const list = loadBibliography().filter((e) => e.id !== id);
  saveBibliography(list);
  return list;
}

export function updateBibliographyEntry(id, patch) {
  const list = loadBibliography().map((e) => {
    if (e.id !== id) return e;
    const updated = { ...e, ...patch, id: e.id, updatedAt: new Date().toISOString() };
    if (!isValidDataStatus(updated.dataQualityStatus)) {
      updated.dataQualityStatus = e.dataQualityStatus;
    }
    return updated;
  });
  saveBibliography(list);
  return list.find((e) => e.id === id) || null;
}

export function buildBibliographyExport(entries = loadBibliography()) {
  const list = Array.isArray(entries) ? entries.filter((e) => e && e.id) : [];
  return {
    app: 'BOX-PROFILE',
    kind: FILE_KIND,
    version: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    count: list.length,
    entries: list,
  };
}

export function exportBibliographyJSON() {
  return JSON.stringify(buildBibliographyExport(), null, 2);
}

export function parseBibliographyFile(text) {
  const result = {
    ok: false,
    total: 0,
    entries: [],
    skipped: [],
    errors: [],
    warnings: [],
  };

  const raw = typeof text === 'string' ? text.replace(/^\uFEFF/, '') : '';
  if (!raw.trim()) {
    result.errors.push('Файл пуст.');
    return result;
  }

  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    result.errors.push('Файл не является корректным JSON.');
    return result;
  }

  let list;
  if (Array.isArray(doc)) {
    list = doc;
    result.warnings.push('Конверт BOX-PROFILE отсутствует — файл обработан как массив записей.');
  } else if (doc && typeof doc === 'object') {
    if (doc.kind != null && doc.kind !== FILE_KIND) {
      result.errors.push(`Неподдерживаемый формат файла: kind = «${doc.kind}».`);
      return result;
    }
    if (!Array.isArray(doc.entries)) {
      result.errors.push('В файле нет массива entries.');
      return result;
    }
    const version = Number(doc.version);
    if (Number.isFinite(version) && version > FILE_VERSION) {
      result.warnings.push(`Файл создан более новой версией приложения (v${version}).`);
    }
    list = doc.entries;
  } else {
    result.errors.push('Ожидался JSON-конверт библиографии или массив записей.');
    return result;
  }

  if (list.length > MAX_IMPORT_ENTRIES) {
    result.errors.push(`В файле ${list.length} записей — превышает лимит ${MAX_IMPORT_ENTRIES}.`);
    return result;
  }

  result.total = list.length;
  for (const item of list) {
    const normalized = normalizeBibliographyEntry(item);
    const validation = validateBibliographyEntry(normalized);
    if (validation.valid) {
      result.entries.push(normalized);
    } else {
      result.skipped.push({ entry: normalized, errors: validation.errors });
    }
  }

  result.ok = true;
  return result;
}

export function importBibliographyFile(text, options = {}) {
  const result = {
    ok: false,
    mode: options.mode === 'replace' ? 'replace' : 'merge',
    total: 0,
    added: 0,
    skipped: 0,
    removed: 0,
    entries: [],
    errors: [],
    warnings: [],
  };

  const parsed = parseBibliographyFile(text);
  result.total = parsed.total;
  result.warnings = parsed.warnings;
  result.errors = parsed.errors;

  if (!parsed.ok) return result;

  const addResult = addBibliographyEntries(parsed.entries, { mode: result.mode });
  result.entries = addResult.entries;
  result.removed = addResult.removed;
  result.added = addResult.added.length;
  result.skipped = addResult.skipped.length + parsed.skipped.length;
  result.ok = addResult.saved;
  if (!addResult.saved) {
    result.errors.push('Не удалось сохранить библиографию в localStorage.');
  }

  return result;
}
