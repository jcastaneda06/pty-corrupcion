import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, Plus, Users } from 'lucide-react';
import { type Finding, type Reaction } from '../../types';
import { SeverityBadge } from '@/components/app/SeverityBadge';
import { EmojiPickerPortal } from '@/components/app/EmojiPickerPortal';

import { formatDate, formatMoney, truncate, SEVERITY_COLORS } from '../../lib/utils';
import { useAddReaction, useRemoveReaction } from '../../hooks/useFindingComments';
import { useAuth } from '../../contexts/AuthContext';

function groupReactions(reactions: Reaction[]): [string, number][] {
  const map: Record<string, number> = {};
  for (const r of reactions) {
    map[r.emoji] = (map[r.emoji] ?? 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

interface Props {
  finding: Finding;
}

export function FindingCard({ finding }: Props) {
  const { user, openAuthModal } = useAuth();
  const people = finding.people ?? [];
  const totalPeople = people.length;
  const convicted = people.filter((fp) => fp.is_convicted).length;
  const grouped = groupReactions(finding.reactions ?? []);

  const myReactions = (finding.reactions ?? []).filter((r) => r.user_id === user?.id);
  const myReactionEmojis = new Set(myReactions.map((r) => r.emoji));

  const [showPicker, setShowPicker] = useState(false);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();

  const doReaction = (emoji: string) => {
    if (!user) { openAuthModal(); return; }
    if (myReactionEmojis.has(emoji)) {
      removeReaction.mutate({ findingId: finding.id, emoji, userId: user.id });
      return;
    }
    if (myReactions.length >= 3) {
      const oldest = [...myReactions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      removeReaction.mutateAsync({ findingId: finding.id, emoji: oldest.emoji, userId: user.id })
        .then(() => addReaction.mutate({ findingId: finding.id, emoji, userId: user.id }));
      return;
    }
    addReaction.mutate({ findingId: finding.id, emoji, userId: user.id });
  };

  const handleReaction = (e: React.MouseEvent, emoji: string) => {
    e.preventDefault();
    e.stopPropagation();
    doReaction(emoji);
  };

  const handlePickerSelect = (emoji: string) => {
    doReaction(emoji);
    setShowPicker(false);
  };

  const togglePicker = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { openAuthModal(); return; }
    setShowPicker((v) => !v);
  };

  return (
    <Link
      to={`/casos/${finding.id}`}
      className="group block md:h-full"
    >
      <div
        className="px-4 py-3 flex flex-col md:p-5 md:bg-dark-800 md:border md:border-dark-600 md:rounded-xl md:hover:border-dark-500 md:hover:shadow-lg md:hover:shadow-black/30 md:h-full transition-all"
        style={{ borderLeftColor: SEVERITY_COLORS[finding.severity], borderLeftWidth: 3 }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-case-title text-sm leading-snug group-hover:text-blue-300 transition-colors line-clamp-2 md:min-h-[2.5rem]">
            {finding.title}
          </h3>
          <SeverityBadge severity={finding.severity} size="sm" />
        </div>

        <p className="text-gray-400 text-xs leading-relaxed mb-4 line-clamp-3 md:min-h-[3.75rem]">
          {finding.summary}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 mt-auto">
          {finding.amount_usd && (
            <span className="flex items-center gap-1 text-emerald-400 font-mono font-semibold">
              {formatMoney(finding.amount_usd)}
            </span>
          )}
          {(finding.sources?.[0]?.published_at ?? finding.date_occurred ?? finding.date_reported) && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(finding.sources?.[0]?.published_at ?? finding.date_occurred ?? finding.date_reported ?? '')}
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

        {/* Reactions — Discord style */}
        <div
          className="mt-2.5 flex flex-wrap items-center gap-1.5 min-h-[1.75rem]"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {grouped.map(([emoji, count]) => {
            const mine = myReactionEmojis.has(emoji);
            return (
              <button
                key={emoji}
                onClick={(e) => handleReaction(e, emoji)}
                title={mine ? 'Quitar reacción' : undefined}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  mine
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-200 hover:bg-blue-500/30'
                    : 'bg-dark-700 border-dark-600 hover:bg-dark-600 hover:border-blue-500/50 text-gray-300'
                }`}
              >
                <span>{emoji}</span>
                <span className={`font-mono ${mine ? 'text-blue-300' : 'text-gray-400'}`}>{count}</span>
              </button>
            );
          })}

          <button
            ref={pickerBtnRef}
            onClick={togglePicker}
            title="Añadir reacción"
            className="flex items-center gap-0.5 px-2 py-0.5 bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-blue-500/50 rounded-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {showPicker && (
          <EmojiPickerPortal
            anchor={pickerBtnRef.current}
            onSelect={handlePickerSelect}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </Link>
  );
}
