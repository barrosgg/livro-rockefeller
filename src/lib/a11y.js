import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Focus trap em um elemento. Tab/Shift+Tab fica preso dentro do container.
 * Restaura o foco ao elemento anterior ao desmontar.
 * Foca o primeiro item focável (ou o ref dado) ao abrir.
 */
export function useFocusTrap(active = true, initialFocusRef = null) {
  const containerRef = useRef(null);
  const previousActive = useRef(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previousActive.current = document.activeElement;

    const focusableEls = () =>
      Array.from(container.querySelectorAll(FOCUSABLE))
        .filter(el => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);

    // Foco inicial
    const target = initialFocusRef?.current || focusableEls()[0] || container;
    setTimeout(() => target.focus?.(), 50);

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const els = focusableEls();
      if (els.length === 0) { e.preventDefault(); return; }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    container.addEventListener('keydown', onKey);

    return () => {
      container.removeEventListener('keydown', onKey);
      // Restaura foco se ainda existir
      const prev = previousActive.current;
      if (prev && typeof prev.focus === 'function' && document.body.contains(prev)) {
        setTimeout(() => prev.focus(), 0);
      }
    };
  }, [active, initialFocusRef]);

  return containerRef;
}
