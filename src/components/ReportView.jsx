import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileJson, FileText, MessageSquare, Printer, AlertTriangle, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import {
  buildIntegratedReportPayload,
  makeReportFilename,
  serializeIntegratedReport,
} from '../utils/reportExport.js';

const competitionLabels = {
  density: 'Плотность',
  keu: 'КЭУ',
  kv: 'КВ',
  jabsAcc: 'Точность джебов',
  powerAcc: 'Точность силовых',
};

export default function ReportView({ athlete }) {
  const reportRef = useRef(null);
  const noteKey = `box_coach_note_${athlete.id}`;
  const [coachNote, setCoachNote] = useState(() => localStorage.getItem(noteKey) || '');
  const payload = useMemo(
    () => buildIntegratedReportPayload(athlete, { coachNote }),
    [athlete, coachNote],
  );

  useEffect(() => {
    setCoachNote(localStorage.getItem(noteKey) || '');
  }, [noteKey]);

  useEffect(() => {
    localStorage.setItem(noteKey, coachNote);
  }, [coachNote, noteKey]);

  const downloadJson = () => {
    try {
      const blob = new Blob([serializeIntegratedReport(payload)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = makeReportFilename(athlete);
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка экспорта JSON:', error);
      alert('Не удалось сформировать JSON файл.');
    }
  };

  // Безопасный вызов печати и сохранения в PDF через системный диалог браузера
  const handlePrintOrPdf = () => {
    try {
      setTimeout(() => {
        window.print();
      }, 100);
    } catch (error) {
      console.error('Ошибка печати:', error);
      alert('Не удалось запустить печать отчета.');
    }
  };

  const measured = payload.recommendations?.measuredFacts || [];
  const missing = Object.entries(payload.validation).filter(([, v]) => v.status === 'missing');
  const strengths = payload.recommendations?.strengths || [];
  const limitations = payload.recommendations?.preliminaryRecommendations || [];

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col md:flex-row justify-between gap-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2"><FileText className="w-5 h-5" /> Полный аналитический отчёт</h2>
          <p className="text-xs text-slate-400">Исходные данные, анализ, приоритеты подготовки, динамика и ограничения интерпретации.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handlePrintOrPdf} className="button-secondary flex items-center gap-1.5"><Printer className="w-4 h-4" /> Печать</button>
          <button onClick={downloadJson} className="button-secondary flex items-center gap-1.5"><FileJson className="w-4 h-4" /> JSON</button>
          <button onClick={handlePrintOrPdf} className="button-primary flex items-center gap-1.5"><Download className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div ref={reportRef} className="print-report bg-white text-slate-900 rounded-xl p-6 space-y-6 shadow-sm">
        <header className="border-b border-slate-300 pb-4">
          <h1 className="text-2xl font-bold">BOX-PROFILE — интегральный профиль</h1>
          <p className="text-sm text-slate-600">{payload.athlete.name || 'Спортсмен'} · возраст: {payload.athlete.age ?? '—'}</p>
          <p className="text-xs text-slate-500">Формат: {payload.schema}, версия {payload.version}</p>
        </header>

        <section>
          <h2 className="report-heading text-base font-semibold text-slate-800 mb-3">1. Исходные данные и пропуски</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {measured.map((fact) => (
              <MetricCard key={fact.metricId} label={fact.name} value={fact.value} unit={fact.unit} />
            ))}
          </div>
          {missing.length > 0 && (
            <div className="mt-3 bg-slate-100 rounded p-3 text-xs">
              <span className="font-semibold text-slate-700">Отсутствуют измерения:</span>{' '}
              {missing.map(([id]) => id).join(', ')}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">Валидных показателей: {payload.summary.metricsOk} из {payload.summary.metricsRequested}.</p>
        </section>

        <section>
          <h2 className="report-heading text-base font-semibold text-slate-800 mb-3">2. Соревновательные метрики</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(competitionLabels).map(([id, label]) => (
              <MetricCard key={id} label={label} value={payload.competition.metrics[id]?.displayValue} unit={payload.competition.metrics[id]?.unit} />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Боев обработано: {payload.competition.source.validRecords}; отклонено: {payload.competition.source.rejectedRecords}.</p>
        </section>

        <section>
          <h2 className="report-heading text-base font-semibold text-slate-800 mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 3. Сильные стороны</h2>
          {strengths.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {strengths.map((item, idx) => (
                <div key={`${item.metricId}_${idx}`} className="border border-emerald-200 bg-emerald-50 rounded p-3">
                  <div className="text-sm font-semibold text-emerald-700">{item.name}</div>
                  <div className="text-xs text-slate-700">{item.value} {item.unit || ''}</div>
                  <p className="text-[11px] text-slate-500 mt-1">{item.basis}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">По доступным данным сильные стороны не выявлены.</p>
          )}
        </section>

        <section>
          <h2 className="report-heading text-base font-semibold text-slate-800 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> 4. Лимитирующие факторы и приоритеты подготовки</h2>
          {limitations.length > 0 ? (
            <div className="space-y-3">
              {limitations.map((item, idx) => (
                <div key={`${item.metricId}_${idx}`} className="border border-amber-200 bg-amber-50 rounded p-3 space-y-1">
                  <div className="text-sm font-semibold text-amber-800">{item.name}: {item.value} {item.unit || ''}</div>
                  <p className="text-xs text-slate-700"><strong>Основание:</strong> {item.basis}</p>
                  <p className="text-xs text-slate-700"><strong>Почему важно:</strong> {item.whyImportant}</p>
                  <p className="text-xs text-slate-700"><strong>Направление подготовки:</strong> {item.direction}</p>
                  <p className="text-[11px] text-slate-500"><strong>Что повторно измерить:</strong> {item.remeasure}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">По доступным данным лимитирующих факторов не выявлено.</p>
          )}
        </section>

        <section>
          <h2 className="report-heading text-base font-semibold text-slate-800 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> 5. Динамика изменений</h2>
          <p className="text-xs text-slate-500 mb-2">Периодов: {payload.longitudinal.periods.length}; физических тестов: {payload.longitudinal.source.physicalRecords}; боёв: {payload.longitudinal.source.competitionPeriods}.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-100"><tr><th className="p-2 text-left">Показатель</th><th className="p-2 text-left">Единица</th><th className="p-2 text-left">Первое значение</th><th className="p-2 text-left">Последнее значение</th><th className="p-2 text-left">Изменение</th></tr></thead>
              <tbody>
                {Object.entries(payload.longitudinal.delta)
                  .filter(([, delta]) => delta !== null && Number.isFinite(delta))
                  .map(([metricId, delta]) => {
                    const values = payload.longitudinal.periods
                      .map((p) => p.competition[metricId] ?? p.physical[metricId])
                      .filter((v) => Number.isFinite(v));
                    const first = values[0];
                    const last = values[values.length - 1];
                    return (
                      <tr key={metricId} className="border-t border-slate-200">
                        <td className="p-2 font-medium">{metricId}</td>
                        <td className="p-2 text-slate-500">{payload.competition.metrics[metricId]?.unit || ''}</td>
                        <td className="p-2">{first}</td>
                        <td className="p-2">{last}</td>
                        <td className={`p-2 ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-600'}`}>{delta > 0 ? '+' : ''}{delta.toFixed(2)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {payload.longitudinal.periods.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs border border-slate-300">
                <thead className="bg-slate-100"><tr><th className="p-2 text-left">Дата</th><th className="p-2 text-left">Источник</th><th className="p-2 text-left">Соревновательные</th><th className="p-2 text-left">Физические</th></tr></thead>
                <tbody>{payload.longitudinal.periods.map((period) => (
                  <tr key={period.id} className="border-t border-slate-200">
                    <td className="p-2">{period.date || '—'}</td>
                    <td className="p-2">{period.source === 'competition' ? 'Бой' : 'Тест'}</td>
                    <td className="p-2">{period.available.competition.length}/5</td>
                    <td className="p-2">{period.available.physical.length}/{payload.longitudinal.metricGroups.physical.length}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="report-heading text-base font-semibold text-slate-800 mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-slate-600" /> 6. Ограничения интерпретации</h2>
          <div className="bg-slate-100 rounded p-3 text-xs text-slate-700 space-y-1">
            <p>{payload.globalDisclaimer}</p>
            {payload.recommendations?.disclaimer && <p>{payload.recommendations.disclaimer}</p>}
            {payload.cohortLimitations?.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5">
                {payload.cohortLimitations.map((lim, i) => <li key={i}>{lim}</li>)}
              </ul>
            )}
          </div>
        </section>

        <section className="no-print">
          <label className="text-xs font-semibold flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Заметка тренера</label>
          <textarea value={coachNote} onChange={(event) => setCoachNote(event.target.value)} rows="3" className="w-full mt-2 border border-slate-300 rounded p-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Введите заметку для тренера..." />
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit }) {
  return (
    <div className="border border-slate-200 bg-slate-50/50 rounded p-3 shadow-2xs">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="font-bold text-slate-800 mt-0.5">{value ?? '—'} <span className="font-normal text-xs text-slate-500">{unit || ''}</span></div>
    </div>
  );
}