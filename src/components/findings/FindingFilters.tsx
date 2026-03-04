import { Search, X } from 'lucide-react';
import { type FindingFilters, type Severity } from '../../types';

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: 'critico', label: 'Crítico' },
  { value: 'alto', label: 'Alto' },
  { value: 'medio', label: 'Medio' },
  { value: 'bajo', label: 'Bajo' },
];

const CATEGORIES = [
  'Fraude en Contratación Pública',
  'Peculado / Malversación',
  'Lavado de Dinero',
  'Soborno / Cohecho',
  'Tráfico de Influencias',
  'Captura del Estado',
  'Abuso en Emergencias',
  'Corrupción en Seguridad',
  'Negligencia y Abuso Institucional',
  'Violación de Derechos Humanos',
];

interface Props {
  filters: FindingFilters;
  onChange: (f: FindingFilters) => void;
}

export function FindingFilters({ filters, onChange }: Props) {
  const hasActiveFilters =
    filters.severity || filters.category || filters.search || filters.dateFrom || filters.dateTo;

  const update = (partial: Partial<FindingFilters>) =>
    onChange({ ...filters, ...partial });

  const clear = () =>
    onChange({ severity: '', category: '', search: '', dateFrom: '', dateTo: '' });

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar hallazgos…"
          value={filters.search ?? ''}
          onChange={(e) => update({ search: e.target.value })}
          className="w-full bg-dark-700 border border-dark-500 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Severity */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Severidad
          </label>
          <select
            value={filters.severity ?? ''}
            onChange={(e) => update({ severity: e.target.value as Severity | '' })}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">Todas</option>
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Categoría
          </label>
          <select
            value={filters.category ?? ''}
            onChange={(e) => update({ category: e.target.value })}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">Todas</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Desde
          </label>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => update({ dateFrom: e.target.value })}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Hasta
          </label>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => update({ dateTo: e.target.value })}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clear}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
