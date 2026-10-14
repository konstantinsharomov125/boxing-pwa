import React, { useState, useEffect } from 'react';
import { Dumbbell, Save, CheckCircle2 } from 'lucide-react';

export default function PhysTestView({ athlete }) {
  // Ключ для хранения тестов конкретного спортсмена в localStorage
  const storageKey = `box_phys_${athlete.id}`;

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      rightPunch: 446.7,
      leftPunch: 410.2,
      tonnage10s: 1250,
      nsType: 'Сильный (средне-сильный)',
      diffError: 4.5,
      reactionTime: 220, // мс
    };
  });

  // При смене спортсмена загружаем его сохраненные данные
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { setFormData(JSON.parse(saved)); } catch (e) { /* ignore */ }
    } else {
      setFormData({
        rightPunch: 446.7,
        leftPunch: 410.2,
        tonnage10s: 1250,
        nsType: 'Сильный (средне-сильный)',
        diffError: 4.5,
        reactionTime: 220,
      });
    }
  }, [athlete.id, storageKey]);

  const [savedMessage, setSavedMessage] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem(storageKey, JSON.stringify(formData));
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  // Расчет асимметрии удара (%)
  const maxPunch = Math.max(formData.rightPunch, formData.leftPunch);
  const minPunch = Math.min(formData.rightPunch, formData.leftPunch);
  const asymmetry = maxPunch > 0 ? (((maxPunch - minPunch) / maxPunch) * 100).toFixed(1) : 0;

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
            <Dumbbell className="w-5 h-5" /> Морфофункциональный статус и тесты: {athlete.name}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Специальная физическая подготовленность (СФП) и психомоторный профиль.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-300">
          Стиль: <span className="font-bold text-blue-400">{athlete.style}</span> | Вес: <span className="font-bold text-blue-400">{athlete.weight}</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Левая колонка: Динамометрия и СФП */}
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-700/80 space-y-4">
          <h3 className="text-sm font-semibold text-blue-400 border-b border-slate-700 pb-2">
            1. Силовые показатели и СФП
          </h3>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Сила удара сильнейшей рукой (кг)</label>
            <input 
              type="number" 
              value={formData.rightPunch} 
              onChange={(e) => setFormData({...formData, rightPunch: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" 
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Сила удара слабейшей рукой (кг)</label>
            <input 
              type="number" 
              value={formData.leftPunch} 
              onChange={(e) => setFormData({...formData, leftPunch: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" 
            />
          </div>

          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 flex justify-between items-center">
            <span className="text-xs text-slate-400">Коэффициент силоматической асимметрии:</span>
            <span className={`text-sm font-bold ${asymmetry > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {asymmetry}% {asymmetry > 15 ? '(Высокая)' : '(Норма)'}
            </span>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Скоростно-силовая выносливость (тоннаж за 10 сек, кг)</label>
            <input 
              type="number" 
              value={formData.tonnage10s} 
              onChange={(e) => setFormData({...formData, tonnage10s: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" 
            />
          </div>
        </div>

        {/* Правая колонка: Психомоторика */}
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-700/80 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-blue-400 border-b border-slate-700 pb-2">
              2. Психомоторная диагностика
            </h3>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Тип нервной системы (по теппинг-тесту)</label>
              <select 
                value={formData.nsType} 
                onChange={(e) => setFormData({...formData, nsType: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="Сильный (средне-сильный)">Сильный (средне-сильный)</option>
                <option value="Слабый (средне-слабый)">Слабый (средне-слабый)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Время простой зрительно-моторной реакции (мс)</label>
              <input 
                type="number" 
                value={formData.reactionTime} 
                onChange={(e) => setFormData({...formData, reactionTime: parseFloat(e.target.value) || 0})}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" 
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Ошибка дифференцирования мышечного усилия (%)</label>
              <input 
                type="number" 
                step="0.1" 
                value={formData.diffError} 
                onChange={(e) => setFormData({...formData, diffError: parseFloat(e.target.value) || 0})}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" 
              />
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
            >
              <Save className="w-4 h-4" /> Сохранить профиль СФП
            </button>
            {savedMessage && (
              <p className="text-xs text-emerald-400 text-center mt-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Данные успешно обновлены!
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}