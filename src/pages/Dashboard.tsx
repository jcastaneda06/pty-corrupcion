import { Link } from 'react-router-dom';
import { TrendingUp, DollarSign, AlertTriangle, FileSearch, ArrowRight } from 'lucide-react';
import { useDashboardStats } from '../hooks/useFindings';
import { FindingCard } from '../components/findings/FindingCard';
import { FindingCardSkeleton } from '../components/ui/Skeleton';
import { formatMoney, SEVERITY_LABELS, SEVERITY_COLORS } from '../lib/utils';
import { type Severity } from '../types';

const SEVERITIES: Severity[] = ['critico', 'alto', 'medio', 'bajo'];

export function Dashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero */}
      <section>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Panel de Corrupción
            </h1>
            <p className="text-gray-400 mt-1 text-sm sm:text-base">
              Monitoreo de casos de corrupción en Panamá · Datos actualizados automáticamente
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs text-gray-600 uppercase tracking-wider">CPI 2024</span>
            <span className="text-2xl font-bold text-red-400">33/100</span>
            <span className="text-xs text-gray-500">#114 de 180</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileSearch className="w-5 h-5 text-blue-400" />}
          label="Total Hallazgos"
          value={isLoading ? '…' : String(stats?.total_findings ?? 0)}
          sub="casos registrados"
          color="blue"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
          label="Fondos Comprometidos"
          value={isLoading ? '…' : formatMoney(stats?.total_amount_usd ?? 0)}
          sub="monto total estimado"
          color="emerald"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          label="Casos Críticos"
          value={isLoading ? '…' : String(stats?.by_severity.critico ?? 0)}
          sub="severidad máxima"
          color="red"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
          label="En Investigación"
          value={isLoading ? '…' : String(stats?.by_severity.medio ?? 0)}
          sub="seguimiento activo"
          color="orange"
        />
      </section>

      {/* Severity breakdown */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Por Severidad</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SEVERITIES.map((sev) => {
            const count = stats?.by_severity[sev] ?? 0;
            const total = stats?.total_findings ?? 1;
            const pct = Math.round((count / total) * 100);
            return (
              <Link
                key={sev}
                to={`/hallazgos?severity=${sev}`}
                className="bg-dark-800 border border-dark-600 hover:border-dark-500 rounded-xl p-4 transition-all group"
              >
                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: SEVERITY_COLORS[sev] }}
                >
                  {isLoading ? '–' : count}
                </div>
                <div className="text-sm text-gray-400 font-medium">{SEVERITY_LABELS[sev]}</div>
                <div className="mt-2 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: isLoading ? '0%' : `${pct}%`,
                      backgroundColor: SEVERITY_COLORS[sev],
                    }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">{pct}% del total</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent findings */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Hallazgos Recientes</h2>
          <Link
            to="/hallazgos"
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            Error al cargar los datos. Verifica tu conexión a Supabase.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <FindingCardSkeleton key={i} />)
            : stats?.recent_findings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
        </div>
      </section>

      {/* Source note */}
      <section className="border-t border-dark-600 pt-6">
        <p className="text-xs text-gray-600 text-center max-w-2xl mx-auto">
          Los datos son recopilados automáticamente de fuentes públicas y procesados con IA.
          No constituyen asesoría legal. Para reportar información:{' '}
          <a
            href="https://ministeriopublico.gob.pa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Ministerio Público de Panamá
          </a>
          .
        </p>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: 'blue' | 'emerald' | 'red' | 'orange';
}) {
  const borderColor = {
    blue: 'border-blue-500/20 hover:border-blue-500/40',
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
    red: 'border-red-500/20 hover:border-red-500/40',
    orange: 'border-orange-500/20 hover:border-orange-500/40',
  }[color];

  return (
    <div className={`bg-dark-800 border ${borderColor} rounded-xl p-4 transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-white font-mono">{value}</div>
      <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
    </div>
  );
}
