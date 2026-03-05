import { Badge } from "@/components/ui/badge";
import { type Severity } from "@/types";
import { SEVERITY_LABELS, SEVERITY_BG } from "@/lib/utils";

interface Props {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass: Record<string, string> = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export function SeverityBadge({ severity, size = 'md' }: Props) {
  return (
    <Badge
      variant="outline"
      className={`font-semibold uppercase tracking-wider ${sizeClass[size]} ${SEVERITY_BG[severity]}`}
    >
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
