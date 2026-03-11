import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { UserRoundCheck, ExternalLink, ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { MarkDuplicateButton } from '../components/duplicates/MarkDuplicateButton';
import { EditPoliticianModal } from '../components/politicians/EditPoliticianModal';
import { useListPoliticians, usePoliticianTimeline, useDeletePolitician } from '../hooks/usePoliticians';
import { PoliticianFilters } from '../components/politicians/PoliticianFilters';
import { useAuth } from '../contexts/AuthContext';
import { SeverityBadge } from '../components/app/SeverityBadge';
import { MoneyAmount } from '../components/app/MoneyAmount';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { type PoliticianFilters as PoliticianFiltersType, type Politician, type FindingPerson } from '../types';
import { getInitials, formatDate, formatMoney, SEVERITY_COLORS } from '../lib/utils';
import { cn } from '@/lib/utils';

function getCountBadgeColor(count: number): string {
  if (count > 5) return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (count >= 2) return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
  return 'bg-dark-600 text-gray-400 border-dark-500';
}

interface PoliticianItemProps {
  politician: Politician;
  selected: boolean;
  isAdmin: boolean;
  onClick: () => void;
}

function PoliticianItem({ politician, selected, isAdmin, onClick }: PoliticianItemProps) {
  const name = politician.person?.name ?? '';
  const count = politician.finding_count ?? 0;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { mutate: deletePolitician, isPending: isDeleting } = useDeletePolitician();

  return (
    <>
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-l-2',
          selected
            ? 'bg-dark-700 border-blue-500'
            : 'border-transparent hover:bg-dark-800'
        )}
      >
        {politician.photo_url ? (
          <img
            src={politician.photo_url}
            alt={name}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-dark-700"
          />
        ) : (
          <div className="w-9 h-9 rounded-full flex-shrink-0 bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300">
            {getInitials(name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm font-semibold text-white truncate">{name}</p>
              </TooltipTrigger>
              <TooltipContent side="right"><p>{name}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="text-xs text-gray-500 truncate">{politician.political_position}</p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge
            variant="outline"
            className={cn('text-xs px-1.5 py-0.5 font-semibold', getCountBadgeColor(count))}
          >
            {count}
          </Badge>
          <span onClick={(e) => e.stopPropagation()}>
            <MarkDuplicateButton type="person" subject={politician} />
          </span>
          {isAdmin && (
            <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditOpen(true); }}
                      className="flex items-center justify-center w-6 h-6 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                      aria-label="Editar político"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>Editar</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteOpen(true); }}
                      className="flex items-center justify-center w-6 h-6 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      aria-label="Eliminar político"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>Eliminar</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          )}
        </div>
      </button>

      {editOpen && (
        <EditPoliticianModal
          politician={politician}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={(v) => !v && setDeleteOpen(false)}>
        <DialogContent
          className="bg-dark-800 border-dark-700 text-white max-w-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isDeleting) {
              deletePolitician(politician.person_id, { onSuccess: () => setDeleteOpen(false) });
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-white text-base">Eliminar político</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400 mt-1">
            ¿Estás seguro de que quieres eliminar a{' '}
            <span className="text-white font-semibold">{name}</span>? Esta acción se puede revertir desde la base de datos.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isDeleting}
              onClick={() => deletePolitician(politician.person_id, { onSuccess: () => setDeleteOpen(false) })}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PoliticianDetailProps {
  politician: Politician;
  timeline: FindingPerson[];
  timelineLoading: boolean;
  onBack?: () => void;
}

function PoliticianDetail({ politician, timeline, timelineLoading, onBack }: PoliticianDetailProps) {
  const name = politician.person?.name ?? '';
  const count = politician.finding_count ?? 0;
  const totalAmount = timeline.reduce((sum, fp) => sum + (fp.amount_usd ?? fp.finding?.amount_usd ?? 0), 0);

  const tenureLabel = (() => {
    const start = politician.tenure_start?.slice(0, 4);
    const end = politician.tenure_end?.slice(0, 4);
    if (start && end) return `${start} – ${end}`;
    if (start) return `Desde ${start}`;
    return null;
  })();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Mobile back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="md:hidden flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors -mt-1 mb-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Políticos
        </button>
      )}

      {/* Header card */}
      <div className="bg-dark-800 rounded-xl p-5 border border-dark-700">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {politician.photo_url ? (
              <img
                src={politician.photo_url}
                alt={name}
                className="w-20 h-20 rounded-full object-cover bg-dark-700"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-2xl font-bold text-blue-300">
                {getInitials(name)}
              </div>
            )}
            {politician.photo_source_url && (
              <a
                href={politician.photo_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors mt-1"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                {politician.photo_source_name ?? 'Wikipedia'}
              </a>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-white">{name}</h1>
                {politician.political_position && (
                  <p className="text-blue-400 font-medium mt-0.5">{politician.political_position}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm text-gray-400">
                  {count} {count === 1 ? 'caso' : 'casos'}
                </p>
                {totalAmount > 0 && (
                  <MoneyAmount amount={totalAmount} className="text-sm" />
                )}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-400">
              {politician.political_party && (
                <span className="bg-dark-700 px-2 py-0.5 rounded text-xs">
                  {politician.political_party}
                </span>
              )}
              {tenureLabel && (
                <span className="text-xs text-gray-500">{tenureLabel}</span>
              )}
            </div>
          </div>
        </div>

        {politician.person?.bio && (
          <div className="border-t border-dark-700 mt-4 pt-4">
            <p className="text-sm text-gray-400 leading-relaxed">{politician.person.bio}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">
          Historial de Casos
          {timeline.length > 0 && (
            <span className="text-gray-500 font-normal ml-2">({timeline.length})</span>
          )}
        </h2>

        {timelineLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-dark-800 rounded-xl p-4 space-y-2">
                <div className="h-4 bg-dark-700 rounded w-3/4" />
                <div className="h-3 bg-dark-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay casos registrados.</p>
        ) : (
          <div className="relative pl-4">
            <div className="absolute left-1.5 top-2 bottom-2 w-px bg-dark-700" />
            <div className="space-y-3">
              {timeline.map((fp) => {
                const finding = fp.finding;
                if (!finding) return null;
                const date = finding.date_occurred ?? finding.date_reported;
                const severityColor = SEVERITY_COLORS[finding.severity];

                return (
                  <div key={fp.id} className="relative flex gap-3">
                    <div
                      className="absolute -left-1 top-3 w-3 h-3 rounded-full border-2 border-dark-900 flex-shrink-0"
                      style={{ backgroundColor: severityColor }}
                    />
                    <div className="ml-4 flex-1">
                      {date && (
                        <p className="text-xs text-gray-600 mb-1">{formatDate(date)}</p>
                      )}
                      <Link
                        to={`/casos/${finding.id}`}
                        className="block bg-dark-800 border border-dark-700 rounded-xl p-3 hover:border-dark-500 transition-colors group"
                        style={{ borderLeftColor: severityColor, borderLeftWidth: 2 }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors line-clamp-2">
                            {finding.title}
                          </p>
                          <SeverityBadge severity={finding.severity} size="sm" />
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {fp.role_in_case && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0.5 border-dark-600 text-gray-400"
                            >
                              {fp.role_in_case}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0.5 border-dark-600 text-gray-400"
                          >
                            {finding.category}
                          </Badge>
                          {(fp.amount_usd ?? finding.amount_usd) != null && (
                            <MoneyAmount
                              amount={fp.amount_usd ?? finding.amount_usd}
                              className="text-xs"
                            />
                          )}
                        </div>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ListPanel({
  filters,
  onFiltersChange,
  politicians,
  isLoading,
  isAdmin,
  selectedPersonId,
  onSelect,
}: {
  filters: PoliticianFiltersType;
  onFiltersChange: (f: PoliticianFiltersType) => void;
  politicians: Politician[];
  isLoading: boolean;
  isAdmin: boolean;
  selectedPersonId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-dark-700">
        <h1 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <UserRoundCheck className="w-5 h-5 text-blue-400" />
          Políticos
        </h1>
        <PoliticianFilters filters={filters} onChange={onFiltersChange} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 px-3 py-2.5">
                <div className="w-9 h-9 rounded-full bg-dark-700 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-dark-700 rounded w-3/4" />
                  <div className="h-3 bg-dark-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : politicians.length === 0 ? (
          <div className="p-4 text-center text-gray-600 text-sm">
            No se encontraron políticos
          </div>
        ) : (
          politicians.map((p) => (
            <PoliticianItem
              key={p.id}
              politician={p}
              selected={p.person_id === selectedPersonId}
              isAdmin={isAdmin}
              onClick={() => onSelect(p.person_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function Politicos() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<PoliticianFiltersType>({
    search: searchParams.get('search') || '',
    position: searchParams.get('position') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  });

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(
    searchParams.get('persona'),
  );

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.position) params.position = filters.position;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (selectedPersonId) params.persona = selectedPersonId;
    setSearchParams(params, { replace: true });
  }, [filters, selectedPersonId, setSearchParams]);

  const { isAdmin } = useAuth();
  const { data: politicians = [], isLoading } = useListPoliticians(filters);
  const { data: timeline = [], isLoading: timelineLoading } = usePoliticianTimeline(selectedPersonId);

  const selectedPolitician = politicians.find((p) => p.person_id === selectedPersonId) ?? null;

  const handleSelect = (personId: string) => setSelectedPersonId(personId);
  const handleBack = () => setSelectedPersonId(null);

  // Mobile: two-screen flow — list OR detail
  // Desktop: sidebar + main split
  return (
    <div className="max-w-7xl mx-auto md:flex md:h-[calc(100vh-3.5rem)]">

      {/* Sidebar — always visible on desktop; hidden on mobile when detail is open */}
      <aside
        className={cn(
          'md:flex md:w-72 md:flex-shrink-0 md:border-r md:border-dark-700 md:flex-col md:overflow-hidden',
          // Mobile: fill full screen when no politician selected, hide when one is
          selectedPersonId
            ? 'hidden md:flex'
            : 'flex flex-col h-[calc(100vh-3.5rem)]'
        )}
      >
        <ListPanel
          filters={filters}
          onFiltersChange={setFilters}
          politicians={politicians}
          isLoading={isLoading}
          isAdmin={isAdmin}
          selectedPersonId={selectedPersonId}
          onSelect={handleSelect}
        />
      </aside>

      {/* Detail panel — hidden on mobile when no politician selected */}
      <main
        className={cn(
          'flex-1 md:overflow-y-auto',
          !selectedPersonId && 'hidden md:flex md:items-center md:justify-center'
        )}
      >
        {selectedPolitician ? (
          <PoliticianDetail
            politician={selectedPolitician}
            timeline={timeline}
            timelineLoading={timelineLoading}
            onBack={handleBack}
          />
        ) : (
          <div className="text-center px-6">
            <UserRoundCheck className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Selecciona un político</p>
            <p className="text-gray-600 text-sm mt-1">
              Elige un político de la lista para ver su historial de casos
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
