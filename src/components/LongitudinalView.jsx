import { useMemo } from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyzeAthleteProfile } from '../utils/fullAnalyzer';

const METRICS = [
  { id: 'density', label: 'Плотность', color: '#60a5fa', group: 'competition' },
  { id: 'keu', label: 'КЭУ', color: '#34d399', group: 'competition' },
  { id: 'kv', label: 'КВ', color: '#fbbf24', group: 'competition' },
  { id: 'vo2maxRel', label: 'VO₂max', color: '#c084fc', group: 'physical' },
  { id: 'reactionTime', label: 'Реакция', color: '#fb7185', group: 'physical' },
];

function readHistory(athleteId) {
  try {
    const value = JSON.parse(localStorage.getItem(`box_phys_history_${athleteId}`) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function LongitudinalView({ athlete }) {
  const report = useMemo(() => {
    const physHistory = readHistory(athlete.id);
    let current = {};
    try {
      current = JSON.parse(localStorage.getItem(`box_phys_${athlete.id}`) || '{}');
    } catch {
      current = {};
    }
    return analyzeAthleteProfile(athlete, current, { physHistory }).longitudinal;
  }, [athlete]);

  const chartData = report.periods.map((period, index) => ({
    period: period.date || `Период ${index + 1}`,
    ...period.competition,
    ...period.physical,
  }));

  const analysis = analyzeAthleteProfile(athlete, null, {
    metricIds: report.metricGroups.competition,
  });

  return (
    <div className="space-y-5">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" /> Продольный профиль и интервальная динамика
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Сопоставление соревновательных метрик с физико-техническими тестами по периодам.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Summary label="Периодов" value={report.periods.length} />
        <Summary label="Боёв" value={report.source.competitionPeriods} />
        <Summary label="Физ. тестов" value={report.source.physicalRecords} />
        <Summary label="Метрик в анализе" value={analysis.summary.metricsOk} />
      </div>

      {chartData.length > 0 ? (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                {METRICS.map((metric) => (
                  <Line key={metric.id} type="monotone" dataKey={metric.id} name={metric.label}
                    stroke={metric.color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-400">
            {METRICS.map((metric) => <span key={metric.id} style={{ color: metric.color }}>● {metric.label}</span>)}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl p-8 border border-dashed border-slate-700 text-center text-sm text-slate-400">
          <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          Сохраните бой или физический тест, чтобы сформировать интервальную динамику.
        </div>
      )}

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Интегральное сопоставление показателей</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500 border-b border-slate-700">
              <th className="py-2">Период</th><th>Источник</th><th>Соревновательные</th><th>Физические</th>
            </tr></thead>
            <tbody>{report.periods.map((period) => (
              <tr key={period.id} className="border-b border-slate-800">
                <td className="py-2 text-slate-300">{period.date || '—'}</td>
                <td className="text-slate-400">{period.source === 'competition' ? 'Бой' : 'Тест'}</td>
                <td className="text-blue-300">{period.available.competition.length}/5</td>
                <td className="text-purple-300">{period.available.physical.length}/{report.metricGroups.physical.length}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }) {
  return <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
    <div className="text-xl font-bold text-white">{value}</div>
    <div className="text-[10px] uppercase text-slate-400">{label}</div>
  </div>;
}
