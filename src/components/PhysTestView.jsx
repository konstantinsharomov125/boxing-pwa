import React, { useState, useEffect } from 'react';
import { Dumbbell, Save, CheckCircle2, Activity, Zap, Wind, Brain } from 'lucide-react';

const NUMBER_FIELDS = [
  'weight', 'smm', 'inbodyScore', 'phaseAngle', 'bodyFat', 'ecwTbw',
  'relPower', 'avgPower', 'timeMaxSpeed', 'timePeakPower', 'maxRpm', 'fatigueIndex',
  'vo2maxAbs', 'vo2maxRel', 'aerobicThreshold', 'maxVentilation', 'tidalVolume', 'respExchangeRatio',
  'leftPunch', 'rightPunch', 'tonnage10s', 'punches10s', 'punches3min',
  'reactionTime', 'diffError',
];

const EMPTY_FORM = Object.fromEntries(
  NUMBER_FIELDS.map((field) => [field, ''])
    .concat([['nsType', '']]),
);

function normalizeForStorage(formData) {
  const result = {};
  for (const key of Object.keys(EMPTY_FORM)) {
    const value = formData[key];
    if (value === '' || value === null || value === undefined) {
      result[key] = null;
    } else if (NUMBER_FIELDS.includes(key)) {
      const num = Number(value);
      result[key] = Number.isFinite(num) ? num : null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export default function PhysTestView({ athlete }) {
  const storageKey = `box_phys_${athlete.id}`;

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...EMPTY_FORM, ...parsed };
      } catch { /* ignore */ }
    }
    return { ...EMPTY_FORM };
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData({ ...EMPTY_FORM, ...parsed });
      } catch { /* ignore */ }
    } else {
      setFormData({ ...EMPTY_FORM });
    }
  }, [athlete.id, storageKey]);

  const [savedMessage, setSavedMessage] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    const toSave = normalizeForStorage(formData);
    localStorage.setItem(storageKey, JSON.stringify(toSave));
    const historyKey = `box_phys_history_${athlete.id}`;
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(historyKey) || '[]');
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
    localStorage.setItem(historyKey, JSON.stringify([
      ...history,
      { id: Date.now(), date: new Date().toLocaleDateString('ru-RU'), data: toSave },
    ]));
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
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
              <NumberInput label="Вес (кг)" value={formData.weight} onChange={(v) => handleChange('weight', v)} />
              <NumberInput label="Масса скелетной мускулатуры (кг)" value={formData.smm} onChange={(v) => handleChange('smm', v)} />
              <NumberInput label="Оценка InBody (усл. ед.)" value={formData.inbodyScore} onChange={(v) => handleChange('inbodyScore', v)} />
              <NumberInput label="Фазовый угол (градусы)" value={formData.phaseAngle} onChange={(v) => handleChange('phaseAngle', v)} step="0.1" />
              <NumberInput label="Процент жира в теле (%)" value={formData.bodyFat} onChange={(v) => handleChange('bodyFat', v)} step="0.1" />
              <NumberInput label="Соотношение ВКЖ/ОКЖ (усл. ед.)" value={formData.ecwTbw} onChange={(v) => handleChange('ecwTbw', v)} step="0.001" />
            </div>
          </div>

          {/* 2. АНАЭРОБНАЯ ПРОИЗВОДИТЕЛЬНОСТЬ */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-3">
            <h3 className="text-xs font-bold uppercase text-amber-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Zap className="w-4 h-4" /> 2. Анаэробная производительность
            </h3>
            <div className="space-y-2">
              <NumberInput label="Удельная мощность (Вт/кг)" value={formData.relPower} onChange={(v) => handleChange('relPower', v)} step="0.1" />
              <NumberInput label="Средний показатель мощности (Вт)" value={formData.avgPower} onChange={(v) => handleChange('avgPower', v)} />
              <NumberInput label="Время достижения макс. скорости (сек)" value={formData.timeMaxSpeed} onChange={(v) => handleChange('timeMaxSpeed', v)} step="0.1" />
              <NumberInput label="Время достижения пиковой мощности (сек)" value={formData.timePeakPower} onChange={(v) => handleChange('timePeakPower', v)} step="0.1" />
              <NumberInput label="Максимальный скоростной режим (об/мин)" value={formData.maxRpm} onChange={(v) => handleChange('maxRpm', v)} />
              <NumberInput label="Индекс утомления (%)" value={formData.fatigueIndex} onChange={(v) => handleChange('fatigueIndex', v)} step="0.1" />
            </div>
          </div>

          {/* 3. АЭРОБНАЯ ПРОИЗВОДИТЕЛЬНОСТЬ */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-3">
            <h3 className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Wind className="w-4 h-4" /> 3. Аэробная производительность
            </h3>
            <div className="space-y-2">
              <NumberInput label="Макс. потребление кислорода МПК (л/мин)" value={formData.vo2maxAbs} onChange={(v) => handleChange('vo2maxAbs', v)} step="0.1" />
              <NumberInput label="Относительное МПК (мл/мин/кг)" value={formData.vo2maxRel} onChange={(v) => handleChange('vo2maxRel', v)} step="0.1" />
              <NumberInput label="Аэробный порог (мл/мин/кг)" value={formData.aerobicThreshold} onChange={(v) => handleChange('aerobicThreshold', v)} step="0.1" />
              <NumberInput label="Максимальная вентиляция (л/мин)" value={formData.maxVentilation} onChange={(v) => handleChange('maxVentilation', v)} />
              <NumberInput label="Дыхательный объём (л)" value={formData.tidalVolume} onChange={(v) => handleChange('tidalVolume', v)} step="0.1" />
              <NumberInput label="Дыхательный коэффициент (усл. ед.)" value={formData.respExchangeRatio} onChange={(v) => handleChange('respExchangeRatio', v)} step="0.01" />
            </div>
          </div>

          {/* 4. СПЕЦИАЛЬНАЯ ФИЗИЧЕСКАЯ ПОДГОТОВЛЕННОСТЬ (СФП) */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 space-y-3">
            <h3 className="text-xs font-bold uppercase text-blue-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Dumbbell className="w-4 h-4" /> 4. Специальная физическая подготовленность (СФП)
            </h3>
            <div className="space-y-2">
              <NumberInput label="Сила удара левой рукой (кг)" value={formData.leftPunch} onChange={(v) => handleChange('leftPunch', v)} step="0.1" />
              <NumberInput label="Сила удара правой рукой (кг)" value={formData.rightPunch} onChange={(v) => handleChange('rightPunch', v)} step="0.1" />
              <NumberInput label="Скоростно-силовая выносливость (тоннаж за 10 сек, кг)" value={formData.tonnage10s} onChange={(v) => handleChange('tonnage10s', v)} />
              <NumberInput label="Количество ударов за 10 сек. (ударов)" value={formData.punches10s} onChange={(v) => handleChange('punches10s', v)} />
              <NumberInput label="Количество ударов за 3 мин. (ударов)" value={formData.punches3min} onChange={(v) => handleChange('punches3min', v)} />
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
                  <option value="">Не указан</option>
                  <option value="Сильный (средне-сильный)">Сильный (средне-сильный)</option>
                  <option value="Слабый (средне-слабый)">Слабый (средне-слабый)</option>
                </select>
              </div>

              <NumberInput label="Время простой реакции (мс)" value={formData.reactionTime} onChange={(v) => handleChange('reactionTime', v)} />

              <NumberInput label="Ошибка дифференцирования усилия (%)" value={formData.diffError} onChange={(v) => handleChange('diffError', v)} step="0.1" />
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

function NumberInput({ label, value, onChange, step = 'any' }) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 block">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
      />
    </div>
  );
}
