import { useMemo } from 'react';
import { Activity, TrendingUp, Info } from 'lucide-react';
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
import { getMetricById } from '../data/modelsConfig';

const CHART_GROUPS = [
  {
    id: 'density',
    title: 'Плотность боя',
    metricIds: ['density'],
    yAxisLabel: 'уд/мин',
  },
  {
    id: 'competition_ratios',
    title: 'Безразмерные соревновательные показатели',
    metricIds: ['keu', 'kv'],
    yAxisLabel: 'усл. ед.',
  },
  {
    id: 'vo2maxRel',
    title: 'Аэробная производительность',
    metricIds: ['vo2maxRel'],
    yAxisLabel: 'мл/мин/кг',
  },
  {
    id: 'reactionTime',
    title: 'Время простой реакции',
    metricIds: ['reactionTime'],
    yAxisLabel: 'мс',
  },
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

  return (
    <div className="space-y-5">
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-lg">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" /> Продольный профиль и интервальная динамика
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Сопоставление соревновательных метрик с физико-техническими тестами по периодам. Каждый показатель — в своих единицах.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Summary label="Периодов" value={report.periods.length} />
        <Summary label="Боёв" value={report.source.competitionPeriods} />
        <Summary label="Физ. тестов" value={report.source.physicalRecords} />
        <Summary label="Метрик в анализе" value={Object.values(report.delta).filter((v) => v !== null).length} />
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex gap-2.5 items-start">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Для корректной интерпретации каждый показатель визуализируется отдельно в своих единицах измерения.
          Объединение разнородных шкал на одном графике может исказить восприятие динамики.
        </p>
      </div>

      {report.periods.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-8 border border-dashed border-slate-700 text-center text-sm text-slate-400">
          <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          Сохраните бой или физический тест, чтобы сформировать интервальную динамику.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {CHART_GROUPS.map((group) => (
              <MiniChart key={group.id} group={group} report={report} />
            ))}
          </div>

          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Динамика по периодам</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-700">
                    <th className="py-2 pr-3">Период</th>
                    <th className="py-2 pr-3">Источник</th>
                    {CHART_GROUPS.flatMap((g) => g.metricIds).map((metricId) => {
                      const metric = getMetricById(metricId);
                      return (
                        <th key={metricId} className="py-2 pr-3">
                          {metric?.nameRu || metricId} <span className="text-slate-600">({metric?.unit || ''})</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {report.periods.map((period) => (
                    <tr key={period.id} className="border-b border-slate-800">
                      <td className="py-2 pr-3 text-slate-300">{period.date || '—'}</td>
                      <td className="py-2 pr-3 text-slate-400">{period.source === 'competition' ? 'Бой' : 'Тест'}</td>
                      {CHART_GROUPS.flatMap((g) => g.metricIds).map((metricId) => {
                        const value = period.competition[metricId] ?? period.physical[metricId];
                        const delta = report.delta[metricId];
                        return (
                          <td key={metricId} className="py-2 pr-3 text-slate-300">
                            {value !== null && Number.isFinite(value) ? value : '—'}
                            {delta !== null && Number.isFinite(delta) && (
                              <span className={`ml-1 text-[10px] ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                ({delta > 0 ? '+' : ''}{delta.toFixed(2)})
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniChart({ group, report }) {
  const metricLabels = group.metricIds.map((id) => {
    const metric = getMetricById(id);
    return { id, label: metric?.nameRu || id, color: metricColor(id) };
  });

  const data = report.periods.map((period, index) => ({
    period: period.date || `Период ${index + 1}`,
    ...Object.fromEntries(
      group.metricIds.map((id) => [id, period.competition[id] ?? period.physical[id] ?? null]),
    ),
  }));

  const hasData = data.some((row) => group.metricIds.some((id) => row[id] !== null));

  if (!hasData) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h4 className="text-xs font-semibold text-slate-300 mb-2">{group.title}</h4>
        <p className="text-[11px] text-slate-500 italic">Нет данных для отображения.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-xs font-semibold text-slate-300">{group.title}</h4>
        <span className="text-[10px] text-slate-500">{group.yAxisLabel}</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="period" stroke="#94a3b8" fontSize={10} />
            <YAxis stroke="#94a3b8" fontSize={10} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
            {metricLabels.map((metric) => (
              <Line
                key={metric.id}
                type="monotone"
                dataKey={metric.id}
                name={metric.label}
                stroke={metric.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-slate-400">
        {metricLabels.map((metric) => (
          <span key={metric.id} style={{ color: metric.color }}>● {metric.label}</span>
        ))}
      </div>
    </div>
  );
}

function metricColor(id) {
  const colors = {
    density: '#60a5fa',
    keu: '#34d399',
    kv: '#fbbf24',
    vo2maxRel: '#c084fc',
    reactionTime: '#fb7185',
  };
  return colors[id] || '#94a3b8';
}

function Summary({ label, value }) {
  return <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
    <div className="text-xl font-bold text-white">{value}</div>
    <div className="text-[10px] uppercase text-slate-400">{label}</div>
  </div>;
}
