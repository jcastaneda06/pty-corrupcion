import { type Severity } from '../../types';
import { SEVERITY_LABELS, SEVERITY_BG } from '../../lib/utils';

interface Props {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
}

export function SeverityBadge({ severity, size = 'md' }: Props) {
  const sizeClass = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded border uppercase tracking-wider ${sizeClass} ${SEVERITY_BG[severity]}`}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
