import React, { useMemo, useState } from 'react';
import {
  Search, Filter, X, Download, AlertTriangle, ShieldAlert, Info, ExternalLink,
  Database, ListChecks, FileSpreadsheet,
} from 'lucide-react';
import {
  STAGING_PACKAGE_LABEL,
  STAGING_RECONCILIATION_LABELS,
  STAGING_TABLES,
  stagingLabel,
  getStagingSummary,
  getStagingStudyRows,
  getStagingObservationRows,
  getStagingMetricCandidateRows,
  getStagingModelCandidateRows,
  getStagingExternalSourceRows,
  getStagingReviewQueueRows,
  buildStagingMetricCandidatesCsv,
  buildStagingReviewQueueCsv,
  getStagingStudy,
  getStagingCohort,
  getStagingProtocol,
  getStagingObservation,
  getStagingModelCandidate,
  getStagingExternalSource,
} from '../data/stagingResearchPackage';
import {
  NumericCell,
  StagingTable,
} from './stagingTableCells.jsx';
import { TABLE_HEADERS, TABLE_RENDERERS } from './stagingTableRenderers.jsx';

const ROWS_PER_PAGE = 25;

const TABLE_ROWS = {
  studies: getStagingStudyRows,
  observations: getStagingObservationRows,
  metricCandidates: getStagingMetricCandidateRows,
  modelCandidates: getStagingModelCandidateRows,
  externalSources: getStagingExternalSourceRows,
  reviewQueue: getStagingReviewQueueRows,
};


function downloadCsv(fileName, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function StagingResearchView() {
  const summary = useMemo(() => getStagingSummary(), []);
  const [tableId, setTableId] = useState('studies');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => (TABLE_ROWS[tableId] || (() => []))(), [tableId]);

  const statusOptions = useMemo(() => {
    const key = {
      studies: 'verificationStatus',
      observations: 'numericalUseStatus',
      metricCandidates: 'normalizationStatus',
      modelCandidates: 'normalizationStatus',
      externalSources: 'reconciliationStatus',
      reviewQueue: 'status',
    }[tableId];
    const values = new Set(rows.map((row) => row[key]).filter(Boolean));
    return Array.from(values).sort();
  }, [rows, tableId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const key = {
      studies: 'verificationStatus',
      observations: 'numericalUseStatus',
      metricCandidates: 'normalizationStatus',
      modelCandidates: 'normalizationStatus',
      externalSources: 'reconciliationStatus',
      reviewQueue: 'status',
    }[tableId];
    return rows.filter((row) => {
      if (statusFilter && row[key] !== statusFilter) return false;
      if (q && !row.searchText.includes(q)) return false;
      return true;
    });
  }, [rows, query, statusFilter, tableId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * ROWS_PER_PAGE, (safePage + 1) * ROWS_PER_PAGE);

  const changeTable = (id) => {
    setTableId(id);
    setQuery('');
    setStatusFilter('');
    setPage(0);
    setSelected(null);
  };

  const exportCandidates = () => {
    downloadCsv(`Кандидаты_показателей_${todayStamp()}.csv`, buildStagingMetricCandidatesCsv());
  };
  const exportReviewQueue = () => {
    downloadCsv(`Очередь_проверки_${todayStamp()}.csv`, buildStagingReviewQueueCsv());
  };

  return (
    <div className="space-y-4">
      {/* Дисклеймер */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex gap-2.5 items-start">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {STAGING_PACKAGE_LABEL}. Это предварительно нормализованные данные, а не подтверждённые нормативы.
          Записи не подключены к каталогу METRICS_CATALOG, референтным моделям и расчётам спортсменов.
          Значения <strong className="text-slate-300">mean ± число</strong> не считаются подтверждённым средним
          и SD/SEM до проверки первоисточника.
        </p>
      </div>

      {/* Сводка */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase text-blue-400 flex items-center gap-1.5">
            <Database className="w-4 h-4" /> Сводка по пакету
          </h4>
          <span className="text-[10px] text-slate-500">
            Версия {summary.packageVersion || '—'} · подготовлено {summary.createdAt || '—'} ·
            {' '}стадия {summary.stage || '—'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-[11px]">
          <SummaryTile label="Исследования" value={summary.counts.studies} />
          <SummaryTile label="Наблюдения" value={summary.counts.observations} />
          <SummaryTile label="Кандидаты показателей" value={summary.counts.metricCandidates} />
          <SummaryTile label="Модельные характеристики" value={summary.counts.modelCandidates} />
          <SummaryTile label="Внешние источники" value={summary.counts.externalSourceCandidates} />
          <SummaryTile label="Очередь проверки" value={summary.counts.reviewQueue} />
          <SummaryTile label="Без числового значения" value={summary.observationsWithoutValue} accent="amber" />
          <SummaryTile label="Допущено к реф. модели" value={summary.referenceModelsPromoted ?? 0} accent="emerald" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400">
          <p>
            С числовым значением: <strong className="text-slate-200">{summary.observationsWithValue}</strong> ·
            {' '}с указанным SD: <strong className="text-slate-200">{summary.observationsWithSd}</strong> ·
            {' '}без n: <strong className="text-slate-200">{summary.observationsWithoutSampleSize}</strong>
          </p>
          <p>
            Конфликты года у источников: <strong className="text-amber-300">{summary.sourceCandidatesWithYearConflict}</strong> ·
            {' '}кандидаты с сопоставлением к каталогу: <strong className="text-slate-200">{summary.metricCandidatesAssignedToCatalog}</strong> ·
            {' '}модельные кандидаты, допущенные к модели: <strong className="text-slate-200">{summary.modelCandidatesEligible}</strong>
          </p>
        </div>

        {!summary.countsMatchManifest && (
          <p className="text-[11px] text-amber-400 flex items-start gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Счётчики загруженных JSON не совпадают с import_manifest.json — показаны фактические значения.
          </p>
        )}

        {summary.importantWarnings.length > 0 && (
          <details className="text-[11px] text-slate-400">
            <summary className="cursor-pointer hover:text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Ограничения пакета ({summary.importantWarnings.length})
            </summary>
            <ul className="mt-1.5 space-y-1 pl-5 list-disc">
              {summary.importantWarnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Таблицы */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3">
        <div className="flex flex-wrap gap-2">
          {STAGING_TABLES.map((table) => (
            <button
              key={table.id}
              onClick={() => changeTable(table.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                tableId === table.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {table.label}
              <span className="text-[10px] opacity-70">({table.count})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[14rem] bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              placeholder="Поиск по ID, названию, показателю, источнику…"
              className="flex-1 bg-transparent text-xs text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white cursor-pointer"
            >
              <option value="">Все статусы</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {tableId === 'metricCandidates' && (
            <button
              onClick={exportCandidates}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Экспорт кандидатов CSV
            </button>
          )}
          {tableId === 'reviewQueue' && (
            <button
              onClick={exportReviewQueue}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Экспорт очереди CSV
            </button>
          )}
        </div>

        <p className="text-[10px] text-slate-500">
          Показано {visible.length} из {filtered.length} (всего в разделе {rows.length}). Нажмите на строку, чтобы открыть подробности.
        </p>

        <div className="overflow-x-auto">
          <StagingTable
            head={TABLE_HEADERS[tableId]}
            rows={visible}
            renderCells={TABLE_RENDERERS[tableId]}
            onSelect={(row) => setSelected({ type: tableId, record: row })}
          />
        </div>

        {filtered.length === 0 && (
          <p className="text-xs text-slate-500 italic py-3 text-center">По выбранным условиям записей нет.</p>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 text-xs">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <span className="text-slate-400">Стр. {safePage + 1} из {pageCount}</span>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Вперёд
            </button>
          </div>
        )}
      </div>

      {selected && (
        <RecordDetails item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SummaryTile({ label, value, accent }) {
  const color = accent === 'amber' ? 'text-amber-300' : accent === 'emerald' ? 'text-emerald-400' : 'text-blue-400';
  return (
    <div className="bg-slate-800/70 rounded-lg px-2.5 py-2 border border-slate-700">
      <span className="text-slate-500 block leading-tight">{label}</span>
      <strong className={`font-mono ${color}`}>{value ?? '—'}</strong>
    </div>
  );
}

function Field({ label, value, mono }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <span className="text-[10px] text-slate-500 block">{label}</span>
      <span className={`text-xs text-slate-200 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ProvenanceBlock({ provenance }) {
  if (!provenance) return null;
  const parts = [
    provenance.sourceFile && `файл: ${provenance.sourceFile}`,
    provenance.sheet && `лист: ${provenance.sheet}`,
    provenance.row != null && `строка: ${provenance.row}`,
    provenance.sourceRecordId && `ID источника: ${provenance.sourceRecordId}`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="border-t border-slate-700 pt-2">
      <span className="text-[10px] text-slate-500 block mb-0.5">Происхождение записи</span>
      <span className="text-[11px] text-slate-400 font-mono">{parts.join(' · ')}</span>
    </div>
  );
}

function SourceLink({ url }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-1 break-all"
    >
      <ExternalLink className="w-3 h-3 shrink-0" /> {url}
    </a>
  );
}

function RecordDetails({ item, onClose }) {
  const { type, record } = item;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl relative space-y-3">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2 pr-8">
          <FileSpreadsheet className="w-4 h-4" />
          {record.id}
          <span className="text-[10px] font-normal text-slate-500">
            {type === 'studies' && 'Исследование'}
            {type === 'observations' && 'Наблюдение'}
            {type === 'metricCandidates' && 'Кандидат показателя'}
            {type === 'modelCandidates' && 'Модельная характеристика'}
            {type === 'externalSources' && 'Кандидат внешнего источника'}
            {type === 'reviewQueue' && 'Задача ручной проверки'}
          </span>
        </h3>

        {type === 'studies' && <StudyDetails row={record} />}
        {type === 'observations' && <ObservationDetails row={record} />}
        {type === 'metricCandidates' && <MetricCandidateDetails row={record} />}
        {type === 'modelCandidates' && <ModelCandidateDetails row={record} />}
        {type === 'externalSources' && <ExternalSourceDetails row={record} />}
        {type === 'reviewQueue' && <ReviewQueueDetails row={record} />}

        {type !== 'reviewQueue' && <ProvenanceBlock provenance={record.provenance} />}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-xs cursor-pointer">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function StudyDetails({ row }) {
  const cohort = getStagingCohort(`cohort_${row.id}`);
  const protocol = getStagingProtocol(`protocol_summary_${row.id}`);
  return (
    <div className="space-y-3 text-xs">
      <Field label="Название" value={row.title} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Авторы" value={row.authors} />
        <Field label="Год" value={row.year.display} mono />
        <Field label="Журнал" value={row.journal} />
        <Field label="DOI" value={row.doi} mono />
        <Field label="Область" value={[row.domain, row.subdomain].filter(Boolean).join(' / ')} />
        <Field label="Дизайн" value={row.design} />
        <Field label="Выборка" value={row.sample} />
        <Field label="Пол" value={row.sex} />
        <Field label="Возраст" value={row.age} />
        <Field label="Квалификация" value={row.qualification} />
        <Field label="Вес" value={row.weight} />
        <Field label="Глубина извлечения" value={row.extractionDepth} />
      </div>
      <Field label="Методы" value={row.methods} />
      <Field label="Краткий результат" value={row.outcomeSummary} />
      <Field label="Ограничения" value={row.limitations} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Статус проверки" value={row.verificationStatus} mono />
        <Field label="Статус ревью" value={row.reviewStatus} mono />
      </div>
      {cohort && (
        <div className="bg-slate-900/70 border border-slate-700 rounded p-2.5 space-y-1">
          <span className="text-[10px] text-slate-500 block">Когорта на уровне исследования</span>
          <span className="text-[11px] text-slate-300">
            {cohort.cohortId} · n: {cohort.sampleSize ?? 'не указано'} · {cohort.cohortHarmonizationStatus}
          </span>
        </div>
      )}
      {protocol && (
        <div className="bg-slate-900/70 border border-slate-700 rounded p-2.5 space-y-1">
          <span className="text-[10px] text-slate-500 block">Сводка методов (не подтверждённый протокол)</span>
          <span className="text-[11px] text-slate-300">{protocol.protocolId} · {protocol.specificity}</span>
          {protocol.warning && <p className="text-[10px] text-amber-400/80">{protocol.warning}</p>}
        </div>
      )}
      <SourceLink url={row.url} />
    </div>
  );
}

function ObservationDetails({ row }) {
  const study = getStagingStudy(row.studyId);
  const metric = getStagingMetricCandidate(row.metricIdCandidate);
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Показатель" value={row.indicator} />
        <Field label="Кандидат показателя" value={row.metricIdCandidate} mono />
        <Field label="Исследование" value={row.studyId} mono />
        <Field label="Условие / группа" value={row.groupOrCondition} />
        <Field label="Статистика" value={row.statisticType} />
        <Field label="Сравнение / p" value={row.comparison} />
        <Field label="Пол" value={row.sex} />
        <Field label="Квалификация" value={row.qualification} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <DetailNumber label="Значение" field={row.value} unit={row.unit} />
        <DetailNumber label="SD (как в источнике)" field={row.sd} unit={row.unit} />
        <DetailNumber label="Min" field={row.min} unit={row.unit} />
        <DetailNumber label="Max" field={row.max} unit={row.unit} />
      </div>

      <Field label="Исходный текст результата (неизменён)" value={row.reportedResult} />
      <Field label="Оговорка источника" value={row.caveat} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Статус числового использования" value={row.numericalUseStatus} mono />
        <Field label="Статус проверки" value={row.verificationStatus} mono />
        <Field label="Кандидат показателя (название)" value={metric?.nameOriginal} />
        <Field label="n" value={row.sampleSize.display} mono />
      </div>

      {study && <Field label="Исследование" value={study.titleOriginal} />}
      <SourceLink url={row.url} />
    </div>
  );
}

function DetailNumber({ label, field, unit }) {
  return (
    <div className="bg-slate-900/70 rounded border border-slate-700 px-2 py-1.5">
      <span className="text-[10px] text-slate-500 block">{label}</span>
      <NumericCell field={field} unit={unit} />
    </div>
  );
}

function MetricCandidateDetails({ row }) {
  return (
    <div className="space-y-3 text-xs">
      <Field label="Название" value={row.name} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Область" value={row.domain} />
        <Field label="Единица" value={row.unit} />
        <Field label="Статус нормализации" value={row.normalizationStatus} mono />
        <Field label="appMetricId (каталог)" value="не сопоставлено" />
      </div>
      <Field label="Определение" value={row.definition} />
      <Field label="Причина неопределённости" value={row.harmonizationNote} />
      <div>
        <span className="text-[10px] text-slate-500 block">Исходные локаторы ({row.provenanceRows.length})</span>
        <span className="text-[11px] text-slate-400 font-mono break-all">
          {row.provenanceRows.join(' · ') || '—'}
        </span>
      </div>
    </div>
  );
}

function ModelCandidateDetails({ row }) {
  return (
    <div className="space-y-3 text-xs">
      <Field label="Показатель" value={row.indicator} />
      <Field label="Направление" value={row.direction} />
      <Field label="Цитата" value={row.citation} />
      <Field label="Популяция" value={row.population} />
      <Field label="Исходный числовой текст (неизменён)" value={row.reportedText} />

      <div className="bg-amber-500/5 border border-amber-500/20 rounded p-2.5 space-y-1">
        <span className="text-[10px] text-amber-400 block">Предварительный разбор парсером — не подтверждённые статистики</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <DetailNumber label="Центральное значение" field={row.candidateCentralValue} unit={row.candidateUnit} />
          <DetailNumber label="Разброс" field={row.candidateDispersion} unit={row.candidateUnit} />
          <div>
            <span className="text-[10px] text-slate-500 block">Шаблон</span>
            <span className="text-[11px] font-mono text-slate-300">{row.parsePattern || '—'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Тип разброса</span>
            <span className="text-[11px] font-mono text-slate-300">
              {row.dispersionType || 'не определён (не SD/SEM)'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Исследование (кандидат)" value={row.studyId} mono />
        <Field label="Внешний источник (кандидат)" value={row.sourceCandidateId} mono />
        <Field label="Основание связи" value={row.sourceMatchStatus} mono />
        <Field label="Статус нормализации" value={row.normalizationStatus} mono />
      </div>

      <div>
        <span className="text-[10px] text-slate-500 block">Допуск к референтной модели</span>
        <span className={`text-[11px] font-semibold ${row.referenceModelEligible ? 'text-red-400' : 'text-emerald-400'}`}>
          {row.referenceModelEligible ? 'допущен (требует немедленной проверки)' : 'не допущен'}
        </span>
      </div>

      {row.sourceCandidateId && (
        <LinkedSource sourceCandidateId={row.sourceCandidateId} />
      )}
      <SourceLink url={row.url} />
    </div>
  );
}

function LinkedSource({ sourceCandidateId }) {
  const source = getStagingExternalSource(sourceCandidateId);
  if (!source) return null;
  return (
    <div className="bg-slate-900/70 border border-slate-700 rounded p-2.5">
      <span className="text-[10px] text-slate-500 block">Связанный внешний источник</span>
      <span className="text-[11px] text-slate-300">{source.citationOriginal}</span>
    </div>
  );
}

function ExternalSourceDetails({ row }) {
  return (
    <div className="space-y-3 text-xs">
      <Field label="Цитата" value={row.citation} />
      <Field label="Название (кандидат)" value={row.title} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Год в цитате" value={row.citationYear.display} mono />
        <Field label="Год исследования" value={row.candidateStudyYear.display} mono />
        <Field label="DOI" value={row.doi} mono />
        <Field label="Исследование" value={row.candidateStudyId || 'не сопоставлено'} mono />
        <Field label="Основание связи" value={row.matchBasis} mono />
        <Field label="Статус сверки" value={stagingLabel(STAGING_RECONCILIATION_LABELS, row.reconciliationStatus)} />
      </div>
      {row.yearConflict && (
        <p className="text-[11px] text-amber-300 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Конфликт года: связь предложена, но годы расходятся. Автоматическое объединение запрещено — требуется ручная сверка.
        </p>
      )}
      {row.reviewNotes.length > 0 && (
        <div>
          <span className="text-[10px] text-slate-500 block">Заметки ревью</span>
          <ul className="text-[11px] text-slate-300 list-disc pl-4 space-y-0.5">
            {row.reviewNotes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      )}
      <Field label="Требует ручной проверки" value={row.requiresManualReview ? 'да' : 'нет'} />
      <Field label="Статус проверки" value={row.verificationStatus} mono />
      <SourceLink url={row.url} />
    </div>
  );
}

function ReviewQueueDetails({ row }) {
  const observation = row.recordType === 'observation' ? getStagingObservation(row.recordId) : null;
  const modelCandidate = row.recordType === 'modelCandidate' ? getStagingModelCandidate(row.recordId) : null;
  const study = row.studyIdCandidate ? getStagingStudy(row.studyIdCandidate) : null;

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Приоритет" value={row.priority} />
        <Field label="Тип записи" value={row.recordType} mono />
        <Field label="ID записи" value={row.recordId} mono />
        <Field label="Статус" value={row.status} mono />
        <Field label="Показатель" value={row.indicator} />
        <Field label="Исходное значение" value={row.rawValue} />
      </div>
      <Field label="Причина проверки" value={row.reason} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Исследование (кандидат)" value={row.studyIdCandidate} mono />
        <Field label="Источник (кандидат)" value={row.sourceCandidateId} mono />
      </div>
      {study && <Field label="Название исследования" value={study.titleOriginal} />}
      {observation && (
        <div className="bg-slate-900/70 border border-slate-700 rounded p-2.5 space-y-1">
          <span className="text-[10px] text-slate-500 block">Связанное наблюдение</span>
          <span className="text-[11px] text-slate-300">
            {observation.observationId} · {observation.indicatorOriginal} · {observation.valueReported ?? 'значение не указано'}
          </span>
        </div>
      )}
      {modelCandidate && (
        <div className="bg-slate-900/70 border border-slate-700 rounded p-2.5 space-y-1">
          <span className="text-[10px] text-slate-500 block">Связанная модельная характеристика</span>
          <span className="text-[11px] text-slate-300">
            {modelCandidate.modelCandidateId} · {modelCandidate.indicatorOriginal} · {modelCandidate.reportedNumericTextOriginal}
          </span>
        </div>
      )}
      <ProvenanceBlock
        provenance={{
          sourceFile: row.sourceFile,
          sheet: row.sourceSheet,
          row: row.sourceRow,
          sourceRecordId: row.recordId,
        }}
      />
      <p className="text-[10px] text-slate-500 flex items-center gap-1">
        <ListChecks className="w-3 h-3" /> Статус задачи в пакете не изменяется — просмотр только для чтения.
      </p>
    </div>
  );
}
