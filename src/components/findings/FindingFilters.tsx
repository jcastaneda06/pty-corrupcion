import { useState } from 'react';
import { Search, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { type FindingFilters, type Severity } from '../../types';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

// Convert YYYY-MM-DD string to Date (local noon to avoid timezone shifts)
function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

// Convert Date to YYYY-MM-DD string
function toStr(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function FindingFilters({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const hasActiveFilters =
    filters.severity || filters.category || filters.search || filters.dateFrom || filters.dateTo || filters.sort;

  const update = (partial: Partial<FindingFilters>) =>
    onChange({ ...filters, ...partial });

  const clear = () =>
    onChange({ severity: '', category: '', search: '', dateFrom: '', dateTo: '', sort: '' });

  // Build DateRange from filter strings
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
    // Close only when both ends are picked
    if (range?.from && range?.to) setOpen(false);
  };

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'd MMM', { locale: es })} – ${format(dateRange.to, 'd MMM yyyy', { locale: es })}`
      : format(dateRange.from, 'd MMM yyyy', { locale: es })
    : 'Rango de fechas';

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Buscar casos…"
          value={filters.search ?? ''}
          onChange={(e) => update({ search: e.target.value })}
          className="bg-dark-700 border-dark-500 text-white placeholder:text-gray-500 focus-visible:ring-blue-500 h-9 pl-9"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Severity */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Severidad
          </label>
          <Select
            value={filters.severity || '__all__'}
            onValueChange={(v) => update({ severity: v === '__all__' ? '' : v as Severity })}
          >
            <SelectTrigger className="bg-dark-700 border-dark-500 text-white h-9 focus:ring-blue-500">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-dark-800 border-dark-600 text-white">
              <SelectItem value="__all__" className="focus:bg-dark-700 focus:text-white text-gray-300">Todas</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="focus:bg-dark-700 focus:text-white text-gray-300">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Categoría
          </label>
          <Select
            value={filters.category || '__all__'}
            onValueChange={(v) => update({ category: v === '__all__' ? '' : v })}
          >
            <SelectTrigger className="bg-dark-700 border-dark-500 text-white h-9 focus:ring-blue-500">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-dark-800 border-dark-600 text-white">
              <SelectItem value="__all__" className="focus:bg-dark-700 focus:text-white text-gray-300">Todas</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="focus:bg-dark-700 focus:text-white text-gray-300">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Orden
          </label>
          <Select
            value={filters.sort || 'date_desc'}
            onValueChange={(v) => update({ sort: v === 'date_desc' ? '' : v as 'date_asc' })}
          >
            <SelectTrigger className="bg-dark-700 border-dark-500 text-white h-9 focus:ring-blue-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-dark-800 border-dark-600 text-white">
              <SelectItem value="date_desc" className="focus:bg-dark-700 focus:text-white text-gray-300">Más reciente</SelectItem>
              <SelectItem value="date_asc" className="focus:bg-dark-700 focus:text-white text-gray-300">Más antiguo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date range picker — spans 2 cols on large screens */}
        <div className="lg:col-span-2">
          <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Período
          </label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-9 justify-start text-left font-normal bg-dark-700 border-dark-500 hover:bg-dark-600 hover:text-white",
                  dateRange ? "text-white" : "text-gray-500"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{dateLabel}</span>
                {dateRange && (
                  <X
                    className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      update({ dateFrom: '', dateTo: '' });
                    }}
                  />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 bg-dark-800 border-dark-600"
              align="start"
            >
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
        </div>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors h-auto p-0"
        >
          <X className="w-3.5 h-3.5" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
