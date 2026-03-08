import { useState } from 'react';
import { Search, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { type PoliticianFilters } from '../../types';
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const POSITIONS = [
  'Presidente',
  'Vicepresidente',
  'Ministro',
  'Diputado',
  'Alcalde',
  'Magistrado',
  'Director',
];

interface Props {
  filters: PoliticianFilters;
  onChange: (f: PoliticianFilters) => void;
}

function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function toStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function PoliticianFilters({ filters, onChange }: Props) {
  const [calOpen, setCalOpen] = useState(false);

  const hasActiveFilters =
    filters.search || filters.position || filters.dateFrom || filters.dateTo;

  const update = (partial: Partial<PoliticianFilters>) =>
    onChange({ ...filters, ...partial });

  const clear = () => onChange({ search: '', position: '', dateFrom: '', dateTo: '' });

  const dateRange: DateRange | undefined =
    filters.dateFrom || filters.dateTo
      ? {
          from: filters.dateFrom ? toDate(filters.dateFrom) : undefined,
          to: filters.dateTo ? toDate(filters.dateTo) : undefined,
        }
      : undefined;

  const handleDateRange = (range: DateRange | undefined) => {
    update({
      dateFrom: range?.from ? toStr(range.from) : '',
      dateTo: range?.to ? toStr(range.to) : '',
    });
    if (range?.from && range?.to) setCalOpen(false);
  };

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'd MMM', { locale: es })} – ${format(dateRange.to, 'd MMM', { locale: es })}`
      : format(dateRange.from, 'd MMM', { locale: es })
    : null;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar políticos…"
          value={filters.search ?? ''}
          onChange={(e) => update({ search: e.target.value })}
          className="bg-dark-800 border-dark-700 text-white placeholder:text-gray-500 focus-visible:ring-blue-500/50 h-9 pl-9 pr-8"
        />
        {filters.search && (
          <button
            onClick={() => update({ search: '' })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Position pills */}
      <div>
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Cargo</p>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((pos) => {
            const active = filters.position === pos;
            return (
              <button
                key={pos}
                onClick={() => update({ position: active ? '' : pos })}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  active
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'border-dark-600 text-gray-400 hover:border-dark-400 hover:text-white'
                )}
              >
                {pos}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date range */}
      <div>
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Período en cargo</p>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors w-full',
                dateRange
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                  : 'border-dark-600 text-gray-400 hover:border-dark-400 hover:text-white'
              )}
            >
              <CalendarIcon className="w-3 h-3" />
              {dateLabel ?? 'Seleccionar período'}
              {dateRange && (
                <X
                  className="w-3 h-3 ml-auto hover:text-white"
                  onClick={(e) => { e.stopPropagation(); update({ dateFrom: '', dateTo: '' }); }}
                />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-dark-800 border-dark-600" align="start">
            <Calendar
              initialFocus
              mode="range"
              selected={dateRange}
              onSelect={handleDateRange}
              numberOfMonths={1}
              locale={es}
              className="text-white"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={clear}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-3 h-3" />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
