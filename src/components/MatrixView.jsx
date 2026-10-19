import React, { useState, useEffect, useMemo } from 'react';
import { Brain, Sparkles, AlertTriangle, BookOpen, Layers, Target, ShieldAlert, Filter, Info, CheckCircle2, Activity } from 'lucide-react';
import { getQualificationOptions, normalizeAthleteQualification } from '../data/qualifications.js';
import { getAllResearch } from '../data/researchDatabase';
import { getMetricById } from '../data/modelsConfig';
import { analyzeAthleteProfile } from '../utils/fullAnalyzer';
import AnalyzerResultsView from './AnalyzerResultsView';

export default function MatrixView({ athlete }) {
  const physStorageKey = `box_phys_${athlete.id}`;

  const [physData, setPhysData] = useState(() => {
    const saved = localStorage.getItem(physStorageKey);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return null;
  });

  useEffect(() => {
    const saved = localStorage.getItem(physStorageKey);
    if (saved) {
      try { setPhysData(JSON.parse(saved)); } catch { /* ignore */ }
    } else {
      setPhysData(null);
    }
  }, [athlete.id, physStorageKey]);

  const report = useMemo(
    () => analyzeAthleteProfile(athlete, physData),
    [athlete, physData],
  );

  // Фильтры литературной базы
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('Все');
  const [selectedQualFilter, setSelectedQualFilter] = useState('Все');

  const filteredResearch = useMemo(() => {
    const selectedQualId = normalizeAthleteQualification(selectedQualFilter);
    return getAllResearch().filter((item) => {
      const matchGroup = selectedGroupFilter === 'Все' || item.group === selectedGroupFilter;
      const itemQualId = normalizeAthleteQualification(item.qualification);
      const matchQual = selectedQualFilter === 'Все'
        || itemQualId === selectedQualId
        || (selectedQualFilter !== 'Все' && item.qualification === selectedQualFilter);
      return matchGroup && matchQual;
    });
  }, [selectedGroupFilter, selectedQualFilter]);

  const hasData = physData !== null;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
        {/* Заголовок */}
        <div className="flex justify-between items-center border-b border-slate-700 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <Brain className="w-6 h-6" /> Экспертный модуль определения стиля и коррекции
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Индивидуальный профиль, лимитирующие факторы и направления подготовки на основе фактических данных.
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Динамическая база активна
          </div>
        </div>

        {/* 1. ИНДИВИДУАЛЬНЫЙ ПРОФИЛЬ И СТИЛЬ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-blue-500/30 mb-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-blue-400 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Target className="w-4 h-4" /> 1. Индивидуальный профиль и предпочтительный стиль
          </h3>

          {!hasData ? (
            <div className="text-xs text-slate-500 italic py-4 text-center">
              Нет данных для анализа. Заполните морфофункциональный профиль спортсмена.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/90 p-4 rounded-xl border border-blue-500/40">
                  <span className="text-[10px] uppercase font-bold text-blue-400">Ведущий стиль</span>
                  <div className="text-lg font-bold text-white mt-1">{report.styleClassification.primary?.name || '—'}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, report.styleClassification.primary?.score || 0)}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-blue-400">{report.styleClassification.primary?.score ?? 0}%</span>
                  </div>
                </div>

                <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Вторичный стиль</span>
                  <div className="text-lg font-bold text-slate-200 mt-1">{report.styleClassification.secondary?.name || '—'}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, report.styleClassification.secondary?.score || 0)}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">{report.styleClassification.secondary?.score ?? 0}%</span>
                  </div>
                </div>

                <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-purple-400">Индекс асимметрии СФП</span>
                  <div className="text-2xl font-bold text-white mt-1">
                    {report.styleClassification.asymmetry !== null ? `${report.styleClassification.asymmetry}%` : '—'}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {report.styleClassification.asymmetry === null
                      ? 'Нет данных по силе ударов'
                      : report.styleClassification.asymmetry <= 5.0
                        ? 'В пределах нормы (≤ 5%)'
                        : 'Требует коррекции (> 5%)'}
                  </span>
                </div>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex gap-2.5 items-start">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">{report.styleClassification.basis}</p>
              </div>

              {/* Фактические данные */}
              {report.recommendations.measuredFacts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Измеренные факты
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {report.recommendations.measuredFacts.map((fact) => (
                      <div key={fact.metricId} className="bg-slate-800/80 p-2 rounded border border-slate-700">
                        <div className="text-[10px] text-slate-400">{fact.name}</div>
                        <div className="text-sm font-bold text-white">
                          {fact.value} <span className="text-[10px] text-slate-500 font-normal">{fact.unit || ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 2. СИЛЬНЫЕ СТОРОНЫ */}
        {report.recommendations.strengths.length > 0 && (
          <div className="bg-slate-900 p-5 rounded-xl border border-emerald-500/30 mb-6 space-y-4">
            <h3 className="text-sm font-bold uppercase text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-3">
              <CheckCircle2 className="w-4 h-4" /> 2. Сильные стороны
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.recommendations.strengths.map((item, idx) => (
                <div key={`${item.metricId}_${idx}`} className="bg-slate-800/80 p-3 rounded-xl border border-emerald-500/20">
                  <div className="text-sm font-semibold text-emerald-400">{item.name}</div>
                  <div className="text-xs text-slate-300 mt-1">
                    {item.value} {item.unit || ''}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{item.basis}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. ЛИМИТИРУЮЩИЕ ФАКТОРЫ И РЕКОМЕНДАЦИИ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 mb-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="w-4 h-4" /> 3. Лимитирующие факторы и направленная коррекция
          </h3>

          {report.recommendations.preliminaryRecommendations.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-2">
              {hasData
                ? 'По доступным фактическим данным лимитирующих факторов не выявлено.'
                : 'Заполните профиль, чтобы получить рекомендации.'}
            </div>
          ) : (
            <div className="space-y-3">
              {report.recommendations.preliminaryRecommendations.map((item, idx) => (
                <div key={`${item.metricId}_${idx}`} className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{item.name}: {item.value} {item.unit || ''}</span>
                  </div>
                  <p className="text-xs text-slate-300 pl-6"><strong>Основание:</strong> {item.basis}</p>
                  <p className="text-xs text-slate-300 pl-6"><strong>Почему важно:</strong> {item.whyImportant}</p>
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700 text-xs text-emerald-400 pl-3 border-l-2 border-l-emerald-500">
                    <strong>Направление подготовки:</strong> {item.direction}
                  </div>
                  <div className="text-[11px] text-slate-500 pl-6">
                    <strong>Что повторно измерить:</strong> {item.remeasure}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex gap-2.5 items-start">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-400 leading-relaxed">{report.recommendations.disclaimer}</p>
          </div>
        </div>

        {/* 4. ЛИТЕРАТУРНЫЕ БЕНЧМАРКИ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase text-purple-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> 4. Литературные бенчмарки и научные исследования
            </h3>

            {/* Панель фильтров */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={selectedGroupFilter} 
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white focus:outline-none cursor-pointer"
              >
                <option value="Все">Все группы</option>
                <option value="Взрослые (ЭВСМ)">Взрослые (ЭВСМ)</option>
                <option value="Юниоры (17–18 лет)">Юниоры (17–18 лет)</option>
              </select>

              <select 
                value={selectedQualFilter} 
                onChange={(e) => setSelectedQualFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white focus:outline-none cursor-pointer"
              >
                <option value="Все">Любая квалификация</option>
                {getQualificationOptions().map((q) => (
                  <option key={q.value} value={q.value}>{q.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredResearch.length > 0 ? (
              filteredResearch.map((item) => {
                const metricIds = Object.keys(item.metrics || {});
                return (
                  <div key={item.id} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" /> {item.author} ({item.year})
                      </span>
                      <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-700">
                        {item.group || '—'} | {item.qualification || '—'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 italic">{item.citation}</p>

                    {metricIds.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-700/60 text-xs">
                        {metricIds.map((metricId) => {
                          const metric = item.metrics[metricId];
                          const catalog = getMetricById(metricId);
                          return (
                            <div key={metricId}>
                              <span className="text-[10px] text-slate-400 block">{catalog?.nameRu || metricId}:</span>
                              <strong className="text-emerald-400 font-mono">
                                {metric.mean} ± {metric.sd} {metric.unit}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {item.dataStatus !== 'verified_fulltext' && item.dataStatus !== 'verified_primary' && (
                      <div className="text-[10px] text-amber-500/80 pt-1">
                        Статус данных: {item.dataStatus || 'не указан'}. Результат носит исследовательский характер.
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-500 italic py-3 text-center">По выбранным фильтрам исследования не найдены.</p>
            )}
          </div>
        </div>

      </div>

      <AnalyzerResultsView athlete={athlete} physData={physData} />
    </div>
  );
}
