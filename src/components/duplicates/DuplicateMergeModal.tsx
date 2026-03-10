import { useState, useEffect, useRef } from 'react';
import { ArrowLeftRight, AlertTriangle, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SeverityBadge } from '@/components/app/SeverityBadge';
import { useSearchFindings, useSearchPoliticians, useMergeDuplicate } from '../../hooks/useDuplicateSearch';
import {
  scoreFinding,
  scorePerson,
  FINDING_THRESHOLD,
  PERSON_THRESHOLD,
} from '../../lib/duplicateScore';
import { getInitials } from '../../lib/utils';
import type { Finding, Politician } from '../../types';

type Props =
  | { type: 'finding'; subject: Finding; open: boolean; onClose: () => void }
  | { type: 'person'; subject: Politician; open: boolean; onClose: () => void };

// ── Finding cards ─────────────────────────────────────────────────────────────

function FindingCard({ finding, label }: { finding: Finding; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-lg p-3 space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <p className={`text-xs font-semibold uppercase tracking-wide ${label === 'SE ELIMINA' ? 'text-red-400' : 'text-emerald-400'}`}>{label}</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(v => !v); }}
            className="p-0.5 text-gray-500 hover:text-blue-400 transition-colors"
            title={expanded ? 'Ocultar resumen' : 'Ver resumen'}
          >
            {expanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white line-clamp-2">{finding.title}</p>
        <SeverityBadge severity={finding.severity} size="sm" />
      </div>
      <p className={`text-xs text-gray-500 ${expanded ? '' : 'line-clamp-2'}`}>{finding.summary}</p>
      <p className="text-xs text-gray-600">{finding.category}</p>
    </div>
  );
}

// ── Politician cards ──────────────────────────────────────────────────────────

function PersonCard({ politician, label }: { politician: Politician; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  const name = politician.person?.name ?? '';
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-lg p-3 space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <p className={`text-xs font-semibold uppercase tracking-wide ${label === 'SE ELIMINA' ? 'text-red-400' : 'text-emerald-400'}`}>{label}</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(v => !v); }}
            className="p-0.5 text-gray-500 hover:text-blue-400 transition-colors flex-shrink-0"
            title={expanded ? 'Ocultar info' : 'Ver info'}
          >
            {expanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        {politician.photo_url ? (
          <img
            src={politician.photo_url}
            alt={name}
            className="w-8 h-8 rounded-full object-cover bg-dark-600 flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">
            {getInitials(name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <p className="text-xs text-blue-400 truncate">{politician.political_position}</p>
        </div>
      </div>
      {politician.political_party && (
        <p className="text-xs text-gray-600">{politician.political_party}</p>
      )}
      {expanded && (
        <div className="text-xs text-gray-500 space-y-0.5 border-t border-dark-600 pt-1.5">
          {politician.political_position && <p><span className="text-gray-600">Cargo:</span> {politician.political_position}</p>}
          {politician.tenure_start && <p><span className="text-gray-600">Mandato:</span> {politician.tenure_start}{politician.tenure_end ? ` – ${politician.tenure_end}` : ' – presente'}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function DuplicateMergeModal({ type, subject, open, onClose }: Props) {
  const [step, setStep] = useState<'search' | 'confirm'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<Finding | Politician | null>(null);
  // winner: true = subject wins, false = selected wins
  const [subjectIsWinner, setSubjectIsWinner] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const merge = useMergeDuplicate();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const subjectId = type === 'finding'
    ? (subject as Finding).id
    : (subject as Politician).person_id;

  const { data: findingResults = [], isFetching: findingsFetching } = useSearchFindings(
    type === 'finding' ? debouncedQuery : ''
  );
  const { data: personResults = [], isFetching: personsFetching } = useSearchPoliticians(
    type === 'person' ? debouncedQuery : ''
  );

  const isFetching = type === 'finding' ? findingsFetching : personsFetching;

  const filteredFindings = findingResults.filter((f) => f.id !== subjectId);
  const filteredPersons = personResults.filter((p) => p.person_id !== subjectId);

  // Score computation
  const score = (() => {
    if (!selected) return null;
    if (type === 'finding') {
      return scoreFinding(subject as Finding, selected as Finding);
    }
    return scorePerson(subject as Politician, selected as Politician);
  })();

  const threshold = type === 'finding' ? FINDING_THRESHOLD : PERSON_THRESHOLD;
  const scoreOk = score !== null && score.total >= threshold;

  const winner = subjectIsWinner ? subject : selected;
  const loser = subjectIsWinner ? selected : subject;

  const winnerId = winner
    ? type === 'finding'
      ? (winner as Finding).id
      : (winner as Politician).person_id
    : null;
  const loserId = loser
    ? type === 'finding'
      ? (loser as Finding).id
      : (loser as Politician).person_id
    : null;

  const handleConfirm = async () => {
    if (!winnerId || !loserId) return;
    setError(null);
    try {
      await merge.mutateAsync({
        type,
        winner_id: winnerId,
        loser_id: loserId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al fusionar');
    }
  };

  const handleSelectResult = (item: Finding | Politician) => {
    setSelected(item);
    setSubjectIsWinner(true); // default: subject wins
    setStep('confirm');
  };

  const handleBack = () => {
    setStep('search');
    setSelected(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
          className="bg-dark-900 border-dark-700 text-white w-full max-w-2xl sm:rounded-lg rounded-none h-full sm:h-auto overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-orange-400" />
            {step === 'search' ? 'Marcar como duplicado' : 'Confirmar fusión'}
          </DialogTitle>
        </DialogHeader>

        {step === 'search' ? (
          <div className="space-y-4">
            {/* Subject preview */}
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {type === 'finding' ? 'Caso marcado' : 'Político marcado'}:
              </p>
              {type === 'finding' ? (
                <FindingCard finding={subject as Finding} />
              ) : (
                <PersonCard politician={subject as Politician} />
              )}
            </div>

            {/* Search */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">
                Buscar el {type === 'finding' ? 'caso' : 'político'} duplicado:
              </p>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={type === 'finding' ? 'Buscar por título...' : 'Buscar por nombre...'}
                autoFocus
                className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Results */}
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {isFetching && debouncedQuery.length > 1 && (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Buscando...
                </div>
              )}

              {!isFetching && debouncedQuery.length > 1 && type === 'finding' && (
                filteredFindings.length === 0 ? (
                  <p className="text-gray-600 text-sm py-2">No se encontraron casos.</p>
                ) : (
                  filteredFindings.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleSelectResult(f)}
                      className="w-full text-left hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <FindingCard finding={f} />
                    </button>
                  ))
                )
              )}

              {!isFetching && debouncedQuery.length > 1 && type === 'person' && (
                filteredPersons.length === 0 ? (
                  <p className="text-gray-600 text-sm py-2">No se encontraron políticos.</p>
                ) : (
                  filteredPersons.map((p) => (
                    <button
                      key={p.person_id}
                      onClick={() => handleSelectResult(p)}
                      className="w-full text-left hover:bg-dark-700 rounded-lg transition-colors"
                    >
                      <PersonCard politician={p} />
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Confirm */
          <div className="space-y-4">
            {/* Score breakdown */}
            <div className={`rounded-lg p-3 border ${scoreOk ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                {scoreOk ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <p className={`text-sm font-medium ${scoreOk ? 'text-emerald-300' : 'text-red-300'}`}>
                  {scoreOk
                    ? `Similitud suficiente (${score?.total} tokens compartidos)`
                    : `Similitud insuficiente para fusionar (${score?.total ?? 0}/${threshold} mínimo)`}
                </p>
              </div>
              {score && (
                <div className="text-xs text-gray-500 space-y-0.5 ml-6">
                  {type === 'finding' && 'titleScore' in score && (
                    <>
                      <p>{score.titleScore} palabras compartidas en título</p>
                      <p>{score.summaryScore} palabras compartidas en resumen</p>
                    </>
                  )}
                  {type === 'person' && 'nameScore' in score && (
                    <>
                      <p>{score.nameScore} tokens en nombre</p>
                      <p>{score.positionScore} tokens en cargo</p>
                      <p>{score.partyScore} tokens en partido</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Winner toggle */}
            <div>
              <p className="text-xs text-gray-500 mb-2">¿Cuál se mantiene (absorbe al otro)?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="winner"
                    className="sr-only"
                    checked={subjectIsWinner}
                    onChange={() => setSubjectIsWinner(true)}
                  />
                  <div className={`rounded-lg border-2 transition-colors ${subjectIsWinner ? 'border-emerald-500' : 'border-red-500/60'}`}>
                    {type === 'finding' ? (
                      <FindingCard finding={subject as Finding} label={subjectIsWinner ? 'SE MANTIENE' : 'SE ELIMINA'} />
                    ) : (
                      <PersonCard politician={subject as Politician} label={subjectIsWinner ? 'SE MANTIENE' : 'SE ELIMINA'} />
                    )}
                  </div>
                </label>

                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="winner"
                    className="sr-only"
                    checked={!subjectIsWinner}
                    onChange={() => setSubjectIsWinner(false)}
                  />
                  <div className={`rounded-lg border-2 transition-colors ${!subjectIsWinner ? 'border-emerald-500' : 'border-red-500/60'}`}>
                    {type === 'finding' ? (
                      <FindingCard finding={selected as Finding} label={!subjectIsWinner ? 'SE MANTIENE' : 'SE ELIMINA'} />
                    ) : (
                      <PersonCard politician={selected as Politician} label={!subjectIsWinner ? 'SE MANTIENE' : 'SE ELIMINA'} />
                    )}
                  </div>
                </label>
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">
                El {type === 'finding' ? 'caso' : 'político'} no seleccionado será eliminado permanentemente.
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={handleBack}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Atrás
              </button>
              <button
                onClick={handleConfirm}
                disabled={!scoreOk || merge.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {merge.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar fusión
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
