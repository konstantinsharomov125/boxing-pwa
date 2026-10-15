import React from 'react';
import { getNormsForAthlete } from '../utils/athleteNormsChecker';

export default function AthleteProfileView({ athlete }) {
  if (!athlete) return null;

  const standardInfo = getNormsForAthlete(athlete.age || 15);

  return (
    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl space-y-3 text-white">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold">{athlete.name || 'Спортсмен'}</h3>
          <p className="text-xs text-slate-400">
            Возраст: {athlete.age || 15} лет | Вес: {athlete.weightCategory || 'Не указан'}
          </p>
        </div>
        <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full">
          ФССП № 1076
        </span>
      </div>

      {/* Вывод норм */}
      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/60 space-y-2">
        <div className="text-xs space-y-1">
          <p className="text-slate-300">
            Этап: <span className="font-semibold text-blue-400">{standardInfo.name}</span>
          </p>
          <p className="text-slate-300">
            Макс. годовой объем: <span className="font-semibold text-blue-400">{standardInfo.maxHoursPerYear} ч</span>
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-400 block mb-1.5">Нормативы распределения нагрузок:</span>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700 text-slate-300">ОФП: <strong className="text-white">{standardInfo.ratios.gpp}%</strong></div>
            <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700 text-slate-300">СФП: <strong className="text-white">{standardInfo.ratios.spp}%</strong></div>
            <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700 text-slate-300">Техника: <strong className="text-white">{standardInfo.ratios.tech}%</strong></div>
            <div className="bg-slate-800 px-2 py-1 rounded border border-slate-700 text-slate-300">Тактика: <strong className="text-white">{standardInfo.ratios.tact}%</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}