import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileJson, FileText, MessageSquare, Printer } from 'lucide-react';
import html2pdf from 'html2pdf.js';
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
    const blob = new Blob([serializeIntegratedReport(payload)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = makeReportFilename(athlete);
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    html2pdf().set({
      margin: 10,
      filename: makeReportFilename(athlete, 'pdf'),
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(reportRef.current).save();
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-col md:flex-row justify-between gap-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div>
          <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2"><FileText className="w-5 h-5" /> Полный аналитический отчёт</h2>
          <p className="text-xs text-slate-400">Соревновательные метрики, физико-технические нормативы и longitudinal-динамика.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="button-secondary"><Printer className="w-4 h-4" /> Печать</button>
          <button onClick={downloadJson} className="button-secondary"><FileJson className="w-4 h-4" /> JSON</button>
          <button onClick={downloadPdf} className="button-primary"><Download className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div ref={reportRef} className="print-report bg-white text-slate-900 rounded-xl p-6 space-y-6">
        <header className="border-b border-slate-300 pb-4">
          <h1 className="text-2xl font-bold">BOX-PROFILE — интегральный профиль</h1>
          <p className="text-sm text-slate-600">{payload.athlete.name || 'Спортсмен'} · возраст: {payload.athlete.age ?? '—'}</p>
          <p className="text-xs text-slate-500">Формат: {payload.schema}, версия {payload.version}</p>
        </header>

        <section>
          <h2 className="report-heading">1. Соревновательные метрики</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(competitionLabels).map(([id, label]) => (
              <MetricCard key={id} label={label} value={payload.competition.metrics[id]?.displayValue} unit={payload.competition.metrics[id]?.unit} />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Боев обработано: {payload.competition.source.validRecords}; отклонено: {payload.competition.source.rejectedRecords}.</p>
        </section>

        <section>
          <h2 className="report-heading">2. Физико-технические нормативы</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(payload.validation).filter(([, value]) => value.status === 'valid').map(([id, value]) => (
              <MetricCard key={id} label={id} value={value.value} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="report-heading">3. Longitudinal / интервальная динамика</h2>
          <p className="text-xs text-slate-500 mb-2">Периодов: {payload.longitudinal.periods.length}; физических тестов: {payload.longitudinal.source.physicalRecords}.</p>
          <div className="overflow-x-auto">
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
        </section>

        <section className="no-print">
          <label className="text-xs font-semibold flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Заметка тренера</label>
          <textarea value={coachNote} onChange={(event) => setCoachNote(event.target.value)} rows="3" className="w-full mt-2 border border-slate-300 rounded p-2 text-sm" />
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit }) {
  return <div className="border border-slate-300 rounded p-3"><div className="text-[11px] text-slate-500">{label}</div><div className="font-bold">{value ?? '—'} <span className="font-normal text-xs">{unit || ''}</span></div></div>;
}
