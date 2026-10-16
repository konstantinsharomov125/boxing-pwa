import React, { useMemo } from 'react';
import { Microscope, ShieldCheck, AlertTriangle, Info, Ban, FileWarning } from 'lucide-react';
import { getMetricById } from '../data/modelsConfig';
import { analyzeAthleteProfile } from '../utils/fullAnalyzer';

/**
 * Отображение результатов научного анализатора (fullAnalyzer).
 * Разделяет нормативные сравнения (допущенные модели) и исследовательские
 * результаты (недопущенные модели) — последние не выглядят нормативами.
 */
export default function AnalyzerResultsView({ athlete, physData }) {
  const report = useMemo(
    () => analyzeAthleteProfile(athlete, physData),
    [athlete, physData],
  );

  // Показываем только показатели, по которым есть данные (валидные или ошибочные)
  const entries = Object.values(report.comparisons).filter(
    (c) => c.status !== 'missing_data',
  );

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg space-y-5">
      <div className="border-b border-slate-700 pb-4">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          <Microscope className="w-6 h-6" /> Научный анализ референтных сравнений
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Проверка качества данных и сопоставимость с референтными моделями (modelsConfig / fullAnalyzer).
        </p>
      </div>

      {/* Сводка качества данных */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
          <div className="text-xl font-bold text-white">{report.summary.metricsOk}</div>
          <div className="text-[10px] text-slate-400 uppercase">Валидных значений</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
          <div className="text-xl font-bold text-slate-400">{report.summary.metricsMissing}</div>
          <div className="text-[10px] text-slate-400 uppercase">Отсутствует</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
          <div className="text-xl font-bold text-red-400">{report.summary.metricsInvalid}</div>
          <div className="text-[10px] text-slate-400 uppercase">Ошибок ввода</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
          <div className="text-xl font-bold text-emerald-400">{report.summary.metricsCompared}</div>
          <div className="text-[10px] text-slate-400 uppercase">Нормативных сравнений</div>
        </div>
      </div>

      {/* Ограничения когорты */}
      {report.cohortLimitations.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 space-y-1.5">
          <h3 className="text-xs font-bold uppercase text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Ограничения сопоставимости когорты
          </h3>
          {report.cohortLimitations.map((lim, i) => (
            <p key={i} className="text-xs text-slate-300 pl-5">• {lim}</p>
          ))}
        </div>
      )}

      {/* Результаты по показателям */}
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-4">
          Нет данных для анализа. Заполните морфофункциональный профиль спортсмена.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((cmp) => {
            const metric = getMetricById(cmp.metricId);
            if (!metric) return null;
            return (
              <div key={cmp.metricId} className="bg-slate-900/80 rounded-xl border border-slate-700 p-4 space-y-2">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-200">{metric.nameRu}</span>
                  <StatusBadge cmp={cmp} />
                </div>

                {cmp.status === 'invalid_data' && (
                  <div className="text-xs text-red-300 space-y-0.5">
                    {cmp.issues.map((issue, i) => <p key={i}>• {issue}</p>)}
                  </div>
                )}

                {(cmp.comparisons || []).map((c) => (
                  <ModelComparison key={c.modelId} item={c} metricUnit={metric.unit} />
                ))}

                {cmp.limitations && (
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-800">
                    {cmp.limitations.map((l, i) => <p key={i}>• {l}</p>)}
                  </div>
                )}
                {cmp.uncertainty && (
                  <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-800">
                    {cmp.uncertainty.map((u, i) => <p key={i}>• {u}</p>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Глобальный дисклеймер */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3.5 flex gap-2.5 items-start">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">{report.globalDisclaimer}</p>
      </div>
    </div>
  );
}

function StatusBadge({ cmp }) {
  if (cmp.status === 'ok') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded border bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-semibold flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> Нормативное сравнение
      </span>
    );
  }
  if (cmp.status === 'invalid_data') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded border bg-red-500/10 border-red-500/40 text-red-400 font-semibold flex items-center gap-1">
        <Ban className="w-3 h-3" /> Ошибка данных
      </span>
    );
  }
  if (cmp.status === 'not_quantitative') {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded border bg-slate-700/40 border-slate-600 text-slate-400">
        Качественный показатель
      </span>
    );
  }
  const hasResearch = cmp.comparisons?.some((c) => c.status === 'research_result');
  if (hasResearch) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded border bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold flex items-center gap-1">
        <FileWarning className="w-3 h-3" /> Только исследовательские данные
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded border bg-slate-700/40 border-slate-600 text-slate-400">
      {cmp.message || 'Недостаточно данных'}
    </span>
  );
}

function ModelComparison({ item, metricUnit }) {
  const isResearch = item.status === 'research_result';
  return (
    <div className={`rounded-lg border p-3 text-xs space-y-1.5 ${
      item.status === 'ok'
        ? 'bg-emerald-500/5 border-emerald-500/30'
        : isResearch
          ? 'bg-amber-500/5 border-amber-500/20'
          : 'bg-slate-800/60 border-slate-700'
    }`}>
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <span className="font-semibold text-blue-300">{item.modelId}</span>
        <span className="text-[10px] text-slate-400">
          {item.dataStatusLabel} | {item.compatibility.levelLabel}
        </span>
      </div>

      {item.status === 'ok' && (
        <div className="flex items-center gap-4">
          <span className="text-slate-300">
            Модель: <strong className="font-mono">{item.reference.mean} ± {item.reference.sd} {item.reference.unit}</strong>
          </span>
          <span className="text-slate-300">
            z = <strong className="font-mono text-emerald-400">{item.zScore}</strong>
          </span>
          <span className="text-slate-400">{item.interpretation.label}</span>
        </div>
      )}

      {isResearch && item.reference && (
        <p className="text-slate-400">
          Справочно (не норматив): среднее {item.reference.mean}
          {item.reference.sd != null ? ` ± ${item.reference.sd}` : ''} {item.reference.unit || metricUnit}
        </p>
      )}

      <p className="text-slate-500 italic">{item.message}</p>

      {item.status === 'ok' && item.interpretation.normativeNote && (
        <p className="text-[10px] text-slate-500">{item.interpretation.normativeNote}</p>
      )}

      {item.limitations?.length > 0 && (
        <div className="text-[10px] text-slate-500 space-y-0.5">
          {item.limitations.map((l, i) => <p key={i}>• {l}</p>)}
        </div>
      )}
      {item.compatibility.issues?.length > 0 && (
        <div className="text-[10px] text-amber-500/80 space-y-0.5">
          {item.compatibility.issues.map((l, i) => <p key={i}>• {l}</p>)}
        </div>
      )}
    </div>
  );
}
