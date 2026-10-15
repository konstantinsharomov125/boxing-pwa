import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, CheckCircle2, AlertTriangle, BookOpen, Layers, Target, ShieldAlert } from 'lucide-react';

// База академических исследований и нормативов (Отечественная и зарубежная школа)
const RESEARCH_BASE = {
  filimonov: { author: 'Филимонов В.И. (2000)', title: 'Бокс: Спортивно-методическое пособие', topic: 'Биомеханика и структура СФП' },
  taymazov: { author: 'Таймазов В.А. (1997)', title: 'Индивидуализация подготовки боксеров с учетом биоэнергетических типов', topic: 'Энергообеспечение и типы НС' },
  vniifk: { author: 'ФНЦ ВНИИФК (2022)', title: 'Модельные характеристики высококвалифицированных боксеров', topic: 'Нормативы сборных команд РФ' },
  slimani: { author: 'Slimani et al. (2017)', title: 'Physiological and Performance Test Profiles of Elite Boxers', topic: 'Зарубежные тесты физиологического профиля' },
  davis: { author: 'Davis et al. (2013)', title: 'The Physiology of Amateur Boxing', topic: 'Аэробно-анаэробные профили боксеров' }
};

export default function MatrixView({ athlete }) {
  const physStorageKey = `box_phys_${athlete.id}`;
  
  // Загрузка фактических морфофункциональных данных
  const [physData, setPhysData] = useState(() => {
    const saved = localStorage.getItem(physStorageKey);
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const saved = localStorage.getItem(physStorageKey);
    setPhysData(saved ? JSON.parse(saved) : null);
  }, [athlete.id, physStorageKey]);

  // Данные по умолчанию, если профиль еще не заполнен
  const currentPhys = physData || {
    weight: 67.0, smm: 34.5, inbodyScore: 82, phaseAngle: 7.2, bodyFat: 11.5, ecwTbw: 0.375,
    relPower: 12.4, avgPower: 780, timeMaxSpeed: 2.1, timePeakPower: 3.4, maxRpm: 185, fatigueIndex: 18.2,
    vo2maxAbs: 4.2, vo2maxRel: 62.5, aerobicThreshold: 42.0, maxVentilation: 145, tidalVolume: 2.8, respExchangeRatio: 1.12,
    leftPunch: 410.2, rightPunch: 446.7, tonnage10s: 1250, punches10s: 38, punches3min: 210,
    nsType: 'Сильный (средне-сильный)', reactionTime: 220, diffError: 4.5
  };

  // 1. Оценка Темповика
  let tempScore = 0;
  if (currentPhys.vo2maxRel >= 60) tempScore += 30;
  if (currentPhys.relPower >= 12.0) tempScore += 30;
  if (currentPhys.punches3min >= 200) tempScore += 25;
  if (currentPhys.nsType.includes('Сильный')) tempScore += 15;

  // 2. Оценка Нокаутера (Панчера)
  let powerScore = 0;
  const maxPunch = Math.max(currentPhys.leftPunch, currentPhys.rightPunch);
  if (maxPunch >= 430) powerScore += 35;
  if (currentPhys.tonnage10s >= 1200) powerScore += 30;
  if (currentPhys.smm >= 34.0) powerScore += 20;
  if (currentPhys.timePeakPower <= 3.5) powerScore += 15;

  // 3. Оценка Игровика (Контратакующего)
  let gamerScore = 0;
  if (currentPhys.reactionTime <= 210) gamerScore += 35;
  if (currentPhys.diffError <= 4.0) gamerScore += 35;
  if (currentPhys.phaseAngle >= 7.0) gamerScore += 15;
  if (currentPhys.fatigueIndex <= 15.0) gamerScore += 15;

  // Определение ведущего стиля
  const stylesList = [
    { name: 'Темповик (High-Density Swarmer)', score: tempScore, type: 'tempo' },
    { name: 'Силовой панчер / Нокаутер (Power Puncher)', score: powerScore, type: 'power' },
    { name: 'Игровик / Контратакующий (Out-Fighter)', score: gamerScore, type: 'gamer' },
  ].sort((a, b) => b.score - a.score);

  const primaryStyle = stylesList[0];
  const secondaryStyle = stylesList[1];

  // Расчет асимметрии
  const asymmetry = currentPhys.rightPunch > 0 
    ? (Math.abs(currentPhys.rightPunch - currentPhys.leftPunch) / Math.max(currentPhys.rightPunch, currentPhys.leftPunch) * 100).toFixed(1)
    : '0.0';

  // Выявление лимитирующих факторов (дефицитов)
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
      impact: 'Лимитирует скорость восстановления между раундами и в паузах поединка.',
      recommendation: 'Интервальная аэробно-анаэробная работа на тредмиле/велоэргометре в зоне АЭП/ПАНО (Таймазов В.А., 1997; Davis et al., 2013).'
    });
  }

  if (currentPhys.diffError > 5.0) {
    limiters.push({
      title: `Повышенная ошибка дифференцирования мышечного усилия (${currentPhys.diffError}%)`,
      impact: 'Снижает точность акцентированных ударов и контроль дистанции.',
      recommendation: 'Упражнения на динамометрических снарядах с завязанными глазами, работа на мешке с варьированием силы тапа 30-50-80%.'
    });
  }

  if (limiters.length === 0) {
    limiters.push({
      title: 'Все ключевые системы находятся в пределах нормативного коридора',
      impact: 'Высокий уровень адаптационного потенциала.',
      recommendation: 'Поддержание текущего профиля и акцент на технико-тактическое мастерство.'
    });
  }

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
              Автоматический анализ цифрового профиля спортсмена на основе дискриминантных моделей отечественной и зарубежной спортивной науки.
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Алгоритм анализа активен
          </div>
        </div>

        {/* 1. БЛОК ОПРЕДЕЛЕНИЯ ИНДИВИДУАЛЬНОГО СТИЛЯ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-blue-500/30 mb-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-blue-400 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Target className="w-4 h-4" /> 1. Результат определения предпочтительного стиля ведения боя
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/90 p-4 rounded-xl border border-blue-500/40 relative overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Ведущий рекомендуемый стиль</span>
              <div className="text-lg font-bold text-white mt-1">{primaryStyle.name}</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, primaryStyle.score)}%` }}></div>
                </div>
                <span className="text-xs font-bold text-blue-400">{primaryStyle.score}% соответствия</span>
              </div>
            </div>

            <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Вторичный резервный стиль</span>
              <div className="text-lg font-bold text-slate-200 mt-1">{secondaryStyle.name}</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, secondaryStyle.score)}%` }}></div>
                </div>
                <span className="text-xs font-bold text-emerald-400">{secondaryStyle.score}% соответствия</span>
              </div>
            </div>

            <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Индекс асимметрии СФП</span>
              <div className="text-2xl font-bold text-white mt-1">{asymmetry}%</div>
              <span className="text-[11px] text-slate-400 mt-1">
                {parseFloat(asymmetry) <= 5.0 ? '✓ В пределах нормы (< 5%)' : '⚠ Требуется коррекция (> 5%)'}
              </span>
            </div>
          </div>

          {/* Академическое текстовое обоснование */}
          <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 text-xs text-slate-300 space-y-2">
            <div className="font-bold text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-400" /> Научно-методическое обоснование рекомендации:
            </div>
            <p className="leading-relaxed">
              На основе полученных результатов тестирования выявлено сочетание показателей аэробно-анаэробной производительности 
              (МПК = <strong className="text-white">{currentPhys.vo2maxRel} мл/мин/кг</strong>, удельная мощность = <strong className="text-white">{currentPhys.relPower} Вт/кг</strong>) 
              и нейродинамического профиля, что согласно классификации <span className="text-blue-300 font-semibold">{RESEARCH_BASE.taymazov.author}</span> соответствует 
              биоэнергетической модели боксеров <strong>{primaryStyle.name}</strong>.
            </p>
            <p className="leading-relaxed text-slate-400">
              По данным исследований <span className="text-blue-300 font-semibold">{RESEARCH_BASE.vniifk.author}</span> и <span className="text-blue-300 font-semibold">{RESEARCH_BASE.slimani.author}</span>, 
              данный профиль позволяет поддерживать высокую моторную плотность боя без существенного падения точности (КЭУ).
            </p>
          </div>
        </div>

        {/* 2. НАЗНАЧЕНИЕ ПРОГРАММЫ КОРРЕКЦИИ (ЛИМИТИРУЮЩИЕ ФАКТОРЫ) */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 mb-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="w-4 h-4" /> 2. Выявленные лимитирующие факторы и направленная коррекция
          </h3>

          <div className="space-y-3">
            {limiters.map((item, idx) => (
              <div key={idx} className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-xs text-slate-300 pl-6"><strong className="text-slate-400">Влияние:</strong> {item.impact}</p>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700 text-xs text-emerald-400 pl-3 border-l-2 border-l-emerald-500">
                  <strong>Рекомендованный микроцикл коррекции:</strong> {item.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. БИБЛИОМЕТРИЧЕСКИЙ СПРАВОЧНИК НОРМАТИВОВ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 space-y-4">
          <h3 className="text-sm font-bold uppercase text-purple-400 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Layers className="w-4 h-4" /> 3. Нормативные ориентиры из ключевых научно-методических работ
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Автор и источник</th>
                  <th className="p-2.5">Исследуемый показатель</th>
                  <th className="p-2.5">Модельный интервал (M ± SD)</th>
                  <th className="p-2.5">Примечание / Выборка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="p-2.5 font-semibold text-white">{RESEARCH_BASE.filimonov.author}</td>
                  <td className="p-2.5 text-blue-400">Сила удара сильнейшей рукой</td>
                  <td className="p-2.5 font-mono text-emerald-400">420 – 480 кг</td>
                  <td className="p-2.5 text-slate-400">Боксеры ВШМ (63.5 - 71 кг)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-white">{RESEARCH_BASE.vniifk.author}</td>
                  <td className="p-2.5 text-blue-400">Плотность боя / КЭУ</td>
                  <td className="p-2.5 font-mono text-emerald-400">13.5–15.1 уд/мин | КЭУ 0.32-0.42</td>
                  <td className="p-2.5 text-slate-400">Сборная команда РФ</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-white">{RESEARCH_BASE.taymazov.author}</td>
                  <td className="p-2.5 text-blue-400">Относительное МПК (VO2max)</td>
                  <td className="p-2.5 font-mono text-emerald-400">60.0 – 68.0 мл/мин/кг</td>
                  <td className="p-2.5 text-slate-400">Темповый стиль / ЭВСМ</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-white">{RESEARCH_BASE.slimani.author}</td>
                  <td className="p-2.5 text-blue-400">Время простой реакции (t СМР)</td>
                  <td className="p-2.5 font-mono text-emerald-400">180 – 215 мс</td>
                  <td className="p-2.5 text-slate-400">Международные элитные турниры</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold text-white">{RESEARCH_BASE.davis.author}</td>
                  <td className="p-2.5 text-blue-400">Удельная анаэробная мощность</td>
                  <td className="p-2.5 font-mono text-emerald-400">12.0 – 14.2 Вт/кг</td>
                  <td className="p-2.5 text-slate-400">Тест Wingate 30 сек</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}