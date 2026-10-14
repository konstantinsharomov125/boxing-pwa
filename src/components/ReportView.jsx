import React, { useState, useRef, useEffect } from 'react';
import { FileText, Printer, Download, MessageSquare } from 'lucide-react';
import html2pdf from 'html2pdf.js';

export default function ReportView({ athlete }) {
  const reportRef = useRef(null);
  const noteKey = `box_coach_note_${athlete.id}`;

  const [coachNote, setCoachNote] = useState(() => {
    return localStorage.getItem(noteKey) || 'Рекомендованный микроцикл: Акцентированное выравнивание силового баланса слабейшей руки + интервальная работа на мешке с заданным темпом.';
  });

  useEffect(() => {
    const saved = localStorage.getItem(`box_coach_note_${athlete.id}`);
    setCoachNote(saved || 'Рекомендованный микроцикл: Акцентированное выравнивание силового баланса слабейшей руки + интервальная работа на мешке с заданным темпом.');
  }, [athlete.id]);

  useEffect(() => {
    localStorage.setItem(noteKey, coachNote);
  }, [coachNote, noteKey]);

  const physData = (() => {
    const saved = localStorage.getItem(`box_phys_${athlete.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return { rightPunch: 446.7, leftPunch: 410.2, tonnage10s: 1250, nsType: 'Сильный (средне-сильный)', diffError: 4.5, reactionTime: 220 };
  })();

  const handleDownloadPDF = () => {
    const element = reportRef.current;
    const opt = {
      margin:       10,
      filename:     `Отчет_${athlete.name.replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handlePrint = () => {
    window.print();
  };

  const maxP = Math.max(physData.rightPunch, physData.leftPunch);
  const minP = Math.min(physData.rightPunch, physData.leftPunch);
  const asymmetry = maxP > 0 ? (((maxP - minP) / maxP) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
        <div>
          <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Научно-методический отчет
          </h2>
          <p className="text-sm text-slate-400">
            Итоговый протокол обследования с заметками тренера для печати и экспорта в PDF.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Печать
          </button>
          <button
            onClick={handleDownloadPDF}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> Скачать PDF
          </button>
        </div>
      </div>

      {/* Поле для ввода заметок тренера прямо в интерфейсе */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-blue-400" /> Персональные заметки и указания тренера / психолога:
        </label>
        <textarea 
          rows="3"
          value={coachNote}
          onChange={(e) => setCoachNote(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          placeholder="Введите рекомендации по итогам обследования..."
        ></textarea>
      </div>

      {/* ПЕЧАТНЫЙ БЛАНК */}
      <div className="bg-white text-slate-900 p-8 rounded-xl shadow-2xl space-y-6" ref={reportRef}>
        <div className="border-b-2 border-slate-900 pb-4 text-center">
          <h1 className="text-xl font-bold uppercase tracking-wider">ПРОТОКОЛ КОМПЛЕКСНОГО ОБСЛЕДОВАНИЯ БОКСЕРА</h1>
          <p className="text-xs text-slate-600 mt-1">
            Информационно-аналитическая система индивидуализации подготовки боксеров (BOX-PROFILE)
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 bg-slate-100 p-4 rounded-lg border border-slate-300 text-sm">
          <div><span className="font-semibold text-slate-600">Спортсмен:</span> <p className="font-bold text-base">{athlete.name}</p></div>
          <div><span className="font-semibold text-slate-600">Стиль поединка:</span> <p className="font-bold text-base">{athlete.style}</p></div>
          <div><span className="font-semibold text-slate-600">Весовая категория:</span> <p className="font-bold text-base">{athlete.weight}</p></div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-300 pb-1 mb-3">
            1. Показатели соревновательной деятельности
          </h3>
          <table className="w-full text-left text-xs border border-slate-300">
            <thead className="bg-slate-200 text-slate-800 uppercase font-semibold">
              <tr>
                <th className="p-2 border-b border-r border-slate-300">Критерий</th>
                <th className="p-2 border-b border-r border-slate-300">Значение</th>
                <th className="p-2 border-b border-slate-300">Модельный ориентир</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2 font-medium border-r border-slate-300">Плотность боя (уд/мин)</td>
                <td className="p-2 font-bold border-r border-slate-300">15.0</td>
                <td className="p-2 text-slate-600">13.1 — 15.3</td>
              </tr>
              <tr>
                <td className="p-2 font-medium border-r border-slate-300">Коэффициент эффективности ударов (КЭУ)</td>
                <td className="p-2 font-bold border-r border-slate-300">30.4%</td>
                <td className="p-2 text-slate-600">&gt; 35.0%</td>
              </tr>
              <tr>
                <td className="p-2 font-medium border-r border-slate-300">Коэффициент выносливости (КВ)</td>
                <td className="p-2 font-bold border-r border-slate-300">1.70</td>
                <td className="p-2 text-slate-600">1.00 — 1.15 (стабильность)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase text-slate-700 border-b border-slate-300 pb-1 mb-3">
            2. Морфофункциональный профиль и СФП
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-300 p-3 rounded">
              <span className="font-semibold block mb-2 text-slate-700">Силоматические параметры:</span>
              <ul className="space-y-1 text-slate-800">
                <li>• Сила ведущей руки: <strong>{physData.rightPunch} кг</strong></li>
                <li>• Сила слабейшей руки: <strong>{physData.leftPunch} кг</strong></li>
                <li>• Силовая асимметрия: <strong>{asymmetry}%</strong></li>
                <li>• Тоннаж СФП (10 сек): <strong>{physData.tonnage10s} кг</strong></li>
              </ul>
            </div>
            <div className="border border-slate-300 p-3 rounded">
              <span className="font-semibold block mb-2 text-slate-700">Психофизиологический профиль:</span>
              <ul className="space-y-1 text-slate-800">
                <li>• Тип нервной системы: <strong>{physData.nsType}</strong></li>
                <li>• Латентное время реакции: <strong>{physData.reactionTime} мс</strong></li>
                <li>• Ошибка дифференцирования: <strong>{physData.diffError}%</strong></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-slate-300 pt-3">
          <h3 className="text-sm font-bold uppercase text-slate-700 mb-2">
            3. Заключение экспертной матрицы и указания тренера
          </h3>
          <div className="bg-slate-50 border border-slate-300 p-3 rounded text-xs space-y-2 text-slate-800">
            <p className="whitespace-pre-wrap"><strong>Протокол коррекции:</strong> {coachNote}</p>
            <p className="text-slate-500 italic text-[11px] pt-2">Дата формирования отчета: {new Date().toLocaleDateString('ru-RU')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}