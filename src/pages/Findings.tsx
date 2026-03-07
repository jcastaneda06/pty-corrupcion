import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useFindings } from '../hooks/useFindings';
import { FindingCard } from '../components/findings/FindingCard';
import { FindingFilters as FiltersComponent } from '../components/findings/FindingFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { type FindingFilters, type Severity } from '../types';

export function Findings() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<FindingFilters>({
    severity: (searchParams.get('severity') as Severity) || '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    sort: (searchParams.get('sort') as 'date_asc') || '',
  });

  // Sync filters → URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.severity) params.severity = filters.severity;
    if (filters.category) params.category = filters.category;
    if (filters.search) params.search = filters.search;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.sort) params.sort = filters.sort;
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const { data: findings, isLoading, error } = useFindings(filters);

  return (
    <main className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-400" />
          Casos
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Todos los casos de corrupción documentados en Panamá
        </p>
      </div>

      <div className="px-4 sm:px-0">
        <FiltersComponent filters={filters} onChange={setFilters} />
      </div>

      {error && (
        <div className="mx-4 sm:mx-0 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Error al cargar los casos. Verifica tu conexión a Supabase.
        </div>
      )}

      {!isLoading && findings && (
        <p className="text-sm text-gray-500 px-4 sm:px-0">
          {findings.length} {findings.length === 1 ? 'caso encontrado' : 'casos encontrados'} hasta hoy
        </p>
      )}

      <div className="divide-y divide-dark-700 md:divide-y-0 md:grid md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 9 }).map((_, i) => (
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
          : findings?.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
      </div>

      {!isLoading && findings?.length === 0 && (
        <div className="text-center py-20 text-gray-500 px-4 sm:px-0">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No se encontraron casos</p>
          <p className="text-sm mt-1">Intenta ajustar los filtros de búsqueda</p>
        </div>
      )}
    </main>
  );
}
