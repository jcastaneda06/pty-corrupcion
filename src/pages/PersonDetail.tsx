import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, Briefcase } from 'lucide-react';
import { usePerson } from '../hooks/useFinding';
import { SeverityBadge } from '@/components/app/SeverityBadge';
import { MoneyAmount } from '@/components/app/MoneyAmount';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { getInitials, formatDate } from '../lib/utils';
import { type Finding } from '../types';

export function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading, error } = usePerson(id!);

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Skeleton className="h-6 w-32 bg-dark-700" />
        <div className="flex gap-4 items-start">
          <Skeleton className="h-20 w-20 rounded-full bg-dark-700" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-1/2 bg-dark-700" />
            <Skeleton className="h-4 w-1/3 bg-dark-700" />
          </div>
        </div>
        <Skeleton className="h-32 w-full bg-dark-700" />
      </main>
    );
  }

  if (error || !person) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-medium">Persona no encontrada</p>
          <Link to="/" className="text-blue-400 text-sm mt-2 inline-block hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  const findingRecords = person.findings ?? [];
  const totalAmount = findingRecords.reduce(
    (sum, fp) => sum + ((fp as { amount_usd?: number | null }).amount_usd ?? 0),
    0
  );

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Inicio
      </Link>

      {/* Person header */}
      <Card className="bg-dark-800 border-dark-600">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
              {getInitials(person.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white">{person.name}</h1>
              {person.role && (
                <p className="text-blue-400 text-sm mt-0.5 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  {person.role}
                </p>
              )}
              {person.institution && (
                <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  {person.institution}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs bg-dark-700 text-gray-400 border border-dark-500 rounded px-2 py-0.5 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {person.nationality}
                </span>
                {person.is_public_figure && (
                  <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded px-2 py-0.5">
                    Figura Pública
                  </span>
                )}
              </div>
            </div>
            {totalAmount > 0 && (
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-500 mb-1">Monto involucrado</div>
                <MoneyAmount amount={totalAmount} className="text-lg" />
              </div>
            )}
          </div>

          {person.bio && (
            <p className="text-gray-400 text-sm leading-relaxed mt-4 border-t border-dark-700 pt-4">
              {person.bio}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Findings */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Hallazgos Relacionados ({findingRecords.length})
        </h2>
        {findingRecords.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay hallazgos registrados.</p>
        ) : (
          <div className="space-y-3">
            {findingRecords.map((fp) => {
              const finding = (fp as { finding?: Finding }).finding;
              if (!finding) return null;
              return (
                <Link
                  key={fp.id}
                  to={`/hallazgos/${finding.id}`}
                  className="block bg-dark-800 border border-dark-600 hover:border-dark-500 rounded-xl p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white hover:text-blue-300 transition-colors">
                        {finding.title}
                      </h3>
                      {(fp as { role_in_case?: string | null }).role_in_case && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Rol: {(fp as { role_in_case?: string | null }).role_in_case}
                        </p>
                      )}
                      {finding.date_reported && (
                        <p className="text-xs text-gray-600 mt-1">{formatDate(finding.date_reported)}</p>
                      )}
                    </div>
                    <SeverityBadge severity={finding.severity} size="sm" />
                  </div>
                  {(fp as { amount_usd?: number | null }).amount_usd && (
                    <div className="mt-2">
                      <MoneyAmount amount={(fp as { amount_usd?: number | null }).amount_usd} className="text-sm" />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
