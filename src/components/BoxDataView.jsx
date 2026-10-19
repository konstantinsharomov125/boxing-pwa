import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Plus, Minus, BarChart3, Clock, Save, Download, History, Calculator, Info, X, BookOpen } from 'lucide-react';
import { getMetricById } from '../data/modelsConfig.js';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend 
} from 'recharts';
import { buildFightRecord } from '../utils/competitionAdapter.js';
import { getOrientirGroups, getOrientirComparison, getOrientirGroupName } from '../data/competitionModelOrientirs.js';
import { normalizeAthleteQualification } from '../data/qualifications.js';


function getResearchInfo(metricId) {
  const metric = getMetricById(metricId);
  if (!metric) return null;
  return {
    title: metric.nameRu,
    formula: metric.formula || 'Формула не задана в каталоге.',
    description: metric.definition,
    limits: metric.interpretationLimits,
  };
}


export default function BoxDataView({ athlete }) {
  const historyKey = `box_fights_history_${athlete.id}`;

  const athleteQualId = normalizeAthleteQualification(athlete.qualification);
  const [qualification, setQualification] = useState(athleteQualId || 'msmk');

  useEffect(() => {
    const next = normalizeAthleteQualification(athlete.qualification);
    if (next) setQualification(next);
  }, [athlete.qualification]);
  const [activeInfoModal, setActiveInfoModal] = useState(null);

  const [roundDuration, setRoundDuration] = useState(3);
  const [totalRoundsCount, setTotalRoundsCount] = useState(3);

  const [rounds, setRounds] = useState([
    { id: 1, jabsTotal: 0, jabsTarget: 0, powerTotal: 0, powerTarget: 0 },
    { id: 2, jabsTotal: 0, jabsTarget: 0, powerTotal: 0, powerTarget: 0 },
    { id: 3, jabsTotal: 0, jabsTarget: 0, powerTotal: 0, powerTarget: 0 },
  ]);

  const [activeRoundId, setActiveRoundId] = useState(1);
  const [timeLeft, setTimeLeft] = useState(roundDuration * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const [opponentName, setOpponentName] = useState('');
  const [fightsHistory, setFightsHistory] = useState(() => {
    const saved = localStorage.getItem(historyKey);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const saved = localStorage.getItem(`box_fights_history_${athlete.id}`);
    setFightsHistory(saved ? JSON.parse(saved) : []);
  }, [athlete.id]);

  useEffect(() => {
    localStorage.setItem(historyKey, JSON.stringify(fightsHistory));
  }, [fightsHistory, historyKey]);

  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(roundDuration * 60);
  };

  const handleRoundDurationChange = (e) => {
    const mins = parseFloat(e.target.value);
    setRoundDuration(mins);
    setTimeLeft(mins * 60);
    setIsTimerRunning(false);
  };

  const handleRoundsCountChange = (e) => {
    const count = parseInt(e.target.value);
    setTotalRoundsCount(count);
    const newRounds = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      jabsTotal: rounds[i]?.jabsTotal || 0,
      jabsTarget: rounds[i]?.jabsTarget || 0,
      powerTotal: rounds[i]?.powerTotal || 0,
      powerTarget: rounds[i]?.powerTarget || 0,
    }));
    setRounds(newRounds);
    if (activeRoundId > count) setActiveRoundId(1);
  };

  const handleTap = (field, delta) => {
    setRounds(rounds.map(r => {
      if (r.id === activeRoundId) {
        const newValue = Math.max(0, r[field] + delta);
        let updatedRow = { ...r, [field]: newValue };
        if (field === 'jabsTarget' && newValue > r.jabsTotal) updatedRow.jabsTotal = newValue;
        if (field === 'powerTarget' && newValue > r.powerTotal) updatedRow.powerTotal = newValue;
        return updatedRow;
      }
      return r;
    }));
  };

  const handleInputChange = (id, field, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setRounds(rounds.map(r => r.id === id ? { ...r, [field]: numValue } : r));
  };

  const resetData = () => {
    setRounds(rounds.map(r => ({ ...r, jabsTotal: 0, jabsTarget: 0, powerTotal: 0, powerTarget: 0 })));
  };

  // Расчеты
  const totalMinutes = totalRoundsCount * roundDuration;
  const totalJabs = rounds.reduce((acc, r) => acc + r.jabsTotal, 0);
  const totalJabsTarget = rounds.reduce((acc, r) => acc + r.jabsTarget, 0);
  const totalPower = rounds.reduce((acc, r) => acc + r.powerTotal, 0);
  const totalPowerTarget = rounds.reduce((acc, r) => acc + r.powerTarget, 0);
  
  const grandTotal = totalJabs + totalPower;
  const grandTarget = totalJabsTarget + totalPowerTarget;
  
  const fightDensity = totalMinutes > 0 ? (grandTotal / totalMinutes).toFixed(1) : '0.0';
  const jabsAccuracy = totalJabs > 0 ? ((totalJabsTarget / totalJabs) * 100).toFixed(1) : '0.0';
  const powerAccuracy = totalPower > 0 ? ((totalPowerTarget / totalPower) * 100).toFixed(1) : '0.0';
  const keu = grandTotal > 0 ? (grandTarget / grandTotal).toFixed(2) : '0.00';
  
  const firstRoundTarget = rounds[0] ? (rounds[0].jabsTarget + rounds[0].powerTarget) : 0;
  const lastRoundTarget = rounds[rounds.length - 1] ? (rounds[rounds.length - 1].jabsTarget + rounds[rounds.length - 1].powerTarget) : 0;
  const kv = lastRoundTarget > 0 ? (firstRoundTarget / lastRoundTarget).toFixed(2) : '1.00';

  // Статистика
  const roundTotals = rounds.map(r => r.jabsTotal + r.powerTotal);
  const meanRounds = roundTotals.length > 0 ? (roundTotals.reduce((a, b) => a + b, 0) / roundTotals.length).toFixed(1) : 0;
  const variance = roundTotals.length > 1 ? roundTotals.reduce((acc, val) => acc + Math.pow(val - meanRounds, 2), 0) / (roundTotals.length - 1) : 0;
  const stdDev = Math.sqrt(variance).toFixed(1);
  const stdError = roundTotals.length > 0 ? (stdDev / Math.sqrt(roundTotals.length)).toFixed(1) : 0;

  // Модельные ориентиры выбранной квалификационной группы
  const orientirGroupName = getOrientirGroupName(qualification);
  const orientirComparison = getOrientirComparison(qualification, {
    density: Number(fightDensity),
    keu: Number(keu),
    kv: Number(kv),
    jabsAcc: Number(jabsAccuracy),
    powerAcc: Number(powerAccuracy),
  });


  const hasAnyOrientir = Object.values(orientirComparison.comparison).some((m) => m.hasOrientir);

  const saveFightToHistory = () => {
    const newFight = buildFightRecord({
      id: Date.now(),
      opponent: opponentName.trim() || 'Турнирный бой',
      rounds,
      roundsCount: totalRoundsCount,
      roundDurationMin: roundDuration,
    });
    setFightsHistory([...fightsHistory, newFight]);
    setOpponentName('');
  };

  const exportToCSV = () => {
    const headers = "Раунд;Всего_джебов;Джебов_в_цель;Всего_силовых;Силовых_в_цель;Всего_за_раунд\n";
    const rows = rounds.map(r => `${r.id};${r.jabsTotal};${r.jabsTarget};${r.powerTotal};${r.powerTarget};${r.jabsTotal + r.powerTotal}`).join("\n");
    const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Соревновательный_профиль_${athlete.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentRound = rounds.find(r => r.id === activeRoundId) || rounds[0];

  const lineChartData = rounds.map(r => ({
    name: `Раунд ${r.id}`,
    ВсегоУдаров: r.jabsTotal + r.powerTotal,
    ТочныхУдаров: r.jabsTarget + r.powerTarget,
  }));

  const comp = orientirComparison.comparison;
  const orientirValue = (metricId) => comp[metricId]?.hasOrientir ? comp[metricId].orientirValue : null;

  const radarChartData = [
    { subject: 'Плотность боя', athlete: Math.min(100, (fightDensity / 16) * 100), model: orientirValue('density') !== null ? (orientirValue('density') / 16) * 100 : 0 },
    { subject: 'КЭУ', athlete: parseFloat(keu) * 100, model: orientirValue('keu') !== null ? orientirValue('keu') * 100 : 0 },
    { subject: 'КВ', athlete: Math.min(100, parseFloat(kv) * 50), model: orientirValue('kv') !== null ? (1 / orientirValue('kv')) * 50 : 0 },
    { subject: 'Точность джебов', athlete: parseFloat(jabsAccuracy), model: orientirValue('jabsAcc') !== null ? orientirValue('jabsAcc') : 0 },
    { subject: 'Точность силовых', athlete: parseFloat(powerAccuracy), model: orientirValue('powerAcc') !== null ? orientirValue('powerAcc') : 0 },
  ];

  const infoContent = activeInfoModal ? getResearchInfo(activeInfoModal) : null;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
        {/* Заголовок и выключатель квалификационной модели */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
              <Activity className="w-6 h-6" /> Соревновательный профиль
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Сравнение характеристик с модельным ориентиром.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Выбор нормативной модели */}
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Модельный ориентир:</span>
              <select 
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                {getOrientirGroups().map((group) => (
                  <option key={group.id} value={group.id} className="bg-slate-800 text-white font-normal">{group.name}</option>
                ))}
              </select>
            </div>

            <button onClick={exportToCSV} className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Экспорт CSV
            </button>
            <button onClick={resetData} className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> Обнулить счет
            </button>
          </div>
        </div>

        {/* Дисклеймер */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-6 flex gap-2.5 items-start">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Модельные ориентиры — авторские точечные значения без верифицированного научного источника и статистик распределения.
            Они не являются референтными нормативами и не используются для автоматических выводов в анализаторе.
          </p>
        </div>

        {/* Настройка боя и таймер */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Продолжительность раунда:</label>
              <select value={roundDuration} onChange={handleRoundDurationChange} className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer">
                <option value={1}>1 мин</option>
                <option value={1.5}>1,5 мин</option>
                <option value={2}>2 мин</option>
                <option value={3}>3 мин</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Количество раундов:</label>
              <select value={totalRoundsCount} onChange={handleRoundsCountChange} className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                  <option key={num} value={num}>{num} {num === 1 ? 'раунд' : (num >= 2 && num <= 4) ? 'раунда' : 'раундов'}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/80 px-6 py-3 rounded-xl border border-slate-700">
            <Clock className="w-6 h-6 text-blue-400" />
            <div className="text-3xl font-mono font-bold tracking-wider text-white">
              {Math.floor(timeLeft / 60)}:{String(Math.floor(timeLeft % 60)).padStart(2, '0')}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsTimerRunning(!isTimerRunning)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${isTimerRunning ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
                {isTimerRunning ? 'Пауза' : 'Старт'}
              </button>
              <button onClick={resetTimer} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs cursor-pointer">Сброс</button>
            </div>
          </div>
        </div>

        {/* ПУЛЬТ-ТАППЕР */}
        <div className="bg-slate-900 p-5 rounded-xl border border-blue-500/30 mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <span className="text-sm font-medium text-slate-300">Выбор активного раунда:</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {rounds.map((r) => (
                <button key={r.id} onClick={() => setActiveRoundId(r.id)} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${activeRoundId === r.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  Раунд {r.id}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col items-center">
              <span className="text-xs text-slate-400 uppercase font-semibold mb-1">Джеб (всего)</span>
              <span className="text-3xl font-bold text-white my-2">{currentRound.jabsTotal}</span>
              <div className="flex gap-2 w-full mt-1">
                <button onClick={() => handleTap('jabsTotal', -1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center cursor-pointer"><Minus className="w-4 h-4" /></button>
                <button onClick={() => handleTap('jabsTotal', 1)} className="flex-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold flex items-center justify-center cursor-pointer"><Plus className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-emerald-500/30 flex flex-col items-center">
              <span className="text-xs text-emerald-400 uppercase font-semibold mb-1">Джеб (в цель)</span>
              <span className="text-3xl font-bold text-emerald-400 my-2">{currentRound.jabsTarget}</span>
              <div className="flex gap-2 w-full mt-1">
                <button onClick={() => handleTap('jabsTarget', -1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center cursor-pointer"><Minus className="w-4 h-4" /></button>
                <button onClick={() => handleTap('jabsTarget', 1)} className="flex-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold flex items-center justify-center cursor-pointer"><Plus className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col items-center">
              <span className="text-xs text-slate-400 uppercase font-semibold mb-1">Силовой (всего)</span>
              <span className="text-3xl font-bold text-white my-2">{currentRound.powerTotal}</span>
              <div className="flex gap-2 w-full mt-1">
                <button onClick={() => handleTap('powerTotal', -1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center cursor-pointer"><Minus className="w-4 h-4" /></button>
                <button onClick={() => handleTap('powerTotal', 1)} className="flex-2 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg font-bold flex items-center justify-center cursor-pointer"><Plus className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/30 flex flex-col items-center">
              <span className="text-xs text-amber-400 uppercase font-semibold mb-1">Силовой (в цель)</span>
              <span className="text-3xl font-bold text-amber-400 my-2">{currentRound.powerTarget}</span>
              <div className="flex gap-2 w-full mt-1">
                <button onClick={() => handleTap('powerTarget', -1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center cursor-pointer"><Minus className="w-4 h-4" /></button>
                <button onClick={() => handleTap('powerTarget', 1)} className="flex-2 bg-amber-500 hover:bg-amber-400 text-white py-2 rounded-lg font-bold flex items-center justify-center cursor-pointer"><Plus className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* БЛОК ПОКАЗАТЕЛЕЙ ПОЕДИНКА С ИНФО-КНОПКАМИ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
            <div className="text-[11px] text-slate-400 leading-tight">Количество ударов</div>
            <div className="text-xl font-bold mt-1 text-white">{grandTotal} <span className="text-[10px] text-slate-500 font-normal">уд.</span></div>
          </div>

          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
            <div className="text-[11px] text-slate-400 leading-tight">Ударов в цель</div>
            <div className="text-xl font-bold mt-1 text-emerald-400">{grandTarget} <span className="text-[10px] text-slate-500 font-normal">уд.</span></div>
          </div>

          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 relative">
            <div className="flex justify-between items-start">
              <span className="text-[11px] text-slate-400 leading-tight">Плотность боя</span>
              <button onClick={() => setActiveInfoModal('density')} className="text-slate-500 hover:text-blue-400 cursor-pointer"><Info className="w-3.5 h-3.5" /></button>
            </div>
            <div className="text-xl font-bold mt-1 text-blue-400">{fightDensity} <span className="text-[10px] text-slate-500 font-normal">уд/мин</span></div>
          </div>

          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
            <div className="text-[11px] text-slate-400 leading-tight">Точность джебов</div>
            <div className="text-xl font-bold mt-1 text-blue-400">{jabsAccuracy}%</div>
          </div>

          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
            <div className="text-[11px] text-slate-400 leading-tight">Точность силовых</div>
            <div className="text-xl font-bold mt-1 text-amber-400">{powerAccuracy}%</div>
          </div>

          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 relative">
            <div className="flex justify-between items-start">
              <span className="text-[11px] text-slate-400 leading-tight">КЭУ</span>
              <button onClick={() => setActiveInfoModal('keu')} className="text-slate-500 hover:text-emerald-400 cursor-pointer"><Info className="w-3.5 h-3.5" /></button>
            </div>
            <div className="text-xl font-bold mt-1 text-emerald-400">{keu} <span className="text-[10px] text-slate-500 font-normal">усл.ед.</span></div>
          </div>

          <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 relative">
            <div className="flex justify-between items-start">
              <span className="text-[11px] text-slate-400 leading-tight">КВ</span>
              <button onClick={() => setActiveInfoModal('kv')} className="text-slate-500 hover:text-amber-400 cursor-pointer"><Info className="w-3.5 h-3.5" /></button>
            </div>
            <div className="text-xl font-bold mt-1 text-amber-400">{kv} <span className="text-[10px] text-slate-500 font-normal">усл.ед.</span></div>
          </div>
        </div>

        {/* Статистика */}
        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 mb-6 flex items-center justify-between flex-wrap gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white">Статистика по раундам:</span>
          </div>
          <div className="flex gap-6">
            <span>M = <strong className="text-blue-400">{meanRounds} уд.</strong></span>
            <span>SD = <strong className="text-amber-400">{stdDev}</strong></span>
            <span>m = <strong className="text-emerald-400">±{stdError}</strong></span>
          </div>
        </div>

        {/* ГРАФИКИ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" /> Динамика активности по раундам
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="ВсегоУдаров" stroke="#3b82f6" strokeWidth={2} name="Всего ударов" />
                  <Line type="monotone" dataKey="ТочныхУдаров" stroke="#10b981" strokeWidth={2} name="В цель" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" /> Сравнение с модельным ориентиром ({orientirGroupName})
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarChartData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <PolarRadiusAxis stroke="#475569" />
                  <Radar name="Спортсмен" dataKey="athlete" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                  <Radar name={`Ориентир (${orientirGroupName})`} dataKey="model" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                  <Legend />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ТАБЛИЦА СРАВНЕНИЯ С МОДЕЛЬНЫМИ ОРИЕНТИРАМИ */}
        {hasAnyOrientir && (
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 mb-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Сравнение с ориентирами ({orientirGroupName})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="p-2.5">Показатель</th>
                    <th className="p-2.5">Факт</th>
                    <th className="p-2.5">Ориентир</th>
                    <th className="p-2.5">Источник / статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {Object.values(comp).map((metric) => {
                    const statusClass = metric.hasOrientir
                      ? (metric.status === 'verified_fulltext' || metric.status === 'verified_primary'
                        ? 'text-emerald-400'
                        : metric.status === 'unverified'
                          ? 'text-amber-400'
                          : 'text-slate-400')
                      : 'text-slate-500';
                    return (
                      <tr key={metric.metricId} className="hover:bg-slate-800/50">
                        <td className="p-2.5 font-medium text-white">
                          {metric.metricId === 'density' && 'Плотность боя'}
                          {metric.metricId === 'keu' && 'КЭУ'}
                          {metric.metricId === 'kv' && 'КВ'}
                          {metric.metricId === 'jabsAcc' && 'Точность джебов'}
                          {metric.metricId === 'powerAcc' && 'Точность силовых'}
                        </td>
                        <td className="p-2.5 text-blue-400 font-bold">
                          {metric.hasActual ? metric.actualValue : '-'}
                          {metric.hasActual && <span className="text-slate-500 font-normal ml-1">{metric.orientirUnit}</span>}
                        </td>
                        <td className="p-2.5">
                          {metric.hasOrientir ? (
                            <span className="text-emerald-400 font-bold">{metric.orientirValue} <span className="text-slate-500 font-normal">{metric.orientirUnit}</span></span>
                          ) : (
                            <span className="text-slate-500 italic">Нет подтверждённого модельного ориентира</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {metric.hasOrientir ? (
                            <span className={statusClass}>{metric.source || '—'}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* АРХИВ ПОЕДИНКОВ */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" /> Архив поединков ({fightsHistory.length})
            </h3>
            <div className="flex gap-2 w-full md:w-auto">
              <input type="text" placeholder="Соперник / Турнир" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500" />
              <button onClick={saveFightToHistory} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0">
                <Save className="w-3.5 h-3.5" /> Сохранить бой
              </button>
            </div>
          </div>

          {fightsHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="p-2.5">Дата</th>
                    <th className="p-2.5">Соперник</th>
                    <th className="p-2.5">Удары (Всего)</th>
                    <th className="p-2.5">Удары (В цель)</th>
                    <th className="p-2.5">Плотность</th>
                    <th className="p-2.5">КЭУ</th>
                    <th className="p-2.5 text-right">КВ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {fightsHistory.map(f => (
                    <tr key={f.id} className="hover:bg-slate-800/50">
                      <td className="p-2.5 text-slate-400">{f.date}</td>
                      <td className="p-2.5 font-medium text-white">{f.opponent}</td>
                      <td className="p-2.5 font-bold text-white">{f.totalPunches} уд.</td>
                      <td className="p-2.5 text-emerald-400 font-bold">{f.targetPunches || '-'} уд.</td>
                      <td className="p-2.5 text-blue-400">{f.density} уд/мин</td>
                      <td className="p-2.5 text-emerald-400">{f.keu}</td>
                      <td className="p-2.5 text-right text-amber-400 font-bold">{f.kv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-2">Архив пуст. Нажмите «Сохранить бой», чтобы занести результат в историю.</p>
          )}
        </div>

        {/* ТАБЛИЦА РАУНДОВ */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-700 text-xs uppercase text-slate-200">
              <tr>
                <th className="px-4 py-3">Раунд</th>
                <th className="px-4 py-3">Всего джебов</th>
                <th className="px-4 py-3 text-emerald-400">Джебы в цель</th>
                <th className="px-4 py-3">Всего силовых</th>
                <th className="px-4 py-3 text-amber-400">Силовые в цель</th>
                <th className="px-4 py-3 text-right">Всего за раунд</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {rounds.map((r) => {
                const rowTotal = r.jabsTotal + r.powerTotal;
                const isSelected = r.id === activeRoundId;
                return (
                  <tr key={r.id} className={`hover:bg-slate-700/50 ${isSelected ? 'bg-slate-700/30 font-semibold' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => setActiveRoundId(r.id)} className={`text-xs px-2.5 py-1 rounded cursor-pointer ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        Раунд {r.id}
                      </button>
                    </td>
                    <td className="px-4 py-3"><input type="number" value={r.jabsTotal} onChange={(e) => handleInputChange(r.id, 'jabsTotal', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" /></td>
                    <td className="px-4 py-3"><input type="number" value={r.jabsTarget} onChange={(e) => handleInputChange(r.id, 'jabsTarget', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400" /></td>
                    <td className="px-4 py-3"><input type="number" value={r.powerTotal} onChange={(e) => handleInputChange(r.id, 'powerTotal', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" /></td>
                    <td className="px-4 py-3"><input type="number" value={r.powerTarget} onChange={(e) => handleInputChange(r.id, 'powerTarget', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-400" /></td>
                    <td className="px-4 py-3 text-right text-blue-400 font-bold">{rowTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО НАУЧНОЙ СПРАВКИ */}
      {activeInfoModal && infoContent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <button onClick={() => setActiveInfoModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-blue-400 mb-3">
              <BookOpen className="w-5 h-5" />
              <h3 className="text-base font-bold">{infoContent.title}</h3>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-900/80 p-2.5 rounded border border-slate-700 font-mono text-emerald-400">
                {infoContent.formula}
              </div>
              <p className="leading-relaxed text-slate-200">
                {infoContent.description}
              </p>
              <div className="border-t border-slate-700 pt-3 text-[11px] text-slate-400 italic">
                <strong>Ограничения интерпретации:</strong> {infoContent.limits}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={() => setActiveInfoModal(null)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded text-xs cursor-pointer">
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
