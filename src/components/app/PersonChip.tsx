import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type Person } from "@/types";
import { getInitials } from "@/lib/utils";

interface Props {
  person: Person;
  showAmount?: number | null;
  showConvicted?: boolean;
}

export function PersonChip({ person, showAmount, showConvicted }: Props) {
  return (
    <Link
      to={`/personas/${person.id}`}
      className="inline-flex items-center gap-1.5 bg-dark-700 hover:bg-dark-600 border border-dark-500 hover:border-blue-500/50 rounded-full pl-1 pr-2.5 py-0.5 transition-colors text-sm"
    >
      <Avatar className="w-5 h-5 shrink-0">
        <AvatarFallback className="bg-blue-600 text-white text-[9px] font-bold">
          {getInitials(person.name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-gray-300 truncate max-w-[140px]">{person.name}</span>
      {showConvicted && (
        <span className="ml-0.5 text-red-400 text-xs font-bold">✓</span>
      )}
      {showAmount != null && showAmount > 0 && (
        <span className="text-emerald-400 font-mono text-xs">
          {showAmount >= 1_000_000
            ? `$${(showAmount / 1_000_000).toFixed(0)}M`
            : `$${(showAmount / 1_000).toFixed(0)}K`}
        </span>
      )}
    </Link>
  );
}
