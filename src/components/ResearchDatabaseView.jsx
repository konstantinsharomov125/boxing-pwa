import React, { useRef, useState } from 'react';
import {
  BookOpen, Plus, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, ShieldOff, X,
  Download, Upload, DatabaseBackup,
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
import { RESEARCH_DATABASE, getAllResearch } from '../data/researchDatabase';

const QUALIFICATION_OPTIONS = ['МСМК / Сборная РФ', 'МС / КМС', '1-й разряд / КМС'];
const AGE_GROUP_OPTIONS = AGE_GROUP_RULES.map((r) => r.ageGroup);
// Текущий год фиксируется при загрузке модуля — не вызывается при каждом рендере
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

/**
 * Вкладка «База исследований»: просмотр встроенных и пользовательских записей,
 * добавление новых исследований с ручной верификацией и допуском к сравнению.
 */
export default function ResearchDatabaseView() {
  const [entries, setEntries] = useState(() => loadUserResearch());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState([]);
  // Предпросмотр выбираемого файла и итог операции переноса базы
  const [importPreview, setImportPreview] = useState(null);
  const [transferMessage, setTransferMessage] = useState(null);
  const fileInputRef = useRef(null);

  const allEntries = getAllResearch();

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
    setEntries(loadUserResearch());
    setForm(emptyForm());
    setErrors([]);
    setIsFormOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('Удалить пользовательскую запись? Встроенные данные не затрагиваются.')) {
      deleteUserResearch(id);
      setEntries(loadUserResearch());
    }
  };

  // ---------------------------------------------------------------------------
  // Перенос пользовательской базы между устройствами (JSON-файл)
  // ---------------------------------------------------------------------------

  const handleExport = () => {
    const json = exportUserResearchJSON(entries);
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
      text: `Экспортировано записей: ${entries.length}. Файл можно перенести на другое устройство и импортировать здесь.`,
    });
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    // Сбрасываем выбор, чтобы повторный выбор того же файла снова вызывал onChange
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

  const applyImport = (mode) => {
    if (!importPreview) return;
    const result = importUserResearch(importPreview.text, { mode });
    setImportPreview(null);
    if (!result.ok) {
      setTransferMessage({ kind: 'error', text: `Импорт не выполнен: ${result.errors.join(' ')}` });
      return;
    }
    setEntries(loadUserResearch());
    const removedText = mode === 'replace' ? `, удалено из прежней базы: ${result.removed}` : '';
    const rejectedText = result.rejected.length > 0 ? `, отклонено некорректных: ${result.rejected.length}` : '';
    setTransferMessage({
      kind: 'ok',
      text: `Импорт завершён: добавлено ${result.added}${removedText}, пропущено дубликатов: ${result.skipped}${rejectedText}.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg space-y-5">
        <div className="flex justify-between items-center border-b border-slate-700 pb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <BookOpen className="w-6 h-6" /> База исследований
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Встроенные записи и пользовательские источники. Допуск к нормативному сравнению — только после выполнения всех условий верификации.
            </p>
          </div>
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isFormOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isFormOpen ? 'Скрыть форму' : 'Добавить исследование'}</span>
          </button>
        </div>

        {/* Перенос пользовательской базы: экспорт / импорт JSON */}
        <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1.5">
                <DatabaseBackup className="w-4 h-4 text-blue-400" /> Перенос базы исследований
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Экспорт сохраняет пользовательские записи в JSON-файл, импорт принимает файл с другого устройства.
                Встроенные модельные записи и данные спортсменов файлом не переносятся.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={entries.length === 0}
                title={entries.length === 0 ? 'Нет пользовательских записей для экспорта' : 'Скачать пользовательскую базу в JSON'}
                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" /> Экспорт JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Импорт JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileSelected}
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
                  onClick={() => { setImportPreview(null); setTransferMessage(null); }}
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
                  <span className="text-slate-500 block">Новых id</span>
                  <strong className="text-blue-400 font-mono">{importPreview.newCount}</strong>
                </div>
                <div className="bg-slate-900/70 rounded px-2 py-1.5 border border-slate-700">
                  <span className="text-slate-500 block">Дубликатов</span>
                  <strong className="text-amber-400 font-mono">{importPreview.duplicateCount}</strong>
                </div>
                <div className="bg-slate-900/70 rounded px-2 py-1.5 border border-slate-700">
                  <span className="text-slate-500 block">Отклонено</span>
                  <strong className="text-red-400 font-mono">{importPreview.rejected.length}</strong>
                </div>
              </div>

              {importPreview.warnings.map((warn, i) => (
                <p key={i} className="text-[11px] text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span>{warn}</span>
                </p>
              ))}

              {importPreview.rejected.length > 0 && (
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
                  Добавить новые ({importPreview.newCount})
                </button>
                <button
                  type="button"
                  onClick={() => applyImport('replace')}
                  className="flex-1 bg-amber-600/80 hover:bg-amber-500 text-white py-2 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Заменить базу целиком
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                «Добавить новые» пополняет базу и пропускает записи с уже существующими id. «Заменить базу целиком»
                удаляет текущие пользовательские записи — предварительно сохраните их экспортом.
              </p>
            </div>
          )}
        </div>

        {/* Форма добавления */}
        {isFormOpen && (
          <form onSubmit={handleSubmit} className="bg-slate-900/80 rounded-xl border border-blue-500/30 p-5 space-y-4">
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

            {/* Показатели */}
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

            {/* Статус и условия допуска */}
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
              <button type="button" onClick={() => { setIsFormOpen(false); setErrors([]); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-xs font-medium cursor-pointer">
                Отмена
              </button>
              <button type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-medium cursor-pointer">
                Сохранить запись
              </button>
            </div>
          </form>
        )}

        {/* Список записей */}
        <div className="space-y-3">
          {allEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              isBuiltin={RESEARCH_DATABASE.some((r) => r.id === entry.id)}
              onDelete={entry.userProvided ? () => handleDelete(entry.id) : null}
            />
          ))}
        </div>

        <p className="text-[11px] text-slate-500 italic">
          Пользовательские записи: {entries.length}. Хранятся локально в браузере (box_research_user) и объединяются со встроенной базой при анализе.
        </p>
      </div>
    </div>
  );
}

function EntryCard({ entry, isBuiltin, onDelete }) {
  const statusLabel = DATA_QUALITY_STATUSES[entry.dataStatus]?.labelRu;
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
              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold flex items-center gap-1 ${
                admitted
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              }`}>
                {admitted
                  ? <><ShieldCheck className="w-3 h-3" /> Допущена к сравнению</>
                  : <><ShieldOff className="w-3 h-3" /> Не допущена</>}
              </span>
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
        {entry.sampleSize != null && <span>n = {entry.sampleSize}</span>}
        {statusLabel && !isBuiltin && <span>Статус: {statusLabel}</span>}
        {isBuiltin && <span>Статус: Непроверенные данные</span>}
      </div>

      {entry.metrics && (
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

      {!isBuiltin && !admitted && (
        <p className="text-[10px] text-amber-500/70">
          Для допуска к нормативному сравнению необходимы статус «Верифицировано по полному тексту/первоисточнику» и все 4 отметки условий допуска.
        </p>
      )}
      {isBuiltin && (
        <p className="text-[10px] text-slate-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Допуск встроенных записей изменяется только после верификации источников (вне интерфейса).
        </p>
      )}
    </div>
  );
}
