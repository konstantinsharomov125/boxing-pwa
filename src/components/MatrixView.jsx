import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, AlertTriangle, BookOpen, Layers, Target, ShieldAlert, Filter } from 'lucide-react';
import { getAllResearch } from '../data/researchDatabase';
import AnalyzerResultsView from './AnalyzerResultsView';

export default function MatrixView({ athlete }) {
  const physStorageKey = `box_phys_${athlete.id}`;
  
  const [physData, setPhysData] = useState(() => {
    const saved = localStorage.getItem(physStorageKey);
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const saved = localStorage.getItem(physStorageKey);
    setPhysData(saved ? JSON.parse(saved) : null);
  }, [athlete.id, physStorageKey]);

  // Фильтры литературной базы
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('Все');
  const [selectedQualFilter, setSelectedQualFilter] = useState('Все');

  const currentPhys = physData || {
    weight: 67.0, smm: 34.5, inbodyScore: 82, phaseAngle: 7.2, bodyFat: 11.5, ecwTbw: 0.375,
    relPower: 12.4, avgPower: 780, timeMaxSpeed: 2.1, timePeakPower: 3.4, maxRpm: 185, fatigueIndex: 18.2,
    vo2maxAbs: 4.2, vo2maxRel: 62.5, aerobicThreshold: 42.0, maxVentilation: 145, tidalVolume: 2.8, respExchangeRatio: 1.12,
    leftPunch: 410.2, rightPunch: 446.7, tonnage10s: 1250, punches10s: 38, punches3min: 210,
    nsType: 'Сильный (средне-сильный)', reactionTime: 220, diffError: 4.5
  };

  // Расчет стиля
  let tempScore = 0;
  if (currentPhys.vo2maxRel >= 60) tempScore += 30;
  if (currentPhys.relPower >= 12.0) tempScore += 30;
  if (currentPhys.punches3min >= 200) tempScore += 25;
  if (currentPhys.nsType.includes('Сильный')) tempScore += 15;

  let powerScore = 0;
  const maxPunch = Math.max(currentPhys.leftPunch, currentPhys.rightPunch);
  if (maxPunch >= 430) powerScore += 35;
  if (currentPhys.tonnage10s >= 1200) powerScore += 30;
  if (currentPhys.smm >= 34.0) powerScore += 20;
  if (currentPhys.timePeakPower <= 3.5) powerScore += 15;

  let gamerScore = 0;
  if (currentPhys.reactionTime <= 210) gamerScore += 35;
  if (currentPhys.diffError <= 4.0) gamerScore += 35;
  if (currentPhys.phaseAngle >= 7.0) gamerScore += 15;
  if (currentPhys.fatigueIndex <= 15.0) gamerScore += 15;

  const stylesList = [
    { name: 'Темповик (High-Density Swarmer)', score: tempScore },
    { name: 'Силовой панчер / Нокаутер (Power Puncher)', score: powerScore },
    { name: 'Игровик / Контратакующий (Out-Fighter)', score: gamerScore },
  ].sort((a, b) => b.score - a.score);

  const primaryStyle = stylesList[0];
  const secondaryStyle = stylesList[1];

  const asymmetry = currentPhys.rightPunch > 0 
    ? (Math.abs(currentPhys.rightPunch - currentPhys.leftPunch) / Math.max(currentPhys.rightPunch, currentPhys.leftPunch) * 100).toFixed(1)
    : '0.0';

  const limiters = [];
  if (parseFloat(asymmetry) > 10.0) {
    limiters.push({
      title: `Высокая силовая асимметрия рук (${asymmetry}% при норме < 5%)`,
      impact: 'Повышает риск травматизации и снижает эффективность серийных атак.',
      recommendation: 'Аксиальная корректирующая тренировка слабейшей руки, работа с резиной с переменным сопротивлением (Филимонов В.И., 2000).'
    });
  }
  if (currentPhys.vo2maxRel < 58.0) {
    limiters.push({
      title: `Недостаточный аэробный потенциал МПК (${currentPhys.vo2maxRel} мл/мин/кг при норме > 60 мл/мин/кг)`,
      impact: 'Лимитирует скорость восстановления между раундами.',
      recommendation: 'Интервальная аэробно-анаэробная работа на тредмиле в зоне АЭП/ПАНО (Таймазов В.А., 1997).'
    });
  }
  if (limiters.length === 0) {
    limiters.push({
      title: 'Все ключевые системы находятся в пределах нормативного коридора',
      impact: 'Высокий уровень адаптационного потенциала.',
      recommendation: 'Поддержание текущего профиля и акцент на технико-тактическое мастерство.'
    });
  }

  // Фильтрация базы литературы (встроенные + пользовательские записи)
  const filteredResearch = getAllResearch().filter(item => {
    const matchGroup = selectedGroupFilter === 'Все' || item.group === selectedGroupFilter;
    const matchQual = selectedQualFilter === 'Все' || (item.qualification || '').includes(selectedQualFilter);
    return matchGroup && matchQual;
  });

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
              Интеллектуальный анализ цифрового профиля на основе расширенной базы литературных источников.
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Динамическая база активна
          </div>
        </div>

        {/* 1. БЛОК СТИЛЯ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-blue-500/30 mb-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-blue-400 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Target className="w-4 h-4" /> 1. Результат определения предпочтительного стиля ведения боя
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/90 p-4 rounded-xl border border-blue-500/40">
              <span className="text-[10px] uppercase font-bold text-blue-400">Ведущий стиль</span>
              <div className="text-lg font-bold text-white mt-1">{primaryStyle.name}</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, primaryStyle.score)}%` }}></div>
                </div>
                <span className="text-xs font-bold text-blue-400">{primaryStyle.score}%</span>
              </div>
            </div>

            <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400">Вторичный стиль</span>
              <div className="text-lg font-bold text-slate-200 mt-1">{secondaryStyle.name}</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, secondaryStyle.score)}%` }}></div>
                </div>
                <span className="text-xs font-bold text-emerald-400">{secondaryStyle.score}%</span>
              </div>
            </div>

            <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-purple-400">Индекс асимметрии СФП</span>
              <div className="text-2xl font-bold text-white mt-1">{asymmetry}%</div>
              <span className="text-[11px] text-slate-400">{parseFloat(asymmetry) <= 5.0 ? '✓ Норма' : '⚠ Требует коррекции'}</span>
            </div>
          </div>
        </div>

        {/* 2. ЛИМИТИРУЮЩИЕ ФАКТОРЫ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 mb-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="w-4 h-4" /> 2. Лимитирующие факторы и направленная коррекция
          </h3>
          <div className="space-y-3">
            {limiters.map((item, idx) => (
              <div key={idx} className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-xs text-slate-300 pl-6"><strong>Влияние:</strong> {item.impact}</p>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700 text-xs text-emerald-400 pl-3 border-l-2 border-l-emerald-500">
                  <strong>Коррекция:</strong> {item.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. РАСШИРЕННЫЙ СПРАВОЧНИК ЛИТЕРАТУРНЫХ ДАННЫХ С ФИЛЬТРАМИ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase text-purple-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> 3. Литературные бенчмарки и научные исследования
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
                <option value="МСМК">МСМК</option>
                <option value="МС">МС / КМС</option>
                <option value="1-й разряд">1-й разряд</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredResearch.length > 0 ? (
              filteredResearch.map((item) => (
                <div key={item.id} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" /> {item.author} ({item.year})
                    </span>
                    <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-700">
                      {item.group} | {item.qualification}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 italic">{item.citation}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-700/60 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Плотность боя:</span>
                      <strong className="text-emerald-400 font-mono">{item.metrics.density.mean} ± {item.metrics.density.sd} {item.metrics.density.unit}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">КЭУ:</span>
                      <strong className="text-emerald-400 font-mono">{item.metrics.keu.mean} ± {item.metrics.keu.sd} {item.metrics.keu.unit}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">МПК (VO2max):</span>
                      <strong className="text-emerald-400 font-mono">{item.metrics.vo2maxRel.mean} ± {item.metrics.vo2maxRel.sd} {item.metrics.vo2maxRel.unit}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Время реакции:</span>
                      <strong className="text-emerald-400 font-mono">{item.metrics.reactionTime.mean} ± {item.metrics.reactionTime.sd} {item.metrics.reactionTime.unit}</strong>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic py-3 text-center">По выбранным фильтрам исследования не найдены.</p>
            )}
          </div>
        </div>

      </div>

      {/* Научный анализ референтных сравнений (fullAnalyzer).
          Передаём сырые данные (без демонстрационных значений по умолчанию):
          при отсутствии сохранённого профиля physData === null. */}
      <AnalyzerResultsView athlete={athlete} physData={physData} />
    </div>
  );
}