/**
 * Импортёр библиографических данных из открытых API:
 * PubMed, Europe PMC, OpenAlex, Crossref.
 *
 * Предназначен только для Node.js (использует глобальный fetch).
 * Не изменяет браузерное хранилище и не попадает в production-бандл.
 *
 * Принципы:
 *  - результаты без аннотации имеют статус metadata_only;
 *  - результаты с аннотацией имеют статус abstract_only;
 *  - DOI/PMID/OpenAlex ID сохраняются как есть, без догадок;
 *  - дедупликация по DOI/PMID и fingerprint заголовка;
 *  - каждый запрос журналируется;
 *  - без проверки по первоисточнику статус не повышается.
 */

// ---------------------------------------------------------------------------
// Поисковый словарь
// ---------------------------------------------------------------------------

export const RESEARCH_QUERY_DICTIONARY = {
  ru: [
    'боксеры время реакции',
    'боксеры простая реакция',
    'боксеры реакция выбора',
    'психомоторика боксёров',
    'боксёры точность ответа',
    'внимание боксёров',
    'антисипация бокс',
    'лабораторные тесты боксёров',
    'компьютеризированные методики бокс',
  ],
  en: [
    'boxers reaction time',
    'boxing simple reaction time',
    'boxing choice reaction time',
    'boxers psychomotor',
    'boxers response accuracy',
    'boxers attention',
    'boxing anticipation',
    'laboratory tests boxers',
    'computerized methods boxing',
    'elite boxers reaction time',
  ],
};

// ---------------------------------------------------------------------------
// Нормализация записей
// ---------------------------------------------------------------------------

function normalizeText(value, limit = 4000) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > limit ? text.slice(0, limit) : text;
}

function normalizeYear(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number.isInteger(n) ? n : Math.floor(n);
}

export function titleFingerprint(title) {
  if (!title) return '';
  return String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Универсальная структура записи библиографии.
 */
export function createBibliographyEntry({
  sourceType,
  sourceId,
  title,
  authors,
  year,
  journal,
  abstract,
  doi,
  pmid,
  pmcid,
  openAlexId,
  crossrefDoi,
  url,
  language,
  keywords,
}) {
  const normalizedAbstract = normalizeText(abstract);
  return {
    sourceType: normalizeText(sourceType, 50),
    sourceId: normalizeText(sourceId, 200),
    title: normalizeText(title),
    authors: Array.isArray(authors) ? authors.map((a) => normalizeText(a, 300)).filter(Boolean) : [],
    year: normalizeYear(year),
    journal: normalizeText(journal),
    abstract: normalizedAbstract,
    doi: normalizeText(doi, 300),
    pmid: normalizeText(pmid, 30),
    pmcid: normalizeText(pmcid, 30),
    openAlexId: normalizeText(openAlexId, 100),
    crossrefDoi: normalizeText(crossrefDoi, 300),
    url: normalizeText(url, 1000),
    language: normalizeText(language, 50),
    keywords: Array.isArray(keywords) ? keywords.map((k) => normalizeText(k, 100)).filter(Boolean) : [],
    dataQualityStatus: normalizedAbstract ? 'abstract_only' : 'metadata_only',
    abstractOnly: Boolean(normalizedAbstract),
    hasFullText: null,
    extractedResults: false,
    admission: {
      eligibleForComparison: false,
      note: 'Библиографическая запись: допуск к сравнению требует верификации числовых результатов по первоисточнику.',
    },
    limitations: [
      'Доступна только библиографическая информация/аннотация; числовые результаты и протокол не извлечены.',
      'Допуск к нормативному сравнению требует верификации по полному тексту первоисточника.',
    ],
    importedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// PubMed
// ---------------------------------------------------------------------------

const PUBMED_SEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_SUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';

async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 && attempt < retries) {
        const delay = 1000 * (2 ** attempt) + Math.random() * 500;
        await new Promise((resolve) => { setTimeout(resolve, delay); });
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = 500 * (2 ** attempt) + Math.random() * 250;
        await new Promise((resolve) => { setTimeout(resolve, delay); });
      }
    }
  }
  throw lastError || new Error('Network request failed after retries');
}

export async function searchPubMed(query, limit = 10) {
  const searchParams = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmode: 'json',
    retmax: String(limit),
  });
  const searchRes = await fetchWithRetry(`${PUBMED_SEARCH_URL}?${searchParams.toString()}`);
  if (!searchRes.ok) {
    throw new Error(`PubMed search HTTP ${searchRes.status}: ${query}`);
  }
  const searchData = await searchRes.json();
  const ids = searchData?.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const summaryParams = new URLSearchParams({
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'json',
  });
  const summaryRes = await fetchWithRetry(`${PUBMED_SUMMARY_URL}?${summaryParams.toString()}`);
  if (!summaryRes.ok) {
    throw new Error(`PubMed summary HTTP ${summaryRes.status}: ${query}`);
  }
  const summaryData = await summaryRes.json();
  const results = summaryData?.result || {};

  return ids.map((id) => {
    const item = results[id] || {};
    const authors = Array.isArray(item.authors)
      ? item.authors.map((a) => a.name).filter(Boolean)
      : [];
    return createBibliographyEntry({
      sourceType: 'pubmed',
      sourceId: `PMID:${id}`,
      title: item.title,
      authors,
      year: item.pubdate ? item.pubdate.match(/\d{4}/)?.[0] : null,
      journal: item.fulljournalname || item.source,
      doi: item.elocationid?.startsWith('doi: ') ? item.elocationid.slice(5) : null,
      pmid: id,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    });
  });
}

// ---------------------------------------------------------------------------
// Europe PMC
// ---------------------------------------------------------------------------

const EUROPE_PMC_URL = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

export async function searchEuropePMC(query, limit = 10) {
  const params = new URLSearchParams({
    query,
    format: 'json',
    pageSize: String(limit),
    resultType: 'core',
  });
  const res = await fetchWithRetry(`${EUROPE_PMC_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Europe PMC HTTP ${res.status}: ${query}`);
  }
  const data = await res.json();
  const results = data?.resultList?.result || [];

  return results.map((item) => {
    const authors = Array.isArray(item.authorList?.author)
      ? item.authorList.author.map((a) => (a.fullName ? a.fullName : `${a.lastName || ''} ${a.firstName || ''}`.trim()))
      : [];
    return createBibliographyEntry({
      sourceType: 'europepmc',
      sourceId: item.id || item.pmid || item.doi,
      title: item.title,
      authors,
      year: item.pubYear,
      journal: item.journalTitle,
      abstract: item.abstractText,
      doi: item.doi,
      pmid: item.pmid,
      pmcid: item.pmcid,
      url: item.pubType === 'fullText' ? item.fullTextUrlList?.fullTextUrl?.[0]?.url : null,
    });
  });
}

// ---------------------------------------------------------------------------
// OpenAlex
// ---------------------------------------------------------------------------

const OPENALEX_URL = 'https://api.openalex.org/works';

export async function searchOpenAlex(query, limit = 10) {
  const params = new URLSearchParams({
    'filter': `title.search:${query}`,
    'per-page': String(limit),
    'mailto': 'box-profile@local',
  });
  const res = await fetchWithRetry(`${OPENALEX_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`OpenAlex HTTP ${res.status}: ${query}`);
  }
  const data = await res.json();
  const results = data?.results || [];

  return results.map((item) => {
    const authors = Array.isArray(item.authorships)
      ? item.authorships
        .map((a) => a.author?.display_name)
        .filter(Boolean)
      : [];
    const doi = item.doi ? item.doi.replace('https://doi.org/', '') : null;
    return createBibliographyEntry({
      sourceType: 'openalex',
      sourceId: item.id,
      title: item.display_name,
      authors,
      year: item.publication_year,
      journal: item.host_venue?.display_name || item.primary_location?.source?.display_name,
      abstract: item.abstract_inverted_index ? openAlexAbstractFromInvertedIndex(item.abstract_inverted_index) : null,
      doi,
      openAlexId: item.id,
      url: item.open_access?.oa_url || item.doi,
      language: item.language,
    });
  });
}

function openAlexAbstractFromInvertedIndex(index) {
  if (!index || typeof index !== 'object') return null;
  const positions = [];
  for (const [word, idxs] of Object.entries(index)) {
    for (const pos of idxs) {
      positions[pos] = word;
    }
  }
  const text = positions.filter(Boolean).join(' ');
  return text || null;
}

// ---------------------------------------------------------------------------
// Crossref
// ---------------------------------------------------------------------------

const CROSSREF_URL = 'https://api.crossref.org/works';

export async function searchCrossref(query, limit = 10) {
  const params = new URLSearchParams({
    'query.title': query,
    rows: String(limit),
  });
  const res = await fetchWithRetry(`${CROSSREF_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'BOX-PROFILE/1.0 (mailto:box-profile@local)' },
  });
  if (!res.ok) {
    throw new Error(`Crossref HTTP ${res.status}: ${query}`);
  }
  const data = await res.json();
  const results = data?.message?.items || [];

  return results.map((item) => {
    const authors = Array.isArray(item.author)
      ? item.author
        .map((a) => `${a.family || ''} ${a.given || ''}`.trim() || a.name)
        .filter(Boolean)
      : [];
    return createBibliographyEntry({
      sourceType: 'crossref',
      sourceId: item.DOI,
      title: item.title?.[0],
      authors,
      year: item.published?.['date-parts']?.[0]?.[0] || item.published_print?.['date-parts']?.[0]?.[0],
      journal: item['container-title']?.[0] || item.publisher,
      doi: item.DOI,
      crossrefDoi: item.DOI,
      url: item.URL || item.link?.[0]?.URL,
      language: item.language,
    });
  });
}

// ---------------------------------------------------------------------------
// Дедупликация
// ---------------------------------------------------------------------------

export function deduplicateBibliography(entries) {
  const byDoi = new Map();
  const byPmid = new Map();
  const byFingerprint = new Map();
  const duplicates = [];

  for (const entry of entries) {
    const doi = entry.doi?.toLowerCase();
    const pmid = entry.pmid;
    const fingerprint = titleFingerprint(entry.title);

    if (doi && byDoi.has(doi)) {
      duplicates.push({ entry, reason: 'duplicate_doi', existing: byDoi.get(doi).sourceId });
      continue;
    }
    if (pmid && byPmid.has(pmid)) {
      duplicates.push({ entry, reason: 'duplicate_pmid', existing: byPmid.get(pmid).sourceId });
      continue;
    }
    if (fingerprint && fingerprint.length > 5 && byFingerprint.has(fingerprint)) {
      duplicates.push({ entry, reason: 'duplicate_title', existing: byFingerprint.get(fingerprint).sourceId });
      continue;
    }

    if (doi) byDoi.set(doi, entry);
    if (pmid) byPmid.set(pmid, entry);
    if (fingerprint && fingerprint.length > 5) byFingerprint.set(fingerprint, entry);
  }

  const unique = [...byDoi.values(), ...byPmid.values(), ...byFingerprint.values()];
  // Убираем дубли, которые могли попасть в оба Map
  const seen = new Set();
  return {
    entries: unique.filter((e) => {
      if (seen.has(e)) return false;
      seen.add(e);
      return true;
    }),
    duplicates,
  };
}

// ---------------------------------------------------------------------------
// Журнал запросов
// ---------------------------------------------------------------------------

export function createImportLog() {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    queries: [],
    totals: { searched: 0, unique: 0, duplicates: 0, errors: 0 },
    errors: [],
  };
}

export function addQueryToLog(log, { sourceType, query, count, error }) {
  log.queries.push({
    sourceType,
    query,
    timestamp: new Date().toISOString(),
    count: count ?? 0,
    error: error || null,
  });
  if (error) {
    log.errors.push({ sourceType, query, message: error });
    log.totals.errors += 1;
  } else {
    log.totals.searched += count || 0;
  }
}

// ---------------------------------------------------------------------------
// Универсальный поиск с частичным сохранением и возобновлением
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

const SOURCE_SEARCHERS = {
  pubmed: searchPubMed,
  europepmc: searchEuropePMC,
  openalex: searchOpenAlex,
  crossref: searchCrossref,
};

/**
 * Выполняет поиск по всем источникам с учётом resume и частичным сохранением.
 * Если передан onBatch, он вызывается после каждого успешного запроса с
 * уникальными записями, найденными к этому моменту.
 */
export async function searchAllSources(options = {}) {
  const {
    sources = Object.keys(SOURCE_SEARCHERS),
    queries = RESEARCH_QUERY_DICTIONARY.en,
    limitPerQuery = 10,
    onProgress,
    onBatch,
    resumeLog = null,
    delayMs = 350,
  } = options;

  const log = resumeLog || createImportLog();
  const completedQueries = new Set((log.queries || []).filter((q) => !q.error).map((q) => `${q.sourceType}:${q.query}`));
  const allEntries = [];

  for (const sourceType of sources) {
    const searcher = SOURCE_SEARCHERS[sourceType];
    if (!searcher) continue;

    for (const query of queries) {
      const key = `${sourceType}:${query}`;
      if (completedQueries.has(key)) {
        if (onProgress) {
          const prev = log.queries.find((q) => q.sourceType === sourceType && q.query === query && !q.error);
          onProgress({ sourceType, query, count: prev?.count || 0, error: null, skipped: true });
        }
        continue;
      }

      await sleep(delayMs);
      try {
        const entries = await searcher(query, limitPerQuery);
        addQueryToLog(log, { sourceType, query, count: entries.length });
        allEntries.push(...entries);
        if (onProgress) onProgress({ sourceType, query, count: entries.length, error: null });
        if (onBatch) {
          const { entries: uniqueSoFar } = deduplicateBibliography(allEntries);
          onBatch({ sourceType, query, entries: uniqueSoFar, log });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addQueryToLog(log, { sourceType, query, error: message });
        if (onProgress) onProgress({ sourceType, query, count: 0, error: message });
      }
    }
  }

  const { entries, duplicates } = deduplicateBibliography(allEntries);
  log.totals.unique = entries.length;
  log.totals.duplicates = duplicates.length;
  log.finishedAt = new Date().toISOString();

  return { entries, duplicates, log };
}

// ---------------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------------

export const BIBLIOGRAPHY_FILE_KIND = 'box_bibliography';
export const BIBLIOGRAPHY_FILE_VERSION = 1;

export function buildBibliographyExport(entries, log) {
  return {
    app: 'BOX-PROFILE',
    kind: BIBLIOGRAPHY_FILE_KIND,
    version: BIBLIOGRAPHY_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    count: entries.length,
    log,
    entries,
  };
}

export function exportBibliographyJSON(entries, log) {
  return JSON.stringify(buildBibliographyExport(entries, log), null, 2);
}

function csvEscape(value) {
  if (value == null) return '';
  const text = String(value).replace(/"/g, '""');
  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text}"`;
  }
  return text;
}

export function exportBibliographyCSV(entries) {
  const headers = [
    'sourceType',
    'sourceId',
    'title',
    'authors',
    'year',
    'journal',
    'doi',
    'pmid',
    'pmcid',
    'openAlexId',
    'crossrefDoi',
    'url',
    'language',
    'dataQualityStatus',
    'abstractOnly',
    'importedAt',
  ];
  const lines = [headers.join(',')];
  for (const entry of entries) {
    const row = headers.map((h) => {
      let value = entry[h];
      if (h === 'authors' && Array.isArray(value)) value = value.join('; ');
      return csvEscape(value);
    });
    lines.push(row.join(','));
  }
  return lines.join('\r\n');
}
