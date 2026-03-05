import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Severity } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  critico: '#EF4444',
  alto: '#F97316',
  medio: '#EAB308',
  bajo: '#22C55E',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
};

export const SEVERITY_BG: Record<Severity, string> = {
  critico: 'bg-red-500/10 text-red-400 border-red-500/30',
  alto: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  medio: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  bajo: 'bg-green-500/10 text-green-400 border-green-500/30',
};

export const RELATIONSHIP_LABELS: Record<string, string> = {
  familiar: 'Familiar',
  socio_comercial: 'Socio Comercial',
  politico: 'Político',
  empleado: 'Empleado',
  otro: 'Otro',
};

export const CATEGORY_LABELS: Record<string, string> = {
  'Fraude en Contratación Pública': 'Contratación Pública',
  'Peculado / Malversación': 'Peculado',
  'Lavado de Dinero': 'Lavado de Dinero',
  'Soborno / Cohecho': 'Soborno',
  'Tráfico de Influencias': 'Influencias',
  'Captura del Estado': 'Captura del Estado',
  'Abuso en Emergencias': 'Emergencias',
  'Corrupción en Seguridad': 'Seguridad',
  'Negligencia y Abuso Institucional': 'Abuso Institucional',
  'Violación de Derechos Humanos': 'Derechos Humanos',
};

/**
 * Format a USD amount to a readable string (e.g. $1.2B, $500M, $27.4M)
 */
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return 'Monto desconocido';
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)} mil millones`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString('es-PA')}`;
}

/**
 * Format a date string to a localized Spanish string
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Fecha desconocida';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-PA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Truncate text to a max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Get initials from a full name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

