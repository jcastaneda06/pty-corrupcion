import { useRef, useState } from 'react';
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
  MessageSquare,
  Send,
  Plus,
  LogIn,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFinding, useFindingRelationships } from '../hooks/useFinding';
import { useAddFindingComment, useAddReaction, useRemoveReaction } from '../hooks/useFindingComments';
import { RelationshipMap } from '../components/findings/RelationshipMap';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { EmojiPickerPortal } from '../components/ui/EmojiPickerPortal';
import { MoneyAmount } from '../components/ui/MoneyAmount';
import { PersonChip } from '../components/ui/PersonChip';
import { Skeleton } from '../components/ui/Skeleton';
import { formatDate, getInitials, SEVERITY_COLORS } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { type Reaction } from '../types';

function groupReactions(reactions: Reaction[]): [string, number][] {
  const map: Record<string, number> = {};
  for (const r of reactions) {
    map[r.emoji] = (map[r.emoji] ?? 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function FindingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, openAuthModal } = useAuth();
  const { data: finding, isLoading, error } = useFinding(id!);
  const { data: relationships = [] } = useFindingRelationships(id!);
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();
  const addComment = useAddFindingComment(id!);

  const [showPicker, setShowPicker] = useState(false);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const [content, setContent] = useState('');

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
  const reactions = finding.reactions ?? [];
  const comments = finding.finding_comments ?? [];
  const grouped = groupReactions(reactions);
  const severityColor = SEVERITY_COLORS[finding.severity];

  const myReactionEmojis = new Set(
    reactions.filter((r) => r.user_id === user?.id).map((r) => r.emoji)
  );

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'Usuario';

  const handleReaction = (emoji: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (myReactionEmojis.has(emoji)) {
      removeReaction.mutate({ findingId: finding.id, emoji, userId: user.id });
    } else {
      addReaction.mutate({ findingId: finding.id, emoji, userId: user.id });
    }
    setShowPicker(false);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim()) return;
    await addComment.mutateAsync({
      user_id: user.id,
      author_name: displayName,
      author_email: user.email ?? '',
      content: content.trim(),
    });
    setContent('');
  };

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

      {/* Reactions */}
      <section className="bg-dark-800 border border-dark-600 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          {grouped.map(([emoji, count]) => {
            const mine = myReactionEmojis.has(emoji);
            return (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                title={mine ? 'Quitar reacción' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border transition-colors ${
                  mine
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-200 hover:bg-blue-500/30'
                    : 'bg-dark-700 border-dark-600 hover:bg-dark-600 hover:border-blue-500/50 text-gray-300'
                }`}
              >
                <span>{emoji}</span>
                <span className={`font-mono text-xs ${mine ? 'text-blue-300' : 'text-gray-400'}`}>{count}</span>
              </button>
            );
          })}

          <button
            ref={pickerBtnRef}
            onClick={() => {
              if (!user) { openAuthModal(); return; }
              setShowPicker((v) => !v);
            }}
            className="flex items-center gap-1 px-3 py-1 bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-blue-500/50 rounded-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs">Reaccionar</span>
          </button>
        </div>

        {showPicker && (
          <EmojiPickerPortal
            anchor={pickerBtnRef.current}
            onSelect={handleReaction}
            onClose={() => setShowPicker(false)}
          />
        )}
      </section>

      {/* Comments */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          Comentarios
          {comments.length > 0 && (
            <span className="text-sm font-normal text-gray-500">({comments.length})</span>
          )}
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          Comparte información, correcciones o contexto sobre este caso.
        </p>

        {/* Comment form or login banner */}
        {user ? (
          <form
            onSubmit={handleCommentSubmit}
            className="bg-dark-800 border border-dark-700 rounded-xl p-5 space-y-3 mb-6"
          >
            <p className="text-xs text-gray-500">
              Comentando como{' '}
              <span className="font-semibold text-gray-300">{displayName}</span>
              {user.email && (
                <span className="text-gray-600"> · {user.email}</span>
              )}
            </p>
            <textarea
              placeholder="Escribe un comentario…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={2000}
              required
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">{content.length}/2000</span>
              <button
                type="submit"
                disabled={addComment.isPending || !content.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {addComment.isPending ? 'Enviando…' : 'Publicar'}
              </button>
            </div>
            {addComment.isError && (
              <p className="text-xs text-red-400">Error al publicar. Intenta de nuevo.</p>
            )}
          </form>
        ) : (
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-400">Inicia sesión para comentar.</p>
            <button
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors shrink-0"
            >
              <LogIn className="w-4 h-4" />
              Iniciar sesión
            </button>
          </div>
        )}

        {/* Comment list — newest first */}
        {comments.length > 0 ? (
          <div className="space-y-3">
            {[...comments]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((c) => (
                <div key={c.id} className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-300">
                    {getInitials(c.author_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">{c.author_name}</span>
                      <span className="text-xs text-gray-600">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-600">
            <MessageSquare className="w-7 h-7 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sé el primero en comentar.</p>
          </div>
        )}
      </section>
    </main>
  );
}
