import { lazy, Suspense, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface Props {
  anchor: HTMLElement | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const PICKER_WIDTH = 320;
const PICKER_HEIGHT = 400;

export function EmojiPickerPortal({ anchor, onSelect, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        anchor &&
        !anchor.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [anchor, onClose]);

  if (!anchor) return null;

  const rect = anchor.getBoundingClientRect();
  let top = rect.bottom + window.scrollY + 6;
  let left = rect.left + window.scrollX;

  if (left + PICKER_WIDTH > window.innerWidth - 8) {
    left = window.innerWidth - PICKER_WIDTH - 8;
  }
  if (rect.bottom + PICKER_HEIGHT + 6 > window.innerHeight) {
    top = rect.top + window.scrollY - PICKER_HEIGHT - 6;
  }

  return createPortal(
    <div
      ref={containerRef}
      style={{ position: 'absolute', top, left, zIndex: 9999 }}
      // Stop React synthetic event bubbling — portals propagate through the
      // React tree, so without this, clicks reach any <Link> ancestor.
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Suspense fallback={
        <div
          style={{ width: PICKER_WIDTH, height: PICKER_HEIGHT }}
          className="bg-dark-800 border border-dark-600 rounded-xl flex items-center justify-center text-sm text-gray-500"
        >
          Cargando…
        </div>
      }>
        <EmojiPicker
          theme={"dark" as "dark"}
          onEmojiClick={(data) => onSelect(data.emoji)}
          width={PICKER_WIDTH}
          height={PICKER_HEIGHT}
          searchPlaceholder="Buscar emoji…"
        />
      </Suspense>
    </div>,
    document.body,
  );
}
