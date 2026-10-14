import React, { useState, useEffect } from 'react';
import { Dumbbell, Save, CheckCircle2, Activity, Zap, Wind, Brain } from 'lucide-react';

export default function PhysTestView({ athlete }) {
  const storageKey = `box_phys_${athlete.id}`;

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      // Состав тела (InBody)
      weight: 67.0,
      smm: 34.5,
      inbodyScore: 82,
      phaseAngle: 7.2,
      bodyFat: 11.5,
      ecwTbw: 0.375,

      // Анаэробная производительность
      relPower: 12.4,
      avgPower: 780,
      timeMaxSpeed: 2.1,
      timePeakPower: 3.4,
      maxRpm: 185,
      fatigueIndex: 18.2,

      // Аэробная производительность
      vo2maxAbs: 4.2,
      vo2maxRel: 62.5,
      aerobicThreshold: 42.0,
      maxVentilation: 145,
      tidalVolume: 2.8,
      respExchangeRatio: 1.12,

      // СФП
      leftPunch: 410.2,
      rightPunch: 446.7,
      tonnage10s: 1250,
      punches10s: 38,
      punches3min: 210,

      // Психомоторика
      nsType: 'Сильный (средне-сильный)',
      reactionTime: 220,
      diffError: 4.5,
    };
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { setFormData(JSON.parse(saved)); } catch (e) { /* ignore */ }
    }
  }, [athlete.id, storageKey]);

  const [savedMessage, setSavedMessage] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem(storageKey, JSON.stringify(formData));
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg space-y-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          <Dumbbell className="w-6 h-6" /> Морфофункциональный профиль
        </h2>
        <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-300">
          Стиль: <span className="font-bold text-blue-400">{athlete.style}</span> | Вес: <span className="font-bold text-blue-400">{athlete.weight}</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* 1. СОСТАВ ТЕЛА */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-3">
            <h3 className="text-xs font-bold uppercase text-blue-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Activity className="w-4 h-4" /> 1. Состав тела (Биоимпедансометрия)
            </h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400 block">Вес (кг)</label>
                <input type="number" step="0.1" value={formData.weight} onChange={(e) => handleChange('weight', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Масса скелетной мускулатуры (кг)</label>
                <input type="number" step="0.1" value={formData.smm} onChange={(e) => handleChange('smm', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Оценка InBody (усл. ед.)</label>
                <input type="number" value={formData.inbodyScore} onChange={(e) => handleChange('inbodyScore', parseInt(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Фазовый угол (градусы)</label>
                <input type="number" step="0.1" value={formData.phaseAngle} onChange={(e) => handleChange('phaseAngle', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Процент жира в теле (%)</label>
                <input type="number" step="0.1" value={formData.bodyFat} onChange={(e) => handleChange('bodyFat', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Соотношение ВКЖ/ОКЖ (усл. ед.)</label>
                <input type="number" step="0.001" value={formData.ecwTbw} onChange={(e) => handleChange('ecwTbw', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
            </div>
          </div>

          {/* 2. АНАЭРОБНАЯ ПРОИЗВОДИТЕЛЬНОСТЬ */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-3">
            <h3 className="text-xs font-bold uppercase text-amber-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Zap className="w-4 h-4" /> 2. Анаэробная производительность
            </h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400 block">Удельная мощность (Вт/кг)</label>
                <input type="number" step="0.1" value={formData.relPower} onChange={(e) => handleChange('relPower', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Средний показатель мощности (Вт)</label>
                <input type="number" value={formData.avgPower} onChange={(e) => handleChange('avgPower', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Время достижения макс. скорости (сек)</label>
                <input type="number" step="0.1" value={formData.timeMaxSpeed} onChange={(e) => handleChange('timeMaxSpeed', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Время достижения пиковой мощности (сек)</label>
                <input type="number" step="0.1" value={formData.timePeakPower} onChange={(e) => handleChange('timePeakPower', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Максимальный скоростной режим (об/мин)</label>
                <input type="number" value={formData.maxRpm} onChange={(e) => handleChange('maxRpm', parseInt(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Индекс утомления (%)</label>
                <input type="number" step="0.1" value={formData.fatigueIndex} onChange={(e) => handleChange('fatigueIndex', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
            </div>
          </div>

          {/* 3. АЭРОБНАЯ ПРОИЗВОДИТЕЛЬНОСТЬ */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-3">
            <h3 className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Wind className="w-4 h-4" /> 3. Аэробная производительность
            </h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400 block">Макс. потребление кислорода МПК (л/мин)</label>
                <input type="number" step="0.1" value={formData.vo2maxAbs} onChange={(e) => handleChange('vo2maxAbs', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Относительное МПК (мл/мин/кг)</label>
                <input type="number" step="0.1" value={formData.vo2maxRel} onChange={(e) => handleChange('vo2maxRel', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Аэробный порог (мл/мин/кг)</label>
                <input type="number" step="0.1" value={formData.aerobicThreshold} onChange={(e) => handleChange('aerobicThreshold', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Максимальная вентиляция (л/мин)</label>
                <input type="number" value={formData.maxVentilation} onChange={(e) => handleChange('maxVentilation', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Дыхательный объем (л)</label>
                <input type="number" step="0.1" value={formData.tidalVolume} onChange={(e) => handleChange('tidalVolume', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Дыхательный коэффициент (усл. ед.)</label>
                <input type="number" step="0.01" value={formData.respExchangeRatio} onChange={(e) => handleChange('respExchangeRatio', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
            </div>
          </div>

          {/* 4. СПЕЦИАЛЬНАЯ ФИЗИЧЕСКАЯ ПОДГОТОВЛЕННОСТЬ (СФП) */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-3">
            <h3 className="text-xs font-bold uppercase text-blue-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Dumbbell className="w-4 h-4" /> 4. Специальная физическая подготовленность (СФП)
            </h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400 block">Сила удара левой рукой (кг)</label>
                <input type="number" step="0.1" value={formData.leftPunch} onChange={(e) => handleChange('leftPunch', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Сила удара правой рукой (кг)</label>
                <input type="number" step="0.1" value={formData.rightPunch} onChange={(e) => handleChange('rightPunch', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Скоростно-силовая выносливость (тоннаж за 10 сек, кг)</label>
                <input type="number" value={formData.tonnage10s} onChange={(e) => handleChange('tonnage10s', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Количество ударов за 10 сек. (ударов)</label>
                <input type="number" value={formData.punches10s} onChange={(e) => handleChange('punches10s', parseInt(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block">Количество ударов за 3 мин. (ударов)</label>
                <input type="number" value={formData.punches3min} onChange={(e) => handleChange('punches3min', parseInt(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white" />
              </div>
            </div>
          </div>

          {/* 5. ПСИХОМОТОРНАЯ ДИАГНОСТИКА */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-3 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase text-purple-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Brain className="w-4 h-4" /> 5. Психомоторная диагностика
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Тип нервной системы (по теппинг-тесту)</label>
                <select 
                  value={formData.nsType} 
                  onChange={(e) => handleChange('nsType', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="Сильный (средне-сильный)">Сильный (средне-сильный)</option>
                  <option value="Слабый (средне-слабый)">Слабый (средне-слабый)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Время простой реакции (мс)</label>
                <input type="number" value={formData.reactionTime} onChange={(e) => handleChange('reactionTime', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Ошибка дифференцирования усилия (%)</label>
                <input type="number" step="0.1" value={formData.diffError} onChange={(e) => handleChange('diffError', parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
              </div>
            </div>
          </div>

        </div>

        {/* Кнопка сохранения */}
        <div className="flex flex-col items-center pt-2">
          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-8 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
          >
            <Save className="w-4 h-4" /> Сохранить морфофункциональный профиль
          </button>
          {savedMessage && (
            <p className="text-xs text-emerald-400 text-center mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Профиль успено сохранен в памяти!
            </p>
          )}
        </div>
      </form>
    </div>
  );
}