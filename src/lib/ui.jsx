/* Sistema global de Toast + ConfirmDialog. */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useFocusTrap } from './a11y.js';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null); // { msg, onConfirm, onCancel, danger }

  const showToast = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const dur = opts.duration ?? 3000;
    setToasts((arr) => [...arr, { id, msg, type: opts.type || 'info' }]);
    if (dur > 0) {
      setTimeout(() => setToasts((arr) => arr.filter(t => t.id !== id)), dur);
    }
    return id;
  }, []);

  const dismissToast = (id) => setToasts((arr) => arr.filter(t => t.id !== id));

  /** Confirmação modal. Retorna Promise<boolean>. */
  const confirmar = useCallback((msg, opts = {}) => {
    return new Promise((resolve) => {
      setConfirm({
        msg,
        title: opts.title || 'Confirmação',
        confirmLabel: opts.confirmLabel || 'Confirmar',
        cancelLabel: opts.cancelLabel || 'Cancelar',
        danger: opts.danger ?? false,
        onConfirm: () => { setConfirm(null); resolve(true); },
        onCancel:  () => { setConfirm(null); resolve(false); },
      });
    });
  }, []);

  /* Esc fecha o confirm */
  useEffect(() => {
    if (!confirm) return;
    const onKey = (e) => { if (e.key === 'Escape') confirm.onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm]);

  return (
    <UIContext.Provider value={{ showToast, confirmar }}>
      {children}

      {/* Toasts empilhados */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id}
            className={`toast-item ${t.type}`}
            role="status"
            aria-live="polite"
            onClick={() => dismissToast(t.id)}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Modal de confirmação */}
      {confirm && <ConfirmModal confirm={confirm} />}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
export const useToast = () => useContext(UIContext)?.showToast;
export const useConfirm = () => useContext(UIContext)?.confirmar;

function ConfirmModal({ confirm }) {
  const modalRef = useFocusTrap(true);
  return (
    <div className="confirm-backdrop" onClick={confirm.onCancel} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-modal" ref={modalRef} onClick={e => e.stopPropagation()}>
        <h3 id="confirm-title" className="mt-0">{confirm.title}</h3>
        <p className="confirm-msg">{confirm.msg}</p>
        <div className="flex gap-1 mt-2" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={confirm.onCancel}>
            {confirm.cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${confirm.danger ? 'danger' : ''}`}
            onClick={confirm.onConfirm}>
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
