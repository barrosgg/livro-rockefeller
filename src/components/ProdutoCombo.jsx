import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { fmt } from '../lib/calc.js';

const ORDEM_CATEGORIAS = [
  'Frutas, Grãos & Vegetais',
  'Laticínios',
  'Animais & Insumos',
  'Especiarias & Outros',
  'Matérias-primas',
  'Sacos',
];

/**
 * Combobox de produto:
 * - busca livre + dropdown agrupado por categoria
 * - ↑↓ navega, Enter seleciona, Esc fecha
 * - ref expõe { focus(), clear() } para o parent
 */
const ProdutoCombo = forwardRef(function ProdutoCombo({ produtos, value, onSelect, onEnterEmpty, placeholder = 'Buscar produto…' }, ref) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => { setQ(''); setOpen(false); setActiveIdx(0); },
  }), []);

  useEffect(() => {
    const onDocClick = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Lista plana filtrada (para navegação por índice)
  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term ? produtos.filter(p => p.nome.toLowerCase().includes(term)) : produtos;
    return base;
  }, [q, produtos]);

  // Lista plana ordenada por categoria, para renderização
  const flatOrdered = useMemo(() => {
    const map = new Map();
    for (const p of filtrados) {
      if (!map.has(p.categoria)) map.set(p.categoria, []);
      map.get(p.categoria).push(p);
    }
    const result = [];
    for (const cat of ORDEM_CATEGORIAS) {
      const arr = map.get(cat);
      if (arr?.length) {
        result.push({ type: 'group', cat });
        for (const p of arr) result.push({ type: 'item', p });
      }
    }
    return result;
  }, [filtrados]);

  // Apenas os items (sem headers) — para activeIdx ser sobre itens
  const itemsOnly = useMemo(() => flatOrdered.filter(x => x.type === 'item').map(x => x.p), [flatOrdered]);

  // Auto-scroll para o item ativo
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  // Reset do activeIdx quando muda a busca
  useEffect(() => { setActiveIdx(0); }, [q]);

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx(i => Math.min(itemsOnly.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (itemsOnly.length > 0) {
        const p = itemsOnly[activeIdx] || itemsOnly[0];
        onSelect?.(p);
        setQ('');
        setOpen(false);
      } else {
        onEnterEmpty?.();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      e.target.blur();
    }
  };

  return (
    <div className="combo" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        value={value ? value.nome : q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); onSelect?.(null); setOpen(true); }}
        onKeyDown={handleKey}
      />
      {open && (
        <div className="combo-list" ref={listRef}>
          {flatOrdered.length === 0 ? (
            <div className="opt muted">Nenhum produto encontrado.</div>
          ) : (() => {
            let itemIdx = -1;
            return flatOrdered.map((row, i) => {
              if (row.type === 'group') {
                return <div key={`g-${row.cat}`} className="group-label">{row.cat}</div>;
              }
              itemIdx += 1;
              const isActive = itemIdx === activeIdx;
              const p = row.p;
              const myIdx = itemIdx;
              return (
                <div key={p.id} data-idx={myIdx}
                     className={`opt ${isActive ? 'active' : ''}`}
                     onMouseEnter={() => setActiveIdx(myIdx)}
                     onClick={() => { onSelect?.(p); setQ(''); setOpen(false); }}>
                  <span>{p.nome}</span>
                  <span className="price">{fmt(p.preco_min)}–{fmt(p.preco_max)}</span>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
});

export default ProdutoCombo;
