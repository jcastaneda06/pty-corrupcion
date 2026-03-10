import { useState } from 'react';
import { GitMerge } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '../../contexts/AuthContext';
import { DuplicateMergeModal } from './DuplicateMergeModal';
import type { Finding, Politician } from '../../types';

interface FindingButtonProps {
  type: 'finding';
  subject: Finding;
}

interface PersonButtonProps {
  type: 'person';
  subject: Politician;
}

type Props = FindingButtonProps | PersonButtonProps;

export function MarkDuplicateButton(props: Props) {
  const { user, openAuthModal } = useAuth();
  const [open, setOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      openAuthModal();
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleClick}
              className="flex items-center justify-center w-6 h-6 rounded text-gray-500 hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
              aria-label="Marcar como duplicado"
            >
              <GitMerge className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Marcar como duplicado</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {open && props.type === 'finding' && (
        <DuplicateMergeModal
          type="finding"
          subject={props.subject}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
      {open && props.type === 'person' && (
        <DuplicateMergeModal
          type="person"
          subject={props.subject}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
