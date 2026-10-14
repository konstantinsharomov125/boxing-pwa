import React from 'react';
import { Brain, CheckCircle2, AlertTriangle, ShieldAlert, Cpu } from 'lucide-react';

export default function MatrixView({ athlete }) {
  // Загружаем данные тестов из Модуля 2
  const physData = (() => {
    const saved = localStorage.getItem(`box_phys_${athlete.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return { rightPunch: 446.7, leftPunch: 410.2, tonnage10s: 1250, nsType: 'Сильный (средне-сильный)', diffError: 4.5, reactionTime: 220 };
  })();

  // Генерация динамических рекомендаций на основе стиля и физики
  const getRecommendations = () => {
    const deficits = [];
    const recommendations = [];

    // Анализ асимметрии
    const maxP = Math.max(physData.rightPunch, physData.leftPunch);
    const minP = Math.min(physData.rightPunch, physData.leftPunch);
    const asymmetry = maxP > 0 ? ((maxP - minP) / maxP) * 100 : 0;

    if (asymmetry > 12) {
      deficits.push(`Высокий коэффициент асимметрии удара (${asymmetry.toFixed(1)}%). Слабая рука отстает от ведущей.`);
      recommendations.push({
        title: 'Выравнивание силового баланса',
        detail: 'Включить изолированные упражнения с гантелями/блоками на отстающую руку (объем +20% по отношению к ведущей).'
      });
    }

    // Анализ стиля
    if (athlete.style === 'Темповик') {
      if (physData.tonnage10s < 1300) {
        deficits.push('Недостаточный тоннаж скоростно-силовой выносливости для темпового стиля (< 1300 кг).');
        recommendations.push({
          title: 'Коррекция серийной выносливости',
          detail: 'Работа на снарядах с отягощением 0.5–1.0 кг в режиме 6 серий по 15 секунд предельного темпа.'
        });
      }
    } else if (athlete.style === 'Нокаутер') {
      if (maxP < 450) {
        deficits.push('Абсолютная сила акцентированного удара ниже модельной нормы нокаутера (< 450 кг).');
        recommendations.push({
          title: 'Развитие максимальной динамической силы',
          detail: 'Плиометрические отжимания с хлопком + броски набивного мяча (5–8 кг) из боевой стойки.'
        });
      }
    }

    // Психомоторика
    if (physData.diffError > 5) {
      deficits.push(`Погрешность дифференцирования мышечного усилия превышает норму (${physData.diffError}%).`);
      recommendations.push({
        title: 'Управление дозированием усилий',
        detail: 'Упражнения на тензометрическом мешке с чередованием акцентированных (80%) и отвлекающих (40%) ударов.'
      });
    }

    // Базовые рекомендации
    if (recommendations.length === 0) {
      recommendations.push({
        title: 'Поддержание модельного уровня',
        detail: 'Текущие показатели соответствуют стилю. Рекомендуется поддерживающий микроцикл.'
      });
    }

    return { deficits, recommendations };
  };

  const { deficits, recommendations } = getRecommendations();

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg space-y-6">
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
            <Brain className="w-5 h-5" /> Экспертная матрица коррекции: {athlete.name}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Синтез соревновательных дефицитов и профиля СФП для автоматического построения тренировки.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs font-medium">
          <Cpu className="w-4 h-4 animate-pulse" /> Алгоритм анализа активен
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Выявленные дефициты */}
        <div className="bg-slate-900 p-5 rounded-xl border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-300 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Выявленные лимитирующие факторы
            </span>
            <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
              Дефициты ({deficits.length})
            </span>
          </div>

          {deficits.length > 0 ? (
            <ul className="space-y-2.5 text-sm text-slate-300 pt-2">
              {deficits.map((def, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{def}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400 pt-2">Явных отклонений от модельных норм стиля не выявлено.</p>
          )}
        </div>

        {/* Назначенный рецепт коррекции */}
        <div className="bg-slate-900 p-5 rounded-xl border border-emerald-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-300 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Назначенная программа коррекции
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
              Протокол СФП
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="bg-slate-800/80 p-3.5 rounded-lg border border-emerald-500/20 space-y-1">
                <span className="text-xs font-bold text-emerald-400 block">{rec.title}</span>
                <p className="text-xs text-slate-300 leading-relaxed">{rec.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}