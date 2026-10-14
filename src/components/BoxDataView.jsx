import React, { useState } from 'react';
import { Activity, RefreshCw, Plus, Minus, Flame, BarChart3 } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend 
} from 'recharts';

export default function BoxDataView({ athlete }) {
  const [rounds, setRounds] = useState([
    { id: 1, jabsTotal: 35, jabsTarget: 12, powerTotal: 18, powerTarget: 5 },
    { id: 2, jabsTotal: 30, jabsTarget: 10, powerTotal: 15, powerTarget: 4 },
    { id: 3, jabsTotal: 25, jabsTarget: 7, powerTotal: 12, powerTarget: 3 },
  ]);

  const [activeRoundId, setActiveRoundId] = useState(1);

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
    setRounds([
      { id: 1, jabsTotal: 0, jabsTarget: 0, powerTotal: 0, powerTarget: 0 },
      { id: 2, jabsTotal: 0, jabsTarget: 0, powerTotal: 0, powerTarget: 0 },
      { id: 3, jabsTotal: 0, jabsTarget: 0, powerTotal: 0, powerTarget: 0 },
    ]);
  };

  const totalJabs = rounds.reduce((acc, r) => acc + r.jabsTotal, 0);
  const totalJabsTarget = rounds.reduce((acc, r) => acc + r.jabsTarget, 0);
  const totalPower = rounds.reduce((acc, r) => acc + r.powerTotal, 0);
  const totalPowerTarget = rounds.reduce((acc, r) => acc + r.powerTarget, 0);
  
  const grandTotal = totalJabs + totalPower;
  const grandTarget = totalJabsTarget + totalPowerTarget;
  
  const fightDensity = (grandTotal / 9).toFixed(1);
  const keu = grandTotal > 0 ? (grandTarget / grandTotal * 100).toFixed(1) : '0.0';
  
  const firstRoundTarget = rounds[0].jabsTarget + rounds[0].powerTarget;
  const lastRoundTarget = rounds[rounds.length - 1].jabsTarget + rounds[rounds.length - 1].powerTarget;
  const kv = lastRoundTarget > 0 ? (firstRoundTarget / lastRoundTarget).toFixed(2) : '1.00';

  const currentRound = rounds.find(r => r.id === activeRoundId);

  const lineChartData = rounds.map(r => ({
    name: `Раунд ${r.id}`,
    ВсегоУдаров: r.jabsTotal + r.powerTotal,
    ТочныхУдаров: r.jabsTarget + r.powerTarget,
  }));

  const radarChartData = [
    { subject: 'Плотность темпа', athlete: Math.min(100, (fightDensity / 16) * 100), model: 85 },
    { subject: 'Коэффициент эффективности (КЭУ)', athlete: parseFloat(keu), model: 35 },
    { subject: 'Коэффициент выносливости (КВ)', athlete: Math.min(100, parseFloat(kv) * 50), model: 90 },
    { subject: 'Активность джебов', athlete: Math.min(100, (totalJabs / 100) * 100), model: 80 },
    { subject: 'Силовая нагрузка', athlete: Math.min(100, (totalPower / 60) * 100), model: 75 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
              <Activity className="w-5 h-5" /> Соревновательный профиль боксера: {athlete.name}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Фиксация ударов в реальном времени и графический анализ соревновательной деятельности.
            </p>
          </div>
          <button 
            onClick={resetData}
            className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Обнулить счет
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-400">Плотность боя</div>
            <div className="text-3xl font-bold mt-1 text-blue-400">{fightDensity} <span className="text-xs font-normal text-slate-400">уд/мин</span></div>
            <div className="text-xs text-slate-500 mt-1">Модельная норма: 13.1 — 15.3</div>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-400">Коэффициент эффективности ударов (КЭУ)</div>
            <div className="text-3xl font-bold mt-1 text-emerald-400">{keu}%</div>
            <div className="text-xs text-slate-500 mt-1">Доля точных попаданий в цель</div>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-400">Коэффициент выносливости (КВ)</div>
            <div className="text-3xl font-bold mt-1 text-amber-400">{kv}</div>
            <div className="text-xs text-slate-500 mt-1">Соотношение 1-го и финального раунда</div>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-xl border border-blue-500/30 mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <span className="text-sm font-medium text-slate-300">Выбор активного раунда:</span>
            <div className="flex gap-2">
              {[1, 2, 3].map((rNum) => (
                <button
                  key={rNum}
                  onClick={() => setActiveRoundId(rNum)}
                  className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all cursor-pointer ${
                    activeRoundId === rNum 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Раунд {rNum}
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
                <button onClick={() => handleTap('jabsTotal', 1)} className="flex-2 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer"><Plus className="w-5 h-5" /> ТАП</button>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-emerald-500/30 flex flex-col items-center">
              <span className="text-xs text-emerald-400 uppercase font-semibold mb-1">Джеб (в цель)</span>
              <span className="text-3xl font-bold text-emerald-400 my-2">{currentRound.jabsTarget}</span>
              <div className="flex gap-2 w-full mt-1">
                <button onClick={() => handleTap('jabsTarget', -1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center cursor-pointer"><Minus className="w-4 h-4" /></button>
                <button onClick={() => handleTap('jabsTarget', 1)} className="flex-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer"><Plus className="w-5 h-5" /> ТАП</button>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col items-center">
              <span className="text-xs text-slate-400 uppercase font-semibold mb-1">Силовой (всего)</span>
              <span className="text-3xl font-bold text-white my-2">{currentRound.powerTotal}</span>
              <div className="flex gap-2 w-full mt-1">
                <button onClick={() => handleTap('powerTotal', -1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center cursor-pointer"><Minus className="w-4 h-4" /></button>
                <button onClick={() => handleTap('powerTotal', 1)} className="flex-2 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer"><Flame className="w-4 h-4" /> ТАП</button>
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/30 flex flex-col items-center">
              <span className="text-xs text-amber-400 uppercase font-semibold mb-1">Силовой (в цель)</span>
              <span className="text-3xl font-bold text-amber-400 my-2">{currentRound.powerTarget}</span>
              <div className="flex gap-2 w-full mt-1">
                <button onClick={() => handleTap('powerTarget', -1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center cursor-pointer"><Minus className="w-4 h-4" /></button>
                <button onClick={() => handleTap('powerTarget', 1)} className="flex-2 bg-amber-500 hover:bg-amber-400 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer"><Flame className="w-4 h-4" /> ТАП</button>
              </div>
            </div>
          </div>
        </div>

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
              <Activity className="w-4 h-4 text-amber-400" /> Сравнение с модельной характеристикой стиля
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarChartData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis stroke="#475569" />
                  <Radar name="Спортсмен" dataKey="athlete" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                  <Radar name="Модель" dataKey="model" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                  <Legend />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

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
                      <button 
                        onClick={() => setActiveRoundId(r.id)}
                        className={`text-xs px-2.5 py-1 rounded cursor-pointer ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                      >
                        Раунд {r.id}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={r.jabsTotal} onChange={(e) => handleInputChange(r.id, 'jabsTotal', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={r.jabsTarget} onChange={(e) => handleInputChange(r.id, 'jabsTarget', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={r.powerTotal} onChange={(e) => handleInputChange(r.id, 'powerTotal', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={r.powerTarget} onChange={(e) => handleInputChange(r.id, 'powerTarget', e.target.value)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-400" />
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400 font-bold">{rowTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}