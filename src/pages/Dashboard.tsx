import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2 } from 'lucide-react';
import { useDashboardStats } from '../hooks/useFindings';
import { FindingCard } from '../components/findings/FindingCard';
import { FindingFilters } from '../components/findings/FindingFilters';
import { Skeleton } from '@/components/ui/skeleton';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMoney } from '../lib/utils';
import { type FindingFilters as Filters } from '../types';

export function Dashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();

  const [filters, setFilters] = useState<Filters>({
    severity: '', category: '', search: '', dateFrom: '', dateTo: '', sort: '',
  });

  const hasFilters = !!(filters.severity || filters.category || filters.search || filters.dateFrom || filters.dateTo || filters.sort);

  const displayFindings = useMemo(() => {
    const all = stats?.recent_findings ?? [];
    const filtered = hasFilters && (filters.severity || filters.category || filters.search || filters.dateFrom || filters.dateTo)
      ? all.filter(f => {
          if (filters.severity && f.severity !== filters.severity) return false;
          if (filters.category && f.category !== filters.category) return false;
          if (filters.search && !f.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
          if (filters.dateFrom && (f.date_reported ?? '') < filters.dateFrom) return false;
          if (filters.dateTo && (f.date_reported ?? '') > filters.dateTo) return false;
          return true;
        })
      : all.slice(0, 12);

    if (filters.sort === 'date_asc') {
      return [...filtered].sort((a, b) => (a.date_reported ?? '').localeCompare(b.date_reported ?? ''));
    }
    return filtered;
  }, [stats?.recent_findings, filters, hasFilters]);

  console.log(stats?.total_amount_usd);
  return (
    <main className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero */}
      <section className="px-4 sm:px-0">
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:bg-dark-800 sm:border sm:border-dark-700 sm:rounded-xl sm:px-5 sm:py-4">
        <Stat label="Casos" value={isLoading ? '…' : String(stats?.total_findings ?? 0)} color="text-white" />
        <div className="hidden sm:block w-px h-7 bg-dark-600" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Stat label="Comprometido" value={isLoading ? '…' : formatMoney(stats?.total_amount_usd ?? 0)} color="text-emerald-400" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="bg-dark-700 border-dark-500 text-gray-200">
            {`$${Number(stats?.total_amount_usd).toLocaleString('es-PA')}`}
          </TooltipContent>
        </Tooltip>
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
      </div>

      {/* Findings with filters */}
      <section>
        <div className="flex items-center justify-between mb-4 px-4 sm:px-0">
          <h2 className="text-lg font-semibold text-white">
            {hasFilters ? 'Casos' : 'Casos Recientes'}
          </h2>
          <Link
            to="/hallazgos"
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="px-4 sm:px-0">
          <FindingFilters filters={filters} onChange={setFilters} />
        </div>

        {error && (
          <div className="mx-4 sm:mx-0 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mt-4">
            Error al cargar los datos. Verifica tu conexión a Supabase.
          </div>
        )}

        {!isLoading && hasFilters && (
          <p className="text-sm text-gray-500 mt-4 px-4 sm:px-0">
            {displayFindings.length} {displayFindings.length === 1 ? 'caso encontrado' : 'casos encontrados'} hasta hoy
          </p>
        )}

        <div className="divide-y divide-dark-700 md:divide-y-0 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3 mt-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3 md:p-5 md:bg-dark-800 md:border md:border-dark-600 md:rounded-xl space-y-3 animate-pulse">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-5 bg-dark-700 rounded w-3/4" />
                    <div className="h-5 bg-dark-700 rounded w-16" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 bg-dark-700 w-full" />
                    <Skeleton className="h-3 bg-dark-700 w-5/6" />
                    <Skeleton className="h-3 bg-dark-700 w-4/6" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <div className="h-5 bg-dark-700 rounded w-24" />
                    <div className="h-5 bg-dark-700 rounded w-20" />
                  </div>
                </div>
              ))
            : displayFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
        </div>

        {!isLoading && hasFilters && displayFindings.length === 0 && (
          <div className="text-center py-16 text-gray-500 px-4 sm:px-0">
            <p className="text-lg font-medium">No se encontraron casos</p>
            <p className="text-sm mt-1">Intenta ajustar los filtros</p>
          </div>
        )}
      </section>

      {/* Source note */}
      <section className="border-t border-dark-600 pt-6 px-4 sm:px-0">
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
