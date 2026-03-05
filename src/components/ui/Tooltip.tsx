import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const OFFSET = 8;

export function Tooltip({ content, children, side = 'top', delay = 200 }: Props) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => {
    if (!visible || !anchorRef.current || !tooltipRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    const scroll = { x: window.scrollX, y: window.scrollY };

    let top = 0;
    let left = 0;

    if (side === 'top') {
      top = rect.top + scroll.y - tip.height - OFFSET;
      left = rect.left + scroll.x + rect.width / 2 - tip.width / 2;
    } else if (side === 'bottom') {
      top = rect.bottom + scroll.y + OFFSET;
      left = rect.left + scroll.x + rect.width / 2 - tip.width / 2;
    } else if (side === 'left') {
      top = rect.top + scroll.y + rect.height / 2 - tip.height / 2;
      left = rect.left + scroll.x - tip.width - OFFSET;
    } else {
      top = rect.top + scroll.y + rect.height / 2 - tip.height / 2;
      left = rect.right + scroll.x + OFFSET;
    }

    // Keep within viewport horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8));

    setPos({ top, left });
  }, [visible, side]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const child = children as React.ReactElement<{
    ref?: React.Ref<HTMLElement>;
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
  }>;

  const trigger = {
    ...child,
    props: {
      ...child.props,
      ref: anchorRef,
      onMouseEnter: (e: React.MouseEvent) => { show(); child.props.onMouseEnter?.(e); },
      onMouseLeave: (e: React.MouseEvent) => { hide(); child.props.onMouseLeave?.(e); },
      onFocus:      (e: React.FocusEvent) => { show(); child.props.onFocus?.(e); },
      onBlur:       (e: React.FocusEvent) => { hide(); child.props.onBlur?.(e); },
    },
  };

  return (
    <>
      {trigger}
      {visible && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="pointer-events-none max-w-xs rounded-lg bg-dark-700 border border-dark-500 px-2.5 py-1.5 text-xs text-gray-200 shadow-xl shadow-black/40 animate-fade-in"
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
