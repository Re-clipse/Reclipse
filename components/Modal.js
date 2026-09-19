'use client';

import { useEffect, useRef } from 'react';

/**
 * Accessible modal: labelled dialog, closes on Escape or backdrop click,
 * traps Tab focus inside, restores focus to the trigger on close, and locks
 * body scroll while open.
 */
export default function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    restoreTo.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element inside.
    const focusables = () =>
      ref.current?.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ) || [];
    setTimeout(() => focusables()[0]?.focus(), 0);

    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') {
        const f = Array.from(focusables());
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}
           ref={ref} onClick={(e) => e.stopPropagation()}>
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
