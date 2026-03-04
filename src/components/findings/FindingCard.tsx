import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, Users } from 'lucide-react';
import { type Finding } from '../../types';
import { SeverityBadge } from '../ui/SeverityBadge';
import { formatDate, formatMoney, truncate, SEVERITY_COLORS } from '../../lib/utils';

interface Props {
  finding: Finding;
}

export function FindingCard({ finding }: Props) {
  const people = finding.people ?? [];
  const totalPeople = people.length;
  const convicted = people.filter((fp) => fp.is_convicted).length;

  return (
    <Link
      to={`/hallazgos/${finding.id}`}
      className="group block bg-dark-800 border border-dark-600 hover:border-dark-500 rounded-xl p-5 transition-all hover:shadow-lg hover:shadow-black/30"
      style={{ borderLeftColor: SEVERITY_COLORS[finding.severity], borderLeftWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-blue-300 transition-colors line-clamp-2">
          {finding.title}
        </h3>
        <SeverityBadge severity={finding.severity} size="sm" />
      </div>

      <p className="text-gray-400 text-xs leading-relaxed mb-4">
        {truncate(finding.summary, 160)}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
        {finding.amount_usd && (
          <span className="flex items-center gap-1 text-emerald-400 font-mono font-semibold">
            {formatMoney(finding.amount_usd)}
          </span>
        )}
        {finding.date_reported && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(finding.date_reported)}
          </span>
        )}
        {totalPeople > 0 && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {totalPeople} {totalPeople === 1 ? 'persona' : 'personas'}
            {convicted > 0 && (
              <span className="text-red-400 ml-0.5">({convicted} conv.)</span>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-600">
        <span className="text-xs text-gray-600 bg-dark-700 px-2 py-0.5 rounded">
          {finding.category}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
      </div>
    </Link>
  );
}
