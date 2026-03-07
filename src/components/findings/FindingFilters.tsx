import { useState } from 'react';
import { Search, X, CalendarIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { type FindingFilters, type Severity } from '../../types';
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SEVERITIES: { value: Severity; label: string; active: string; inactive: string }[] = [
  { value: 'critico', label: 'Crítico',  active: 'bg-red-500/20 border-red-500 text-red-300',    inactive: 'border-dark-600 text-gray-400 hover:border-red-500/50 hover:text-red-400' },
  { value: 'alto',    label: 'Alto',     active: 'bg-orange-500/20 border-orange-500 text-orange-300', inactive: 'border-dark-600 text-gray-400 hover:border-orange-500/50 hover:text-orange-400' },
  { value: 'medio',   label: 'Medio',    active: 'bg-yellow-500/20 border-yellow-500 text-yellow-300', inactive: 'border-dark-600 text-gray-400 hover:border-yellow-500/50 hover:text-yellow-400' },
  { value: 'bajo',    label: 'Bajo',     active: 'bg-green-500/20 border-green-500 text-green-300',  inactive: 'border-dark-600 text-gray-400 hover:border-green-500/50 hover:text-green-400' },
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

// Short category labels for the chip
const CATEGORY_SHORT: Record<string, string> = {
  'Fraude en Contratación Pública': 'Contratación',
  'Peculado / Malversación': 'Peculado',
  'Lavado de Dinero': 'Lavado',
  'Soborno / Cohecho': 'Soborno',
  'Tráfico de Influencias': 'Influencias',
  'Captura del Estado': 'Captura',
  'Abuso en Emergencias': 'Emergencias',
  'Corrupción en Seguridad': 'Seguridad',
  'Negligencia y Abuso Institucional': 'Negligencia',
  'Violación de Derechos Humanos': 'DDHH',
};

interface Props {
  filters: FindingFilters;
  onChange: (f: FindingFilters) => void;
}

function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function toStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function FindingFilters({ filters, onChange }: Props) {
  const [calOpen, setCalOpen] = useState(false);

  const hasActiveFilters =
    filters.severity || filters.category || filters.search || filters.dateFrom || filters.dateTo || filters.sort;

  const update = (partial: Partial<FindingFilters>) =>
    onChange({ ...filters, ...partial });

  const clear = () =>
    onChange({ severity: '', category: '', search: '', dateFrom: '', dateTo: '', sort: '' });

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
    <div className="space-y-2.5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar casos…"
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

      {/* Filter strip — breaks out of parent px-4 on mobile to go edge-to-edge */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 -mx-4 px-4 sm:mx-0 sm:px-0">

        {/* Severity pills */}
        {SEVERITIES.map((s) => {
          const active = filters.severity === s.value;
          return (
            <button
              key={s.value}
              onClick={() => update({ severity: active ? '' : s.value })}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                active ? s.active : s.inactive
              )}
            >
              {s.label}
            </button>
          );
        })}

        <div className="shrink-0 w-px h-4 bg-dark-700 mx-0.5" />

        {/* Sort segmented control */}
        <div className="shrink-0 flex rounded-full border border-dark-700 overflow-hidden text-xs">
          <button
            onClick={() => update({ sort: '' })}
            className={cn(
              'px-2.5 py-1 transition-colors',
              !filters.sort ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'
            )}
          >
            ↓ Reciente
          </button>
          <button
            onClick={() => update({ sort: 'date_asc' })}
            className={cn(
              'px-2.5 py-1 border-l border-dark-700 transition-colors',
              filters.sort === 'date_asc' ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'
            )}
          >
            ↑ Antiguo
          </button>
        </div>

        <div className="shrink-0 w-px h-4 bg-dark-700 mx-0.5" />

        {/* Category — compact pill select */}
        <Select
          value={filters.category || '__all__'}
          onValueChange={(v) => update({ category: v === '__all__' ? '' : v })}
        >
          <SelectTrigger
            className={cn(
              'shrink-0 h-7 text-xs rounded-full px-2.5 border gap-1 w-auto focus:ring-0 focus:ring-offset-0 transition-colors',
              filters.category
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : 'bg-transparent border-dark-600 text-gray-400 hover:border-dark-400 hover:text-white'
            )}
          >
            <SelectValue>
              {filters.category ? CATEGORY_SHORT[filters.category] ?? filters.category : 'Categoría'}
            </SelectValue>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
          </SelectTrigger>
          <SelectContent className="bg-dark-800 border-dark-600 text-white">
            <SelectItem value="__all__" className="focus:bg-dark-700 focus:text-white text-gray-300">Todas las categorías</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="focus:bg-dark-700 focus:text-white text-gray-300">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range pill */}
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors',
                dateRange
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                  : 'border-dark-600 text-gray-400 hover:border-dark-400 hover:text-white'
              )}
            >
              <CalendarIcon className="w-3 h-3" />
              {dateLabel ?? 'Período'}
              {dateRange && (
                <X
                  className="w-3 h-3 hover:text-white"
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
              numberOfMonths={2}
              locale={es}
              className="text-white"
            />
          </PopoverContent>
        </Popover>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            onClick={clear}
            className="shrink-0 ml-1 flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
