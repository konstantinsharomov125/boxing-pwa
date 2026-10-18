#!/usr/bin/env node
/**
 * CLI для импорта библиографических данных по времени реакции и психомоторике
 * из открытых API (PubMed, Europe PMC, OpenAlex, Crossref).
 *
 * Использование:
 *   node scripts/import-research-cli.js [options]
 *
 * Опции:
 *   --source all|pubmed|europepmc|openalex|crossref   (по умолчанию all)
 *   --lang ru|en|ru,en                                (по умолчанию en)
 *   --limit N                                         (по умолчанию 10)
 *   --output path                                     (по умолчанию data/imports/rt-literature-YYYY-MM-DD.json)
 *   --format json|csv                                 (по умолчанию json)
 *   --dry-run                                         (только журнал, без записи файла)
 *   --resume                                          (возобновить прерванный импорт из существующего файла)
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  RESEARCH_QUERY_DICTIONARY,
  searchAllSources,
  exportBibliographyJSON,
  exportBibliographyCSV,
  BIBLIOGRAPHY_FILE_KIND,
  BIBLIOGRAPHY_FILE_VERSION,
} from '../src/utils/researchBibliographyImporter.js';

function parseArgs(argv) {
  const args = { source: 'all', lang: ['en'], limit: 10, output: null, format: 'json', dryRun: false, resume: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--source') args.source = argv[i + 1] || 'all';
    if (key === '--lang') {
      const raw = argv[i + 1] || 'en';
      args.lang = raw.split(',').map((s) => s.trim());
    }
    if (key === '--limit') args.limit = Number(argv[i + 1]) || 10;
    if (key === '--output') args.output = argv[i + 1] || null;
    if (key === '--format') args.format = argv[i + 1] || 'json';
    if (key === '--dry-run') args.dryRun = true;
    if (key === '--resume') args.resume = true;
  }
  return args;
}

function resolveSources(sourceArg) {
  if (sourceArg === 'all') return ['pubmed', 'europepmc', 'openalex', 'crossref'];
  return sourceArg.split(',').map((s) => s.trim()).filter(Boolean);
}

function resolveQueries(langArg) {
  const langs = Array.isArray(langArg) ? langArg : [langArg];
  const queries = [];
  for (const lang of langs) {
    const list = RESEARCH_QUERY_DICTIONARY[lang];
    if (Array.isArray(list)) queries.push(...list);
    else console.warn(`Предупреждение: язык «${lang}» отсутствует в словаре запросов.`);
  }
  return queries;
}

function defaultOutputName(format) {
  const local = new Date();
  const iso = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return path.resolve(process.cwd(), `data/imports/rt-literature-${iso}.${format}`);
}

async function readResumeLog(outputPath, format) {
  try {
    const text = await readFile(outputPath, 'utf8');
    if (format === 'csv') {
      return { entries: [], log: null };
    }
    const doc = JSON.parse(text);
    if (doc && typeof doc === 'object' && doc.kind === BIBLIOGRAPHY_FILE_KIND && Array.isArray(doc.entries)) {
      return { entries: doc.entries, log: doc.log || null };
    }
  } catch {
    // файл отсутствует или повреждён — начинаем сначала
  }
  return { entries: [], log: null };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sources = resolveSources(args.source);
  const queries = resolveQueries(args.lang);
  const outputPath = args.output || defaultOutputName(args.format);

  if (queries.length === 0) {
    console.error('Ошибка: не выбраны поисковые запросы.');
    process.exit(1);
  }

  console.log(`Источники: ${sources.join(', ')}`);
  console.log(`Языки: ${args.lang.join(', ')}`);
  console.log(`Запросов: ${queries.length}`);
  console.log(`Лимит на запрос: ${args.limit}`);
  console.log(`Формат вывода: ${args.format}`);
  console.log(`Файл: ${outputPath}`);
  if (args.dryRun) console.log('Режим --dry-run: файл записан не будет.');
  if (args.resume && !args.dryRun) console.log('Режим --resume: успешные запросы пропущены.');
  console.log('');

  let initialEntries = [];
  let resumeLog = null;
  if (args.resume && !args.dryRun) {
    const resumed = await readResumeLog(outputPath, args.format);
    initialEntries = resumed.entries;
    resumeLog = resumed.log;
    if (initialEntries.length > 0 || resumeLog) {
      console.log(`Возобновление: ${initialEntries.length} записей уже в файле, ${resumeLog?.queries?.length || 0} запросов выполнено.`);
      console.log('');
    }
  }

  let savedCount = initialEntries.length;
  let currentLog = resumeLog;
  let resultLog = null;
  let resultEntries = initialEntries;



  const { entries, log } = await searchAllSources({
    sources,
    queries,
    limitPerQuery: args.limit,
    resumeLog,
    onProgress: ({ sourceType, query, count, error, skipped }) => {
      if (skipped) {
        console.log(`  [${sourceType}] «${query}» — пропущено (уже выполнено)`);
      } else if (error) {
        console.error(`  [${sourceType}] «${query}» — ошибка: ${error}`);
      } else {
        console.log(`  [${sourceType}] «${query}» — найдено ${count}`);
      }
    },
    onBatch: async ({ entries: batchEntries, log: batchLog }) => {
      if (!args.dryRun && batchEntries.length !== savedCount) {
        await mkdir(path.dirname(outputPath), { recursive: true });
        const content = args.format === 'csv'
          ? exportBibliographyCSV(batchEntries)
          : exportBibliographyJSON(batchEntries, batchLog || currentLog);
        await writeFile(outputPath, content, 'utf8');
        savedCount = batchEntries.length;
        console.log(`    └─ промежуточное сохранение: ${savedCount} уникальных записей`);
      }
    },
  });

  resultEntries = entries.length > 0 ? entries : initialEntries;
  resultLog = (log?.queries?.length || 0) > 0 ? log : currentLog;

  console.log('');
  console.log('Журнал запросов:');
  for (const q of log.queries) {
    console.log(`  ${q.sourceType} | ${q.query} | ${q.count}${q.error ? ` | ERROR: ${q.error}` : ''}`);
  }
  console.log('');
  console.log('Итоги:');
  console.log(`  Всего найдено (без дедупликации): ${log.totals.searched}`);
  console.log(`  Уникальных записей: ${log.totals.unique}`);
  console.log(`  Дубликатов: ${log.totals.duplicates}`);
  console.log(`  Ошибок запросов: ${log.totals.errors}`);

  if (args.dryRun) {
    console.log('\nDry-run завершён. Файл не записан.');
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const content = args.format === 'csv'
    ? exportBibliographyCSV(resultEntries)
    : exportBibliographyJSON(resultEntries, resultLog);
  await writeFile(outputPath, content, 'utf8');
  console.log(`\nФайл сохранён: ${outputPath}`);
  console.log(`Записей в файле: ${resultEntries.length}`);
  console.log(`Формат файла: ${BIBLIOGRAPHY_FILE_KIND} v${BIBLIOGRAPHY_FILE_VERSION}`);
}

main().catch((error) => {
  console.error('Критическая ошибка:', error instanceof Error ? error.message : error);
  process.exit(1);
});
