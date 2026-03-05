import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar, Cell,
  PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { BarChart2, ExternalLink } from 'lucide-react';
import { useDashboardStats } from '../hooks/useFindings';
import { SEVERITY_COLORS, SEVERITY_LABELS, CATEGORY_LABELS, formatMoney, truncate } from '../lib/utils';
import { type Severity } from '../types';

const SEVERITIES: Severity[] = ['critico', 'alto', 'medio', 'bajo'];

const SOURCES = [
  {
    name: 'Fiscalía Anticorrupción',
    description: 'Investigaciones penales activas contra funcionarios del Estado panameño.',
    url: 'https://ministeriopublico.gob.pa',
  },
  {
    name: 'Contraloría General de la República',
    description: 'Auditorías e informes de irregularidades en el gasto público y contratos.',
    url: 'https://www.contraloria.gob.pa',
  },
  {
    name: 'Transparency International',
    description: 'Índice de Percepción de la Corrupción (IPC) — metodología y datos históricos.',
    url: 'https://www.transparency.org/en/cpi',
  },
  {
    name: 'La Prensa de Panamá',
    description: 'Cobertura periodística de investigaciones y juicios de corrupción.',
    url: 'https://www.prensa.com',
  },
  {
    name: 'SENNIAF',
    description: 'Secretaría Nacional de Niñez, Adolescencia y Familia — reportes institucionales.',
    url: 'https://www.senniaf.gob.pa',
  },
  {
    name: 'Asamblea Nacional',
    description: 'Debates legislativos, comisiones de investigación y declaraciones patrimoniales.',
    url: 'https://www.asamblea.gob.pa',
  },
];

// ── Custom tooltips ────────────────────────────────────────────────────────────

function AreaTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className="text-white font-semibold">{payload[0].value} hallazgos</p>
    </div>
  );
}

function AmountTip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm">
      <p className="text-emerald-400 font-semibold">{formatMoney(payload[0].value)}</p>
    </div>
  );
}

function SeverityTip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm">
      <p style={{ color: d.payload.color }} className="font-semibold">{d.name}</p>
      <p className="text-white">{d.value} casos</p>
    </div>
  );
}

function TopTip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm">
      <p className="text-emerald-400 font-semibold">{formatMoney(payload[0].value)}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Estadisticas() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();

  const all = stats?.recent_findings ?? [];

  // Chart data derivations
  const findingsByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    all.forEach(f => {
      const month = f.created_at.slice(0, 7);
      map[month] = (map[month] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('es-PA', { month: 'short', year: '2-digit' }),
        count,
      }));
  }, [all]);

  const amountByCategory = useMemo(() =>
    Object.entries(
      all.reduce((acc, f) => {
        if (f.amount_usd) acc[f.category] = (acc[f.category] || 0) + f.amount_usd;
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([cat, amount]) => ({ name: CATEGORY_LABELS[cat] ?? cat, amount }))
      .sort((a, b) => b.amount - a.amount)
  , [all]);

  const severityData = useMemo(() =>
    SEVERITIES.map(sev => ({
      name: SEVERITY_LABELS[sev],
      value: stats?.by_severity[sev] ?? 0,
      color: SEVERITY_COLORS[sev],
    }))
  , [stats]);

  const top10 = useMemo(() =>
    all
      .filter(f => f.amount_usd)
      .sort((a, b) => (b.amount_usd ?? 0) - (a.amount_usd ?? 0))
      .slice(0, 10)
      .map(f => ({
        id: f.id,
        title: truncate(f.title, 48),
        amount: f.amount_usd!,
        color: SEVERITY_COLORS[f.severity],
      }))
  , [all]);

  const skeleton = <div className="h-64 bg-dark-700 rounded-xl animate-pulse" />;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="w-7 h-7 text-blue-400" />
          Estadísticas
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Análisis financiero y temporal de los {stats?.total_findings ?? '…'} casos documentados
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total hallazgos', value: isLoading ? '…' : String(stats?.total_findings ?? 0), color: 'text-white' },
          { label: 'Fondos comprometidos', value: isLoading ? '…' : formatMoney(stats?.total_amount_usd ?? 0), color: 'text-emerald-400' },
          { label: 'Casos críticos', value: isLoading ? '…' : String(stats?.by_severity.critico ?? 0), color: 'text-red-400' },
          { label: 'En investigación', value: isLoading ? '…' : String(stats?.by_severity.medio ?? 0), color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Chart: Hallazgos por mes */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Hallazgos por mes</h2>
        {isLoading ? skeleton : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={findingsByMonth} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTip />} cursor={{ stroke: '#374151' }} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6', stroke: '#1e3a5f', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Charts: Category amounts + Severity donut */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Amount by category */}
        <div className="lg:col-span-3 bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Monto comprometido por categoría</h2>
          {isLoading ? skeleton : amountByCategory.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin datos de montos disponibles.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart layout="vertical" data={amountByCategory} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatMoney(v)} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#d1d5db', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<AmountTip />} cursor={{ fill: '#1f2937' }} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {amountByCategory.map((_, i) => (
                    <Cell key={i} fill={`hsl(${210 + i * 12}, 70%, ${55 - i * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Severity donut */}
        <div className="lg:col-span-2 bg-dark-800 border border-dark-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Distribución por severidad</h2>
          {isLoading ? skeleton : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={severityData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                    {severityData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<SeverityTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {severityData.map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-gray-400">{s.name}</span>
                    <span className="text-xs font-semibold text-white ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart: Top 10 cases by amount */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Top 10 casos por monto</h2>
        {isLoading ? skeleton : top10.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin datos de montos disponibles.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart layout="vertical" data={top10} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
              onClick={({ activePayload }) => {
                const id = activePayload?.[0]?.payload?.id;
                if (id) navigate(`/hallazgos/${id}`);
              }}
            >
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => formatMoney(v)} />
              <YAxis type="category" dataKey="title" width={220} tick={{ fill: '#d1d5db', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TopTip />} cursor={{ fill: '#1f2937' }} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} style={{ cursor: 'pointer' }}>
                {top10.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="text-xs text-gray-600 mt-2">Haz clic en una barra para ver el caso completo.</p>
      </div>

      {/* Sources */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Fuentes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOURCES.map(src => (
            <a
              key={src.name}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-dark-800 border border-dark-700 hover:border-dark-500 rounded-xl p-4 transition-colors flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors leading-snug">
                  {src.name}
                </p>
                <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{src.description}</p>
            </a>
          ))}
        </div>
      </section>

    </main>
  );
}
