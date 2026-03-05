import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2 } from 'lucide-react';
import { useDashboardStats } from '../hooks/useFindings';
import { FindingCard } from '../components/findings/FindingCard';
import { FindingFilters } from '../components/findings/FindingFilters';
import { FindingCardSkeleton } from '../components/ui/Skeleton';
import { formatMoney } from '../lib/utils';
import { type FindingFilters as Filters } from '../types';

export function Dashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();

  const [filters, setFilters] = useState<Filters>({
    severity: '', category: '', search: '', dateFrom: '', dateTo: '',
  });

  const hasFilters = !!(filters.severity || filters.category || filters.search || filters.dateFrom || filters.dateTo);

  const displayFindings = useMemo(() => {
    const all = stats?.recent_findings ?? [];
    if (!hasFilters) return all.slice(0, 12);

    return all.filter(f => {
      if (filters.severity && f.severity !== filters.severity) return false;
      if (filters.category && f.category !== filters.category) return false;
      if (filters.search && !f.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.dateFrom && (f.date_reported ?? '') < filters.dateFrom) return false;
      if (filters.dateTo && (f.date_reported ?? '') > filters.dateTo) return false;
      return true;
    });
  }, [stats?.recent_findings, filters, hasFilters]);

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

      {/* Compact stats strip */}
      <section className="bg-dark-800 border border-dark-700 rounded-xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Stat label="Hallazgos" value={isLoading ? '…' : String(stats?.total_findings ?? 0)} color="text-white" />
        <div className="hidden sm:block w-px h-7 bg-dark-600" />
        <Stat label="Comprometido" value={isLoading ? '…' : formatMoney(stats?.total_amount_usd ?? 0)} color="text-emerald-400" />
        <div className="hidden sm:block w-px h-7 bg-dark-600" />
        <Stat label="Críticos" value={isLoading ? '…' : String(stats?.by_severity.critico ?? 0)} color="text-red-400" />
        <div className="hidden sm:block w-px h-7 bg-dark-600" />
        <Stat label="En investigación" value={isLoading ? '…' : String(stats?.by_severity.medio ?? 0)} color="text-yellow-400" />
        <Link
          to="/estadisticas"
          className="ml-auto flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          <BarChart2 className="w-4 h-4" />
          Ver estadísticas
        </Link>
      </section>

      {/* Findings with filters */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {hasFilters ? 'Hallazgos' : 'Hallazgos Recientes'}
          </h2>
          <Link
            to="/hallazgos"
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <FindingFilters filters={filters} onChange={setFilters} />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mt-4">
            Error al cargar los datos. Verifica tu conexión a Supabase.
          </div>
        )}

        {!isLoading && hasFilters && (
          <p className="text-sm text-gray-500 mt-4">
            {displayFindings.length} {displayFindings.length === 1 ? 'hallazgo encontrado' : 'hallazgos encontrados'}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <FindingCardSkeleton key={i} />)
            : displayFindings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
        </div>

        {!isLoading && hasFilters && displayFindings.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">No se encontraron hallazgos</p>
            <p className="text-sm mt-1">Intenta ajustar los filtros</p>
          </div>
        )}
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

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}
