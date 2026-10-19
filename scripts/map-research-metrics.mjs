#!/usr/bin/env node
/**
 * Сопоставление кандидатов показателей staging-пакета с METRICS_CATALOG.
 *
 * Использование:
 *   node scripts/map-research-metrics.mjs [--file <metric_candidates.json>] [--json] [--out <файл>]
 *
 * По умолчанию читается
 *   data/research-staging/BOX_PROFILE_normalized_import/data/metric_candidates.json
 *
 * Скрипт только читает данные и печатает отчёт:
 *  - какие кандидаты имеют прямое соответствие (и это кандидат на экспертное
 *    подтверждение, а не утверждённый норматив);
 *  - где совпадает название, но конфликтуют единицы измерения;
 *  - какие кандидаты не имеют соответствия в каталоге;
 *  - какие метрики каталога вообще не покрыты кандидатами.
 *
 * Никаких записей в приложение, METRICS_CATALOG или staging-пакет не
 * выполняется. Отчёт в файл пишется только при явном --out.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DEFAULT_METRIC_CANDIDATES_FILE,
  MAPPING_STATUS,
  buildMappingReport,
  loadMetricCandidates,
} from '../src/utils/metricCandidateMapper.mjs';

function parseArgs(argv) {
  const args = { file: DEFAULT_METRIC_CANDIDATES_FILE, json: false, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file') args.file = argv[i + 1] || DEFAULT_METRIC_CANDIDATES_FILE;
    if (argv[i] === '--json') args.json = true;
    if (argv[i] === '--out') args.out = argv[i + 1] || null;
  }
  return args;
}

function formatReport(report) {
  const { summary, records } = report;
  const lines = [];
  lines.push('Сопоставление metric_candidates с METRICS_CATALOG');
  lines.push(
    `Кандидатов: ${summary.candidateCount}, метрик в каталоге: ${summary.catalogMetricCount}`,
  );
  lines.push(
    `Прямое соответствие: ${summary.directMatchCount}, конфликт единиц: ${summary.unitConflictCount}, ` +
      `неоднозначно: ${summary.ambiguousCount}, нет в каталоге: ${summary.noCatalogMetricCount}`,
  );
  lines.push(`Требуют ручной верификации: ${summary.manualReviewCount} из ${summary.candidateCount}`);
  lines.push('');

  const direct = records.filter((r) => r.status === MAPPING_STATUS.direct_match);
  if (direct.length > 0) {
    lines.push('Прямое соответствие (кандидат на экспертное подтверждение, не норматив):');
    for (const record of direct) {
      lines.push(
        `  ${record.metricIdCandidate} → ${record.appMetricId} · «${record.nameOriginal}» ` +
          `(${record.unitOriginal} → ${(record.candidates[0]?.unit ?? '—')})`,
      );
    }
    lines.push('');
  }

  const conflicts = records.filter(
    (r) => r.status === MAPPING_STATUS.unit_conflict || r.status === MAPPING_STATUS.ambiguous,
  );
  if (conflicts.length > 0) {
    lines.push('Требуют ручного разбора (единицы / неоднозначность):');
    for (const record of conflicts) {
      lines.push(`  [${record.status}] ${record.metricIdCandidate}: ${record.reason}`);
    }
    lines.push('');
  }

  lines.push(`Метрики каталога без кандидатов (${summary.catalogMetricsWithoutCandidate.length}):`);
  lines.push(`  ${summary.catalogMetricsWithoutCandidate.join(', ') || '—'}`);
  lines.push(
    `Из них используются в форме пользовательских исследований: ` +
      `${summary.userEntryMetricsWithoutCandidate.join(', ') || '—'}`,
  );
  lines.push('');
  lines.push(
    'Статусы пакета не повышались: ни один кандидат не объявлен нормативом, ' +
      'METRICS_CATALOG не изменялся.',
  );
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = await loadMetricCandidates(args.file);
  if (!loaded.ok) {
    process.stderr.write(`Ошибка: ${loaded.error}\n`);
    process.exitCode = 1;
    return;
  }

  const report = buildMappingReport(loaded.value);
  const output = args.json ? JSON.stringify(report, null, 2) : formatReport(report);
  process.stdout.write(`${output}\n`);

  if (args.out) {
    await writeFile(path.resolve(args.out), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`Отчёт записан: ${args.out}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`Скрипт завершился с ошибкой: ${error.message}\n`);
  process.exitCode = 1;
});
