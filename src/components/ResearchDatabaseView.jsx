import React, { useRef, useState, useMemo } from 'react';
import {
  BookOpen, Plus, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, ShieldOff, X,
  Download, Upload, DatabaseBackup, Search, Filter, RotateCcw, FileJson,
} from 'lucide-react';
import { DATA_QUALITY_STATUSES, AGE_GROUP_RULES, getMetricById } from '../data/modelsConfig';
import {
  loadUserResearch,
  addUserResearch,
  deleteUserResearch,
  validateUserEntry,
  normalizeUserEntry,
  exportUserResearchJSON,
  userResearchFileName,
  peekUserResearchImport,
  importUserResearch,
  USER_ENTRY_METRICS,
  ADMISSION_CONDITIONS,
  getUserAllowedStatuses,
} from '../data/userResearchStore';
import {
  loadBibliography,
  deleteBibliographyEntry,
  importBibliographyFile,
  exportBibliographyJSON,
} from '../data/bibliographyStore';
import { RESEARCH_DATABASE, getAllResearch } from '../data/researchDatabase';
import StagingResearchView from './StagingResearchView';
import { getQualificationOptions } from '../data/qualifications.js';

const QUALIFICATION_OPTIONS = getQualificationOptions().map((q) => q.label);
const AGE_GROUP_OPTIONS = AGE_GROUP_RULES.map((r) => r.ageGroup);
const CURRENT_YEAR = new Date().getFullYear();

const emptyForm = () => ({
  author: '',
  year: '',
  citation: '',
  group: '',
  qualification: '',
  weightCategory: '',
  sex: '',
  style: '',
  sampleSize: '',
  protocol: '',
  dataStatus: 'unverified',
  admissionConditions: [false, false, false, false],
  metrics: Object.fromEntries(USER_ENTRY_METRICS.map((id) => [id, { mean: '', sd: '' }])),
});

const initialFilters = () => ({
  search: '',
  status: '',
  sourceType: '',
  group: '',
  qualification: '',
  sex: '',
  yearFrom: '',
  yearTo: '',
  hasMetrics: '',
  hasAbstract: '',
  hasFullText: '',
  hasExtractedResults: '',
  eligibleForComparison: '',
});

function inRange(year, from, to) {
  if (year == null) return false;
  const y = Number(year);
  if (!Number.isFinite(y)) return false;
  const f = from === '' ? null : Number(from);
  const t = to === '' ? null : Number(to);
  if (f != null && y < f) return false;
  if (t != null && y > t) return false;
  return true;
}

function matchSearch(entry, query) {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const fields = [
    entry.title,
    entry.author,
    entry.citation,
    entry.journal,
    entry.doi,
    entry.pmid,
    entry.sourceId,
    entry.sourceType,
    ...(Array.isArray(entry.authors) ? entry.authors : []),
    ...(Array.isArray(entry.keywords) ? entry.keywords : []),
  ].filter(Boolean);
  return fields.some((f) => String(f).toLowerCase().includes(q));
}

function getSourceTypeLabel(type) {
  const labels = {
    pubmed: 'PubMed',
    europepmc: 'Europe PMC',
    openalex: 'OpenAlex',
    crossref: 'Crossref',
    manual: 'Вручную',
    reactionTimeLiterature: 'Библиотека реакции',
  };
  return labels[type] || type || 'Не указан';
}

export default function ResearchDatabaseView() {
  const [activeSection, setActiveSection] = useState('research');
  const [filters, setFilters] = useState(initialFilters);
  const [sortBy, setSortBy] = useState('yearDesc');

  const [researchEntries, setResearchEntries] = useState(() => loadUserResearch());
  const [bibliographyEntries, setBibliographyEntries] = useState(() => loadBibliography());

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState([]);
  const [transferMessage, setTransferMessage] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const researchFileInputRef = useRef(null);

  const [bibImportPreview, setBibImportPreview] = useState(null);
  const [bibTransferMessage, setBibTransferMessage] = useState(null);
  const bibFileInputRef = useRef(null);

  const allResearch = getAllResearch();

  const statusOptions = useMemo(() => {
    return Object.entries(DATA_QUALITY_STATUSES).map(([key, value]) => ({ key, label: value.labelRu }));
  }, []);

  const sourceTypeOptions = useMemo(() => {
    const types = new Set(bibliographyEntries.map((e) => e.sourceType).filter(Boolean));
    return Array.from(types).sort();
  }, [bibliographyEntries]);

  const groupOptions = useMemo(() => {
    const groups = new Set(allResearch.map((e) => e.group).filter(Boolean));
    return Array.from(groups).sort();
  }, [allResearch]);

  const qualificationOptions = useMemo(() => {
    const fromDb = new Set(allResearch.map((e) => e.qualification).filter(Boolean));
    const combined = new Set(QUALIFICATION_OPTIONS.concat(Array.from(fromDb)));
    return Array.from(combined);
  }, [allResearch]);

  const filteredResearch = useMemo(() => {
    const list = allResearch.filter((entry) => {
      if (!matchSearch(entry, filters.search)) return false;
      if (filters.status && entry.dataStatus !== filters.status) return false;
      if (filters.group && entry.group !== filters.group) return false;
      if (filters.qualification && entry.qualification !== filters.qualification) return false;
      if (filters.sex && entry.sex !== filters.sex) return false;
      if (!inRange(entry.year, filters.yearFrom, filters.yearTo)) return false;
      if (filters.hasMetrics) {
        const has = Object.keys(entry.metrics || {}).length > 0;
        if (filters.hasMetrics === 'yes' && !has) return false;
        if (filters.hasMetrics === 'no' && has) return false;
      }
      if (filters.eligibleForComparison) {
        const eligible = entry.admission?.eligibleForComparison === true;
        if (filters.eligibleForComparison === 'yes' && !eligible) return false;
        if (filters.eligibleForComparison === 'no' && eligible) return false;
      }
      return true;
    });

    return sortList(list, sortBy);
  }, [allResearch, filters, sortBy]);

  const filteredBibliography = useMemo(() => {
    const list = bibliographyEntries.filter((entry) => {
      if (!matchSearch(entry, filters.search)) return false;
      if (filters.status && entry.dataQualityStatus !== filters.status) return false;
      if (filters.sourceType && entry.sourceType !== filters.sourceType) return false;
      if (!inRange(entry.year, filters.yearFrom, filters.yearTo)) return false;
      if (filters.hasAbstract) {
        const has = Boolean(entry.abstract);
        if (filters.hasAbstract === 'yes' && !has) return false;
        if (filters.hasAbstract === 'no' && has) return false;
      }
      if (filters.hasFullText) {
        const has = entry.hasFullText === true;
        if (filters.hasFullText === 'yes' && !has) return false;
        if (filters.hasFullText === 'no' && has) return false;
      }
      if (filters.hasExtractedResults) {
        const has = entry.extractedResults === true;
        if (filters.hasExtractedResults === 'yes' && !has) return false;
        if (filters.hasExtractedResults === 'no' && has) return false;
      }
      if (filters.eligibleForComparison) {
        const eligible = entry.admission?.eligibleForComparison === true;
        if (filters.eligibleForComparison === 'yes' && !eligible) return false;
        if (filters.eligibleForComparison === 'no' && eligible) return false;
      }
      return true;
    });

    return sortList(list, sortBy);
  }, [bibliographyEntries, filters, sortBy]);

  function sortList(list, sort) {
    const sorted = [...list];
    switch (sort) {
      case 'yearDesc':
        sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        break;
      case 'yearAsc':
        sorted.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
        break;
      case 'title':
        sorted.sort((a, b) => String(a.title || a.author || '').localeCompare(String(b.title || b.author || '')));
        break;
      case 'status':
        sorted.sort((a, b) => String(a.dataQualityStatus || '').localeCompare(String(b.dataQualityStatus || '')));
        break;
      default:
        break;
    }
    return sorted;
  }

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters(initialFilters);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setMetricField = (metricId, field, value) =>
    setForm((prev) => ({
      ...prev,
      metrics: { ...prev.metrics, [metricId]: { ...prev.metrics[metricId], [field]: value } },
    }));
  const toggleCondition = (idx) =>
    setForm((prev) => ({
      ...prev,
      admissionConditions: prev.admissionConditions.map((v, i) => (i === idx ? !v : v)),
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const prepared = {
      ...form,
      group: form.group || null,
      qualification: form.qualification || null,
      weightCategory: form.weightCategory || null,
      sex: form.sex || null,
      sampleSize: form.sampleSize === '' ? null : form.sampleSize,
    };
    const result = validateUserEntry(prepared);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    addUserResearch(normalizeUserEntry(prepared));
    setResearchEntries(loadUserResearch());
    setForm(emptyForm());
    setErrors([]);
    setIsFormOpen(false);
  };

  const handleDeleteResearch = (id) => {
    if (window.confirm('Удалить пользовательскую запись? Встроенные данные не затрагиваются.')) {
      deleteUserResearch(id);
      setResearchEntries(loadUserResearch());
    }
  };

  const handleDeleteBibliography = (id) => {
    if (window.confirm('Удалить библиографическую запись?')) {
      deleteBibliographyEntry(id);
      setBibliographyEntries(loadBibliography());
    }
  };

  // ---------------------------------------------------------------------------
  // Перенос пользовательской базы между устройствами (JSON-файл)
  // ---------------------------------------------------------------------------

  const handleExportResearch = () => {
    const json = exportUserResearchJSON(researchEntries);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', userResearchFileName());
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setImportPreview(null);
    setTransferMessage({
      kind: 'ok',
      text: `Экспортировано записей: ${researchEntries.length}. Файл можно перенести на другое устройство и импортировать здесь.`,
    });
  };

  const handleResearchFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setTransferMessage(null);
    if (!file) return;

    let text = '';
    try {
      text = await file.text();
    } catch {
      setTransferMessage({ kind: 'error', text: 'Не удалось прочитать выбранный файл.' });
      return;
    }

    const preview = peekUserResearchImport(text);
    if (!preview.ok) {
      setImportPreview(null);
      setTransferMessage({ kind: 'error', text: `Файл не принят: ${preview.errors.join(' ')}` });
      return;
    }
    setImportPreview({
      fileName: file.name,
      text,
      total: preview.total,
      validCount: preview.validCount,
      newCount: preview.newCount,
      duplicateCount: preview.duplicateCount,
      rejected: preview.rejected,
      warnings: preview.warnings,
    });
  };

  const applyResearchImport = (mode) => {
    if (!importPreview) return;
    const result = importUserResearch(importPreview.text, { mode });
    setImportPreview(null);
    if (!result.ok) {
      setTransferMessage({ kind: 'error', text: `Импорт не выполнен: ${result.errors.join(' ')}` });
      return;
    }
    setResearchEntries(loadUserResearch());
    const removedText = mode === 'replace' ? `, удалено из прежней базы: ${result.removed}` : '';
    const rejectedText = result.rejected.length > 0 ? `, отклонено некорректных: ${result.rejected.length}` : '';
    setTransferMessage({
      kind: 'ok',
      text: `Импорт завершён: добавлено ${result.added}${removedText}, пропущено дубликатов: ${result.skipped}${rejectedText}.`,
    });
  };

  // ---------------------------------------------------------------------------
  // Импорт/экспорт библиографии
  // ---------------------------------------------------------------------------

  const handleExportBibliography = () => {
    const json = exportBibliographyJSON();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const local = new Date();
    const iso = new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    link.setAttribute('download', `Библиография_${iso}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setBibTransferMessage({
      kind: 'ok',
      text: `Экспортировано библиографических записей: ${bibliographyEntries.length}.`,
    });
  };

  const handleBibliographyFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setBibTransferMessage(null);
    if (!file) return;

    let text = '';
    try {
      text = await file.text();
    } catch {
      setBibTransferMessage({ kind: 'error', text: 'Не удалось прочитать выбранный файл.' });
      return;
    }

    const preview = importBibliographyFile(text);
    if (!preview.ok) {
      setBibImportPreview(null);
      setBibTransferMessage({ kind: 'error', text: `Файл не принят: ${preview.errors.join(' ')}` });
      return;
    }
    setBibImportPreview({
      fileName: file.name,
      text,
      total: preview.total,
      validCount: preview.entries.length,
      newCount: preview.entries.length,
      skipped: preview.skipped.length,
    });
  };

  const applyBibliographyImport = () => {
    if (!bibImportPreview) return;
    const result = importBibliographyFile(bibImportPreview.text);
    setBibImportPreview(null);
    if (!result.ok) {
      setBibTransferMessage({ kind: 'error', text: `Импорт не выполнен: ${result.errors.join(' ')}` });
      return;
    }
    setBibliographyEntries(loadBibliography());
    setBibTransferMessage({
      kind: 'ok',
      text: `Импорт библиографии завершён: добавлено ${result.added}, пропущено/отклонено: ${result.skipped}.`,
    });
  };

  const currentList = activeSection === 'research' ? filteredResearch : filteredBibliography;
  const currentCount = currentList.length;
  const totalResearch = allResearch.length;
  const totalBibliography = bibliographyEntries.length;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg space-y-5">
        <div className="flex justify-between items-center border-b border-slate-700 pb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <BookOpen className="w-6 h-6" /> Научная библиотека
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Референтные модели, пользовательские записи и библиографические карточки.
              Библиографические записи не являются проверенными референтными моделями до верификации по первоисточнику.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-4">
          <button
            onClick={() => setActiveSection('research')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'research'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <DatabaseBackup className="w-4 h-4" /> Исследования и модели ({totalResearch})
          </button>
          <button
            onClick={() => setActiveSection('bibliography')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'bibliography'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Библиография ({totalBibliography})
          </button>
          <button
            onClick={() => setActiveSection('staging')}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'staging'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <DatabaseBackup className="w-4 h-4" /> Научный пакет (staging)
          </button>
        </div>

        {activeSection === 'staging' && <StagingResearchView />}

        {activeSection === 'research' && (
          <ResearchTransferSection
            entries={researchEntries}
            onExport={handleExportResearch}
            onFileSelect={() => researchFileInputRef.current?.click()}
            fileInputRef={researchFileInputRef}
            onFileSelected={handleResearchFileSelected}
            importPreview={importPreview}
            setImportPreview={setImportPreview}
            transferMessage={transferMessage}
            applyImport={applyResearchImport}
            kind="исследований"
          />
        )}

        {activeSection === 'bibliography' && (
          <ResearchTransferSection
            entries={bibliographyEntries}
            onExport={handleExportBibliography}
            onFileSelect={() => bibFileInputRef.current?.click()}
            fileInputRef={bibFileInputRef}
            onFileSelected={handleBibliographyFileSelected}
            importPreview={bibImportPreview}
            setImportPreview={setBibImportPreview}
            transferMessage={bibTransferMessage}
            applyImport={applyBibliographyImport}
            kind="библиографии"
          />
        )}

        <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[16rem]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                placeholder="Поиск по названию, авторам, DOI, PMID…"
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white cursor-pointer"
              >
                <option value="yearDesc">Год: новее</option>
                <option value="yearAsc">Год: старше</option>
                <option value="title">Название</option>
                <option value="status">Статус</option>
              </select>
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                title="Сбросить фильтры"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Сброс
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <FilterSelect
              label="Статус"
              value={filters.status}
              onChange={(v) => setFilter('status', v)}
              options={statusOptions.map((s) => ({ value: s.key, label: s.label }))}
            />
            {activeSection === 'research' ? (
              <>
                <FilterSelect
                  label="Возрастная группа"
                  value={filters.group}
                  onChange={(v) => setFilter('group', v)}
                  options={groupOptions.map((g) => ({ value: g, label: g }))}
                  emptyLabel="Нет данных"
                />
                <FilterSelect
                  label="Квалификация"
                  value={filters.qualification}
                  onChange={(v) => setFilter('qualification', v)}
                  options={qualificationOptions.map((q) => ({ value: q, label: q }))}
                  emptyLabel="Нет данных"
                />
                <FilterSelect
                  label="Пол"
                  value={filters.sex}
                  onChange={(v) => setFilter('sex', v)}
                  options={[
                    { value: 'male', label: 'Мужской' },
                    { value: 'female', label: 'Женский' },
                  ]}
                />
                <FilterSelect
                  label="Есть показатели"
                  value={filters.hasMetrics}
                  onChange={(v) => setFilter('hasMetrics', v)}
                  options={[
                    { value: 'yes', label: 'Да' },
                    { value: 'no', label: 'Нет' },
                  ]}
                />
                <FilterSelect
                  label="Допущена к сравнению"
                  value={filters.eligibleForComparison}
                  onChange={(v) => setFilter('eligibleForComparison', v)}
                  options={[
                    { value: 'yes', label: 'Да' },
                    { value: 'no', label: 'Нет' },
                  ]}
                />
              </>
            ) : (
              <>
                <FilterSelect
                  label="Источник"
                  value={filters.sourceType}
                  onChange={(v) => setFilter('sourceType', v)}
                  options={sourceTypeOptions.map((s) => ({ value: s, label: getSourceTypeLabel(s) }))}
                  emptyLabel="Нет данных"
                />
                <FilterSelect
                  label="Есть аннотация"
                  value={filters.hasAbstract}
                  onChange={(v) => setFilter('hasAbstract', v)}
                  options={[
                    { value: 'yes', label: 'Да' },
                    { value: 'no', label: 'Нет' },
                  ]}
                />
                <FilterSelect
                  label="Полный текст"
                  value={filters.hasFullText}
                  onChange={(v) => setFilter('hasFullText', v)}
                  options={[
                    { value: 'yes', label: 'Да' },
                    { value: 'no', label: 'Нет' },
                  ]}
                />
                <FilterSelect
                  label="Извлечены результаты"
                  value={filters.hasExtractedResults}
                  onChange={(v) => setFilter('hasExtractedResults', v)}
                  options={[
                    { value: 'yes', label: 'Да' },
                    { value: 'no', label: 'Нет' },
                  ]}
                />
                <FilterSelect
                  label="Допущена к сравнению"
                  value={filters.eligibleForComparison}
                  onChange={(v) => setFilter('eligibleForComparison', v)}
                  options={[
                    { value: 'yes', label: 'Да' },
                    { value: 'no', label: 'Нет' },
                  ]}
                />
              </>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-slate-400 block mb-1">Год с</label>
                <input
                  type="number"
                  min="1500"
                  max={CURRENT_YEAR}
                  value={filters.yearFrom}
                  onChange={(e) => setFilter('yearFrom', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-400 block mb-1">по</label>
                <input
                  type="number"
                  min="1500"
                  max={CURRENT_YEAR}
                  value={filters.yearTo}
                  onChange={(e) => setFilter('yearTo', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {activeSection === 'research' && (
          <div className="flex justify-between items-center flex-wrap gap-3">
            <button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isFormOpen ? 'Скрыть форму' : 'Добавить исследование'}</span>
            </button>
            <p className="text-[11px] text-slate-500">
              Показано {currentCount} из {totalResearch}
            </p>
          </div>
        )}

        {activeSection === 'bibliography' && (
          <div className="flex justify-between items-center">
            <p className="text-[11px] text-slate-500">
              Показано {currentCount} из {totalBibliography}
            </p>
            <p className="text-[10px] text-slate-500 italic max-w-md text-right">
              Библиографические записи импортируются из файлов, созданных CLI `npm run import-research`.
              Они не участвуют в референтном сравнении до ручной верификации.
            </p>
          </div>
        )}

        {isFormOpen && activeSection === 'research' && (
          <ResearchEntryForm
            form={form}
            errors={errors}
            setField={setField}
            setMetricField={setMetricField}
            toggleCondition={toggleCondition}
            onSubmit={handleSubmit}
            onCancel={() => { setIsFormOpen(false); setErrors([]); }}
          />
        )}

        <div className="space-y-3">
          {currentCount === 0 && (
            <div className="bg-slate-900/40 border border-dashed border-slate-700 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-400">Нет записей, соответствующих фильтрам.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {activeSection === 'research'
                  ? 'Добавьте пользовательскую запись или измените фильтры.'
                  : 'Импортируйте библиографию из файла или измените фильтры.'}
              </p>
            </div>
          )}

          {activeSection === 'research' && currentList.map((entry) => (
            <ResearchEntryCard
              key={entry.id}
              entry={entry}
              onDelete={entry.userProvided ? () => handleDeleteResearch(entry.id) : null}
            />
          ))}

          {activeSection === 'bibliography' && currentList.map((entry) => (
            <BibliographyEntryCard
              key={entry.id}
              entry={entry}
              onDelete={() => handleDeleteBibliography(entry.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, emptyLabel }) {
  const hasOptions = options.length > 0;
  return (
    <div>
      <label className="text-[10px] text-slate-400 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!hasOptions}
        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        <option value="">{hasOptions ? 'Все' : emptyLabel || 'Нет данных'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ResearchTransferSection({
  entries,
  onExport,
  onFileSelect,
  fileInputRef,
  onFileSelected,
  importPreview,
  setImportPreview,
  transferMessage,
  applyImport,
  kind,
}) {
  const isResearch = kind === 'исследований';

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1.5">
            <DatabaseBackup className="w-4 h-4 text-blue-400" /> Перенос базы {kind}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Экспорт сохраняет записи в JSON-файл, импорт принимает файл с другого устройства.
            Встроенные модельные записи и данные спортсменов файлом не переносятся.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExport}
            disabled={entries.length === 0}
            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> Экспорт JSON
          </button>
          <button
            onClick={onFileSelect}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Импорт JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onFileSelected}
            className="hidden"
          />
        </div>
      </div>

      {transferMessage && (
        <p className={`text-[11px] flex items-start gap-1.5 ${
          transferMessage.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {transferMessage.kind === 'ok'
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          <span>{transferMessage.text}</span>
        </p>
      )}

      {importPreview && (
        <div className="bg-slate-800/80 rounded-lg border border-blue-500/30 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-blue-400 break-all">Файл: {importPreview.fileName}</span>
            <button
              onClick={() => { setImportPreview(null); }}
              className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
              title="Отменить импорт"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
            <div className="bg-slate-900/70 rounded px-2 py-1.5 border border-slate-700">
              <span className="text-slate-500 block">В файле</span>
              <strong className="text-slate-200 font-mono">{importPreview.total}</strong>
            </div>
            <div className="bg-slate-900/70 rounded px-2 py-1.5 border border-slate-700">
              <span className="text-slate-500 block">Корректных</span>
              <strong className="text-emerald-400 font-mono">{importPreview.validCount}</strong>
            </div>
            <div className="bg-slate-900/70 rounded px-2 py-1.5 border border-slate-700">
              <span className="text-slate-500 block">Новых</span>
              <strong className="text-blue-400 font-mono">{importPreview.newCount}</strong>
            </div>
            <div className="bg-slate-900/70 rounded px-2 py-1.5 border border-slate-700">
              <span className="text-slate-500 block">Дубликатов</span>
              <strong className="text-amber-400 font-mono">{importPreview.duplicateCount ?? importPreview.skipped ?? 0}</strong>
            </div>
            <div className="bg-slate-900/70 rounded px-2 py-1.5 border border-slate-700">
              <span className="text-slate-500 block">Отклонено</span>
              <strong className="text-red-400 font-mono">{importPreview.rejected?.length ?? 0}</strong>
            </div>
          </div>

          {importPreview.rejected && importPreview.rejected.length > 0 && (
            <details className="text-[11px] text-slate-400">
              <summary className="cursor-pointer hover:text-slate-300">Причины отклонения записей</summary>
              <ul className="mt-1.5 space-y-1">
                {importPreview.rejected.slice(0, 10).map((row) => (
                  <li key={row.index} className="text-red-300">
                    №{row.index} ({row.label}): {row.errors.join(' ')}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => applyImport('merge')}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-medium cursor-pointer"
            >
              {isResearch ? `Добавить новые (${importPreview.newCount})` : `Импортировать (${importPreview.newCount})`}
            </button>
            {isResearch && (
              <button
                type="button"
                onClick={() => applyImport('replace')}
                className="flex-1 bg-amber-600/80 hover:bg-amber-500 text-white py-2 rounded-lg text-xs font-medium cursor-pointer"
              >
                Заменить базу целиком
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResearchEntryForm({ form, errors, setField, setMetricField, toggleCondition, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="bg-slate-900/80 rounded-xl border border-blue-500/30 p-5 space-y-4">
      <h3 className="text-sm font-bold uppercase text-blue-400">Новая запись исследования</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Автор(ы) *</label>
          <input type="text" value={form.author} onChange={(e) => setField('author', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Год *</label>
          <input type="number" min="1950" max={CURRENT_YEAR} value={form.year} onChange={(e) => setField('year', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Размер выборки (n)</label>
          <input type="number" min="1" value={form.sampleSize} onChange={(e) => setField('sampleSize', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Библиографическая ссылка * (не короче 20 символов)</label>
        <input type="text" value={form.citation} onChange={(e) => setField('citation', e.target.value)}
          placeholder="Автор. Название. — Город: Издательство, год."
          className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Возрастная группа</label>
          <select value={form.group} onChange={(e) => setField('group', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white cursor-pointer">
            <option value="">Не указана</option>
            {AGE_GROUP_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Квалификация</label>
          <select value={form.qualification} onChange={(e) => setField('qualification', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white cursor-pointer">
            <option value="">Не указана</option>
            {QUALIFICATION_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Пол</label>
          <select value={form.sex} onChange={(e) => setField('sex', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white cursor-pointer">
            <option value="">Не указан</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Весовая категория</label>
          <input type="text" value={form.weightCategory} onChange={(e) => setField('weightCategory', e.target.value)}
            placeholder="например, Средний вес (63.5–75 кг)"
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Протокол измерения / условия</label>
        <textarea rows={2} value={form.protocol} onChange={(e) => setField('protocol', e.target.value)}
          placeholder="Оборудование, методика, условия тестирования…"
          className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase text-slate-300">Показатели (среднее ± SD)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {USER_ENTRY_METRICS.map((metricId) => {
            const metric = getMetricById(metricId);
            return (
              <div key={metricId} className="bg-slate-800/80 rounded-lg border border-slate-700 p-3 space-y-2">
                <div className="text-[11px] font-semibold text-slate-300">
                  {metric?.nameRu || metricId}
                  <span className="text-slate-500 font-normal"> ({metric?.unit || '—'})</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="0.01" placeholder="Среднее"
                    value={form.metrics[metricId].mean}
                    onChange={(e) => setMetricField(metricId, 'mean', e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                  <input type="number" step="0.01" min="0" placeholder="SD"
                    value={form.metrics[metricId].sd}
                    onChange={(e) => setMetricField(metricId, 'sd', e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Статус достоверности *</label>
          <select value={form.dataStatus} onChange={(e) => setField('dataStatus', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white cursor-pointer">
            {getUserAllowedStatuses().map((s) => (
              <option key={s} value={s}>{DATA_QUALITY_STATUSES[s].labelRu}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            {DATA_QUALITY_STATUSES[form.dataStatus]?.description}
          </p>
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Условия допуска к сравнению</label>
          <div className="space-y-1.5">
            {ADMISSION_CONDITIONS.map((cond, i) => (
              <label key={i} className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.admissionConditions[i]} onChange={() => toggleCondition(i)}
                  className="mt-0.5 accent-blue-500" />
                <span>{cond}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-red-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {err}
            </p>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-xs font-medium cursor-pointer">
          Отмена
        </button>
        <button type="submit"
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-medium cursor-pointer">
          Сохранить запись
        </button>
      </div>
    </form>
  );
}

function ResearchEntryCard({ entry, onDelete }) {
  const statusLabel = DATA_QUALITY_STATUSES[entry.dataStatus]?.labelRu;
  const isBuiltin = RESEARCH_DATABASE.some((r) => r.id === entry.id);
  const conditions = entry.admissionConditions || [];
  const allConditions = conditions.length === 4 && conditions.every(Boolean);
  const admissibleStatus = entry.dataStatus === 'verified_fulltext' || entry.dataStatus === 'verified_primary';
  const admitted = !isBuiltin ? allConditions && admissibleStatus : false;

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-700 p-4 space-y-2">
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-blue-400">
            {entry.author}{entry.year ? ` (${entry.year})` : ''}
          </span>
          <p className="text-xs text-slate-300 italic">{entry.citation}</p>
        </div>
        <div className="flex items-center gap-2">
          {isBuiltin ? (
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">Встроенная</span>
          ) : (
            <>
              <AdmissionBadge admitted={admitted} />
              {onDelete && (
                <button onClick={onDelete} className="text-slate-500 hover:text-red-400 p-1 cursor-pointer" title="Удалить запись">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
        {entry.group && <span>Группа: {entry.group}</span>}
        {entry.qualification && <span>Квалификация: {entry.qualification}</span>}
        {entry.weightCategory && <span>Вес: {entry.weightCategory}</span>}
        {entry.sex && <span>Пол: {entry.sex === 'male' ? 'муж' : 'жен'}</span>}
        {entry.sampleSize != null && <span>n = {entry.sampleSize}</span>}
        {statusLabel && <span>Статус: {statusLabel}</span>}
      </div>

      {entry.protocol && (
        <p className="text-[10px] text-slate-500">
          <span className="text-slate-400">Протокол:</span> {entry.protocol}
        </p>
      )}

      {entry.metrics && Object.keys(entry.metrics).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800 text-[11px]">
          {Object.entries(entry.metrics).map(([metricId, m]) => {
            const metric = getMetricById(metricId);
            return (
              <div key={metricId}>
                <span className="text-[10px] text-slate-500 block">{metric?.nameRu || metricId}:</span>
                <strong className="text-emerald-400 font-mono">
                  {m.mean}{m.sd != null ? ` ± ${m.sd}` : ''} {m.unit}
                </strong>
              </div>
            );
          })}
        </div>
      )}

      {!admitted && (
        <p className="text-[10px] text-amber-500/70">
          {isBuiltin
            ? 'Допуск встроенных записей изменяется только после верификации источников.'
            : 'Для допуска к нормативному сравнению необходимы статус «Верифицировано» и все 4 отметки условий допуска.'}
        </p>
      )}
    </div>
  );
}

function BibliographyEntryCard({ entry, onDelete }) {
  const [showAbstract, setShowAbstract] = useState(false);
  const statusLabel = DATA_QUALITY_STATUSES[entry.dataQualityStatus]?.labelRu;

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-700 p-4 space-y-2">
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div className="space-y-0.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">
              {getSourceTypeLabel(entry.sourceType)}
            </span>
            <span className="text-[10px] text-slate-500">{statusLabel}</span>
          </div>
          <h4 className="text-xs font-bold text-blue-400">{entry.title || 'Название не указано'}</h4>
          <p className="text-xs text-slate-300 italic">
            {entry.authors?.join(', ') || 'Авторы не указаны'}
            {entry.year ? ` (${entry.year})` : ''}
            {entry.journal ? ` · ${entry.journal}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdmissionBadge admitted={entry.admission?.eligibleForComparison === true} />
          {onDelete && (
            <button onClick={onDelete} className="text-slate-500 hover:text-red-400 p-1 cursor-pointer" title="Удалить запись">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
        {entry.doi && <span>DOI: {entry.doi}</span>}
        {entry.pmid && <span>PMID: {entry.pmid}</span>}
        {entry.pmcid && <span>PMCID: {entry.pmcid}</span>}
        {entry.openAlexId && <span>OpenAlex: {entry.openAlexId.split('/').pop()}</span>}
        {entry.language && <span>Язык: {entry.language}</span>}
      </div>

      {entry.abstract && (
        <div className="pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowAbstract((v) => !v)}
            className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1"
          >
            <FileJson className="w-3 h-3" />
            {showAbstract ? 'Скрыть аннотацию' : 'Показать аннотацию'}
          </button>
          {showAbstract && (
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{entry.abstract}</p>
          )}
        </div>
      )}

      {entry.limitations && entry.limitations.length > 0 && (
        <div className="pt-1 border-t border-slate-800 space-y-1">
          {entry.limitations.map((limit, i) => (
            <p key={i} className="text-[10px] text-amber-500/70 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {limit}
            </p>
          ))}
        </div>
      )}

      {entry.url && (
        <a href={entry.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:underline block">
          Открыть источник
        </a>
      )}
    </div>
  );
}

function AdmissionBadge({ admitted }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold flex items-center gap-1 ${
      admitted
        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
        : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
    }`}>
      {admitted
        ? <><ShieldCheck className="w-3 h-3" /> Допущена к сравнению</>
        : <><ShieldOff className="w-3 h-3" /> Не допущена</>}
    </span>
  );
}
