import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';

const CPI_DATA = [
  { year: 2012, score: 38, rank: 83 },
  { year: 2013, score: 35, rank: 102 },
  { year: 2014, score: 37, rank: 94 },
  { year: 2015, score: 39, rank: 72 },
  { year: 2016, score: 38, rank: 87 },
  { year: 2017, score: 37, rank: 96 },
  { year: 2018, score: 37, rank: 93 },
  { year: 2019, score: 36, rank: 101 },
  { year: 2020, score: 35, rank: 111 },
  { year: 2021, score: 36, rank: 105 },
  { year: 2022, score: 36, rank: 101 },
  { year: 2023, score: 35, rank: 108 },
  { year: 2024, score: 33, rank: 114 },
];

const PRESIDENTS = [
  { name: 'Ricardo Martinelli', short: 'Martinelli', start: 2009, end: 2014, debtStart: 43.1, debtEnd: 36.8, color: '#f97316' },
  { name: 'Juan Carlos Varela', short: 'Varela', start: 2014, end: 2019, debtStart: 36.8, debtEnd: 42.0, color: '#eab308' },
  { name: 'Laurentino Cortizo', short: 'Cortizo', start: 2019, end: 2024, debtStart: 42.0, debtEnd: 57.4, color: '#3b82f6' },
  { name: 'José Raúl Mulino', short: 'Mulino', start: 2024, end: 2030, debtStart: 57.4, debtEnd: null, color: '#a855f7' },
];

const DEBT_BY_YEAR: Record<number, number> = {
  2012: 40.2, 2013: 34.4, 2014: 36.8, 2015: 38.1,
  2016: 37.3, 2017: 38.9, 2018: 39.5, 2019: 42.0,
  2020: 64.6, 2021: 70.2, 2022: 52.0, 2023: 55.8, 2024: 57.4,
};

const CHART_MIN = 2012;
const CHART_MAX = 2024;
const WORLD_AVG = 43;

function getPresident(year: number) {
  return PRESIDENTS.find(p => year >= p.start && year < p.end) ?? PRESIDENTS[PRESIDENTS.length - 1];
}

interface TooltipPayloadItem {
  payload: { year: number; score: number; rank: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const { year, score, rank } = payload[0].payload;
  const president = getPresident(year);
  const debt = DEBT_BY_YEAR[year];
  const debtChange = president.debtEnd !== null
    ? (president.debtEnd - president.debtStart).toFixed(1)
    : null;
  const debtChangeNum = debtChange !== null ? parseFloat(debtChange) : null;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg p-3 text-sm min-w-[220px]">
      <p className="font-bold text-white text-base mb-2">{year}</p>
      <div className="space-y-1 text-gray-300">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Puntuación CPI</span>
          <span className="text-white font-medium">{score} / 100</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Posición mundial</span>
          <span className="text-white font-medium">#{rank} de 180</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Promedio mundial</span>
          <span className="text-white font-medium">{WORLD_AVG}</span>
        </div>
      </div>
      <div className="border-t border-dark-600 mt-2 pt-2 space-y-1 text-gray-300">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Presidente</span>
          <span className="font-medium" style={{ color: president.color }}>{president.name}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Deuda pública</span>
          <span className="text-white font-medium">{debt}% PIB</span>
        </div>
        {debtChangeNum !== null ? (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Cambio en mandato</span>
            <span className={`font-medium ${debtChangeNum > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {debtChangeNum > 0 ? '↑' : '↓'} {Math.abs(debtChangeNum)}pp
              <span className="text-gray-500 text-xs ml-1">({president.debtStart}% → {president.debtEnd}%)</span>
            </span>
          </div>
        ) : (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Cambio en mandato</span>
            <span className="text-gray-400 italic">en curso</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CorruptionIndex() {
  const latest = CPI_DATA[CPI_DATA.length - 1];
  const best = CPI_DATA.reduce((a, b) => (b.score > a.score ? b : a));
  const scoreDiff = latest.score - best.score;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Índice de Percepción de Corrupción</h1>
        <p className="text-gray-400 mt-1">Transparency International · Panamá 2012–2024</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Score {latest.year}</p>
          <p className="text-3xl font-bold text-red-400">{latest.score}<span className="text-base text-gray-500 font-normal">/100</span></p>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Posición {latest.year}</p>
          <p className="text-3xl font-bold text-white">#{latest.rank}<span className="text-base text-gray-500 font-normal"> de 180</span></p>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Tendencia</p>
          <p className="text-3xl font-bold text-red-400">
            ↓ {Math.abs(scoreDiff)} pts
          </p>
          <p className="text-xs text-gray-500 mt-0.5">desde {best.year} ({best.score} pts)</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={CPI_DATA} margin={{ top: 24, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />

            {/* Presidential period bands */}
            {PRESIDENTS.map(p => (
              <ReferenceArea
                key={p.short}
                x1={Math.max(p.start, CHART_MIN)}
                x2={Math.min(p.end, CHART_MAX)}
                fill={p.color}
                fillOpacity={0.08}
                label={{
                  value: p.short,
                  position: 'insideTopLeft',
                  fill: p.color,
                  fontSize: 11,
                  fontWeight: 600,
                  dy: -6,
                }}
              />
            ))}

            {/* World average */}
            <ReferenceLine
              y={WORLD_AVG}
              stroke="#6b7280"
              strokeDasharray="4 4"
              label={{ value: `Promedio mundial ${WORLD_AVG}`, position: 'insideTopRight', fill: '#9ca3af', fontSize: 11 }}
            />

            <XAxis
              dataKey="year"
              type="number"
              domain={[CHART_MIN, CHART_MAX]}
              tickCount={13}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
            />
            <YAxis
              domain={[25, 45]}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => String(v)}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4b5563', strokeWidth: 1 }} />

            <Line
              dataKey="score"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: '#ef4444', stroke: '#1f2937', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2 pt-4 border-t border-dark-700">
          {PRESIDENTS.map(p => (
            <div key={p.short} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color, opacity: 0.7 }} />
              <span className="text-xs text-gray-400">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-500 mt-4">
        Escala 0–100. Mayor puntuación = menos corrupción.{' '}
        <a
          href="https://www.transparency.org/en/cpi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-white underline underline-offset-2 transition-colors"
        >
          Fuente: transparency.org ↗
        </a>
      </p>
    </main>
  );
}
