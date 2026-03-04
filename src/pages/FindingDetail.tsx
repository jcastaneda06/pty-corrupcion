import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Tag,
  Users,
  DollarSign,
  Newspaper,
  GitBranch,
} from 'lucide-react';
import { useFinding, useFindingRelationships } from '../hooks/useFinding';
import { RelationshipMap } from '../components/findings/RelationshipMap';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { MoneyAmount } from '../components/ui/MoneyAmount';
import { PersonChip } from '../components/ui/PersonChip';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDate, SEVERITY_COLORS } from '../lib/utils';

export function FindingDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: finding, isLoading, error } = useFinding(id!);
  const { data: relationships = [] } = useFindingRelationships(id!);

  if (isLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (error || !finding) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-medium">Hallazgo no encontrado</p>
          <Link to="/hallazgos" className="text-blue-400 text-sm mt-2 inline-block hover:underline">
            ← Volver a hallazgos
          </Link>
        </div>
      </main>
    );
  }

  const people = finding.people ?? [];
  const sources = finding.sources ?? [];
  const severityColor = SEVERITY_COLORS[finding.severity];

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back */}
      <Link
        to="/hallazgos"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Todos los hallazgos
      </Link>

      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <SeverityBadge severity={finding.severity} size="lg" />
          <span className="text-xs bg-dark-700 text-gray-400 border border-dark-500 rounded px-2 py-1 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {finding.category}
          </span>
        </div>

        <h1
          className="text-2xl sm:text-3xl font-bold leading-tight"
          style={{ color: '#fff' }}
        >
          <span
            className="border-l-4 pl-3"
            style={{ borderColor: severityColor }}
          >
            {finding.title}
          </span>
        </h1>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
          {finding.amount_usd && (
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              <MoneyAmount amount={finding.amount_usd} />
            </span>
          )}
          {finding.date_reported && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Reportado: {formatDate(finding.date_reported)}
            </span>
          )}
          {finding.date_occurred && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Ocurrido: {formatDate(finding.date_occurred)}
            </span>
          )}
        </div>
      </header>

      {/* Summary */}
      <section className="bg-dark-800 border border-dark-600 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Resumen
        </h2>
        <p className="text-gray-200 leading-relaxed whitespace-pre-line">{finding.summary}</p>
        {finding.source_url && (
          <a
            href={finding.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Fuente principal
          </a>
        )}
      </section>

      {/* People involved */}
      {people.length > 0 && (
        <section className="bg-dark-800 border border-dark-600 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Personas Involucradas ({people.length})
          </h2>
          <div className="space-y-3">
            {people.map((fp) => (
              fp.person && (
                <div
                  key={fp.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-dark-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <PersonChip
                      person={fp.person}
                      showAmount={fp.amount_usd}
                      showConvicted={fp.is_convicted}
                    />
                    {fp.role_in_case && (
                      <span className="text-xs text-gray-500">{fp.role_in_case}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {fp.is_convicted && (
                      <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded px-2 py-0.5">
                        Condenado
                      </span>
                    )}
                    {fp.amount_usd && (
                      <MoneyAmount amount={fp.amount_usd} className="text-sm" />
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </section>
      )}

      {/* Relationship map */}
      {people.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Mapa de Relaciones
          </h2>
          <RelationshipMap
            findingPeople={people}
            relationships={relationships}
            severity={finding.severity}
          />
        </section>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <section className="bg-dark-800 border border-dark-600 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Fuentes ({sources.length})
          </h2>
          <ul className="space-y-2.5">
            {sources.map((source) => (
              <li key={source.id} className="flex items-start gap-2 min-w-0">
                <ExternalLink className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors hover:underline break-all"
                  >
                    {source.title ?? source.url}
                  </a>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {source.outlet && <span>{source.outlet}</span>}
                    {source.outlet && source.published_at && <span> · </span>}
                    {source.published_at && <span>{formatDate(source.published_at)}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
