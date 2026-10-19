import React from 'react';
import {
  STAGING_STUDY_STATUS_LABELS,
  STAGING_NUMERICAL_USE_LABELS,
  STAGING_RECONCILIATION_LABELS,
  stagingLabel,
} from '../data/stagingResearchPackage';
import { NumericCell, StatusBadge } from './stagingTableCells.jsx';

function plain(value, fallback = '—') {
  return value === null || value === undefined || value === '' ? fallback : value;
}

export const TABLE_HEADERS = {
  studies: ['ID', 'Год', 'Название', 'Авторы', 'DOI', 'Статус'],
  observations: ['ID', 'Исследование', 'Показатель', 'Условие', 'Значение', 'SD', 'n', 'Тип', 'Статус'],
  metricCandidates: ['ID', 'Название', 'Область', 'Единица', 'appMetricId', 'Статус'],
  modelCandidates: ['ID', 'Показатель', 'Исходный текст', 'Центр. подсказка', 'Разброс', 'Ед.', 'К модели', 'Статус'],
  externalSources: ['ID', 'Цитата', 'Год', 'Исследование', 'Основание', 'Конфликт года', 'Статус'],
  reviewQueue: ['ID', 'Приоритет', 'Тип', 'ID записи', 'Показатель', 'Исходное значение', 'Строка'],
};

const cell = (key, render) => ({ key, render });

export const TABLE_RENDERERS = {
  studies: (row) => [
    cell('id', () => <span className="font-mono text-slate-400">{row.id}</span>),
    cell('year', () => <NumericCell field={row.year} />),
    cell('title', () => <span className="text-white">{plain(row.title)}</span>),
    cell('authors', () => plain(row.authors)),
    cell('doi', () => <span className="font-mono text-[10px]">{plain(row.doi)}</span>),
    cell('status', () => (
      <StatusBadge text={stagingLabel(STAGING_STUDY_STATUS_LABELS, row.verificationStatus)} />
    )),
  ],
  observations: (row) => [
    cell('id', () => <span className="font-mono text-slate-400">{row.id}</span>),
    cell('study', () => <span className="font-mono text-slate-300">{row.studyId}</span>),
    cell('indicator', () => <span className="text-white">{plain(row.indicator)}</span>),
    cell('condition', () => <span className="text-slate-400">{plain(row.groupOrCondition)}</span>),
    cell('value', () => <NumericCell field={row.value} unit={row.unit} />),
    cell('sd', () => <NumericCell field={row.sd} />),
    cell('n', () => <NumericCell field={row.sampleSize} />),
    cell('statistic', () => plain(row.statisticType)),
    cell('status', () => (
      <StatusBadge text={stagingLabel(STAGING_NUMERICAL_USE_LABELS, row.numericalUseStatus)} tone="amber" />
    )),
  ],
  metricCandidates: (row) => [
    cell('id', () => <span className="font-mono text-slate-400">{row.id}</span>),
    cell('name', () => <span className="text-white">{plain(row.name)}</span>),
    cell('domain', () => plain(row.domain)),
    cell('unit', () => plain(row.unit)),
    cell('appMetric', () => (
      <span className="text-slate-500 italic">{plain(row.appMetricId, 'не сопоставлено')}</span>
    )),
    cell('status', () => (
      <span className="font-mono text-[10px] text-amber-300">{row.normalizationStatus}</span>
    )),
  ],
  modelCandidates: (row) => [
    cell('id', () => <span className="font-mono text-slate-400">{row.id}</span>),
    cell('indicator', () => <span className="text-white">{plain(row.indicator)}</span>),
    cell('text', () => <span className="font-mono text-[11px] text-slate-300">{plain(row.reportedText)}</span>),
    cell('central', () => <NumericCell field={row.candidateCentralValue} />),
    cell('dispersion', () => <NumericCell field={row.candidateDispersion} />),
    cell('unit', () => plain(row.candidateUnit)),
    cell('eligible', () => (
      <span className={row.referenceModelEligible ? 'text-red-400' : 'text-emerald-400'}>
        {row.referenceModelEligible ? 'допущен' : 'нет'}
      </span>
    )),
    cell('status', () => <StatusBadge text={row.normalizationStatus} tone="amber" />),
  ],
  externalSources: (row) => [
    cell('id', () => <span className="font-mono text-slate-400">{row.id}</span>),
    cell('citation', () => <span className="text-white">{plain(row.citation)}</span>),
    cell('year', () => <NumericCell field={row.citationYear} />),
    cell('study', () => (
      row.candidateStudyId
        ? row.candidateStudyId
        : <span className="text-slate-500 italic">не сопоставлено</span>
    )),
    cell('basis', () => plain(row.matchBasis)),
    cell('conflict', () => (
      <span className={row.yearConflict ? 'text-amber-300' : 'text-slate-500'}>
        {row.yearConflict ? 'да' : 'нет'}
      </span>
    )),
    cell('status', () => (
      <StatusBadge text={stagingLabel(STAGING_RECONCILIATION_LABELS, row.reconciliationStatus)} />
    )),
  ],
  reviewQueue: (row) => [
    cell('id', () => <span className="font-mono text-slate-400">{row.id}</span>),
    cell('priority', () => (
      <span className={row.priority === 'high' ? 'text-amber-300' : 'text-slate-300'}>{plain(row.priority)}</span>
    )),
    cell('type', () => plain(row.recordType)),
    cell('record', () => <span className="font-mono text-slate-300">{plain(row.recordId)}</span>),
    cell('indicator', () => <span className="text-white">{plain(row.indicator)}</span>),
    cell('raw', () => <span className="font-mono text-[11px] text-slate-300">{plain(row.rawValue)}</span>),
    cell('source', () => (
      <span className="text-[10px] text-slate-500">
        {plain(row.sourceFile)} · {plain(row.sourceSheet)} · {plain(row.sourceRow)}
      </span>
    )),
  ],
};
