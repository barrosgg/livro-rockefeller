import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useLocalStorage } from '../lib/storage.js';
import { fmt, clamp } from '../lib/calc.js';

const ORDEM_CATEGORIAS = [
  'Frutas, Grãos & Vegetais',
  'Laticínios',
  'Animais & Insumos',
  'Especiarias & Outros',
  'Matérias-primas',
  'Sacos',
];

function novoNumero() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/* ----- Combobox: busca + dropdown agrupado por categoria ----- */
function ProdutoCombo({ produtos, value, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return produtos;
    return produtos.filter(p => p.nome.toLowerCase().includes(term));
  }, [q, produtos]);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const p of filtrados) {
      if (!map.has(p.categoria)) map.set(p.categoria, []);
      map.get(p.categoria).push(p);
    }
    return ORDEM_CATEGORIAS
      .map(cat => [cat, map.get(cat) || []])
      .filter(([, arr]) => arr.length > 0);
  }, [filtrados]);

  return (
    <div className="combo" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        value={value ? value.nome : q}
        placeholder="Buscar ou abrir lista…"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); onSelect(null); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      />
      {open && (
        <div className="combo-list">
          {grupos.length === 0 ? (
            <div className="opt muted">Nenhum produto.</div>
          ) : grupos.map(([cat, arr]) => (
            <div key={cat}>
              <div className="group-label">{cat}</div>
              {arr.map(p => (
                <div key={p.id} className={`opt ${value?.id === p.id ? 'active' : ''}`}
                     onClick={() => { onSelect(p); setQ(''); setOpen(false); }}>
                  <span>{p.nome}</span>
                  <span className="price">{fmt(p.preco_min)}–{fmt(p.preco_max)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NovoPedido() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [produtos, setProdutos] = useState([]);
  const [selProd, setSelProd] = useState(null);
  const [qtd, setQtd] = useState(50);

  /* Draft persistente em localStorage — sobrevive ao F5 / abandono de aba */
  const [draft, setDraft, limparDraft] = useLocalStorage('draft:pedido:novo', () => ({
    itens: [],
    cliente: '',
    anotacoes: '',
    descontoPct: 0,
    prazo: '',
    numero: novoNumero(),
  }));
  // Aliases para legibilidade
  const itens = draft.itens || [];
  const setItens = (next) => setDraft(d => ({ ...d, itens: typeof next === 'function' ? next(d.itens || []) : next }));
  const cliente = draft.cliente || '';
  const setCliente = (v) => setDraft(d => ({ ...d, cliente: v }));
  const anotacoes = draft.anotacoes || '';
  const setAnotacoes = (v) => setDraft(d => ({ ...d, anotacoes: v }));
  const descontoPct = Number(draft.descontoPct || 0);
  const setDescontoPct = (v) => setDraft(d => ({ ...d, descontoPct: v }));
  const prazo = draft.prazo || '';
  const setPrazo = (v) => setDraft(d => ({ ...d, prazo: v }));
  const numero = draft.numero;

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    supabase.from('products').select('*').order('nome').then(({ data, error }) => {
      if (error) setErro(error.message);
      else setProdutos(data || []);
    });
  }, []);

  const adicionar = () => {
    if (!selProd || qtd <= 0) return;
    // Default: ponto médio entre min e max
    const preco_unit = Number(((selProd.preco_min + selProd.preco_max) / 2).toFixed(2));
    setItens((arr) => {
      const idx = arr.findIndex(i => i.product.id === selProd.id);
      if (idx >= 0) {
        const copy = [...arr];
        copy[idx] = { ...copy[idx], quantidade: copy[idx].quantidade + qtd };
        return copy;
      }
      return [...arr, { product: selProd, quantidade: qtd, preco_unit }];
    });
    setSelProd(null); setQtd(50);
  };

  const setItem = (i, patch) => setItens((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const remover = (i) => setItens((arr) => arr.filter((_, idx) => idx !== i));

  /* ---- Cálculos com desconto capado pela margem ---- */
  const calc = useMemo(() => {
    const subtotal = itens.reduce((a, it) => a + it.preco_unit * it.quantidade, 0);
    const subtotalNoMin = itens.reduce((a, it) => a + it.product.preco_min * it.quantidade, 0);
    // Margem máxima que pode virar desconto sem ficar abaixo do mínimo:
    const margemMaxAbs = Math.max(0, subtotal - subtotalNoMin);
    const descontoMaxPct = subtotal > 0 ? (margemMaxAbs / subtotal) * 100 : 0;
    const pctEfetivo = Math.min(descontoPct, descontoMaxPct);
    const descAbs = subtotal * (pctEfetivo / 100);
    return {
      subtotal,
      subtotalNoMin,
      descontoMaxPct,
      pctEfetivo,
      descAbs,
      total: subtotal - descAbs,
      extrapolado: descontoPct > descontoMaxPct + 0.001,
    };
  }, [itens, descontoPct]);

  const salvar = async (status) => {
    setErro(null);
    if (itens.length === 0) { setErro('Adicione ao menos 1 item.'); return; }
    if (status === 'aprovado' && !prazo) { setErro('Defina o prazo de entrega para aprovar.'); return; }
    setSalvando(true);

    const { data: order, error: e1 } = await supabase.from('orders').insert({
      numero_nota: numero,
      cliente: cliente || null,
      anotacoes: anotacoes || null,
      desconto_pct: calc.pctEfetivo, // usa o efetivo (capado)
      status,
      prazo_entrega: prazo ? new Date(prazo).toISOString() : null,
      criado_por: user.id,
      aprovado_por: status === 'aprovado' ? user.id : null,
      aprovado_em: status === 'aprovado' ? new Date().toISOString() : null,
    }).select().single();

    if (e1) { setErro(e1.message); setSalvando(false); return; }

    const payload = itens.map(i => ({
      order_id: order.id,
      product_id: i.product.id,
      quantidade: i.quantidade,
      preco_unit: i.preco_unit,
    }));
    const { error: e2 } = await supabase.from('order_items').insert(payload);
    setSalvando(false);
    if (e2) { setErro(e2.message); return; }
    limparDraft();          // limpa rascunho ao salvar com sucesso
    navigate(`/pedidos/${order.id}`);
  };

  const temDraft = itens.length > 0 || cliente || anotacoes || descontoPct > 0 || prazo;

  return (
    <div className="page">
      <div className="flex between center-y wrap gap-2">
        <div>
          <h1 className="mt-0">Novo Pedido</h1>
          <p className="muted small mt-0">
            Monte o orçamento. Ao aprovar, vai para produção e os trabalhadores podem assumir.
            {temDraft && <> · <em>Rascunho salvo automaticamente.</em></>}
          </p>
        </div>
        <div className="flex gap-1 center-y">
          <span className="seal">Nota Nº {numero}</span>
          {temDraft && (
            <button className="btn ghost sm" onClick={() => {
              if (confirm('Descartar o rascunho atual?')) limparDraft();
            }}>Descartar rascunho</button>
          )}
        </div>
      </div>
      <div className="divider" />

      <div className="row">
        {/* ---------- Lado esquerdo: adicionar item ---------- */}
        <section className="card" style={{ flex: '1 1 340px' }}>
          <h3>Adicionar Item</h3>
          <div className="field">
            <label>Produto</label>
            <ProdutoCombo produtos={produtos} value={selProd} onSelect={setSelProd} />
            {selProd && <div className="hint">Preço {fmt(selProd.preco_min)} – {fmt(selProd.preco_max)} · {selProd.categoria}</div>}
          </div>
          <div className="field">
            <label>Quantidade</label>
            <input type="number" min="1" value={qtd} onChange={(e) => setQtd(Number(e.target.value) || 0)} />
            <div className="flex gap-1 mt-1 wrap">
              {[1, 10, 50, 100, 500, 1000].map(n => (
                <button key={n} type="button" className="btn ghost sm" onClick={() => setQtd(q => q + n)}>+{n}</button>
              ))}
              <button type="button" className="btn ghost sm" onClick={() => setQtd(1)}>zerar</button>
            </div>
          </div>
          <button className="btn" disabled={!selProd || qtd <= 0} onClick={adicionar}>Adicionar ao Pedido</button>
        </section>

        {/* ---------- Lado direito: itens do pedido ---------- */}
        <section className="card" style={{ flex: '2 1 540px' }}>
          <h3>Itens do Pedido</h3>
          {itens.length === 0 ? (
            <p className="muted it small">Nenhum item ainda — adicione produtos ao lado.</p>
          ) : (
            <table className="book">
              <thead>
                <tr><th>Produto</th><th>Qtd</th><th>Preço unit.</th><th>Subtotal</th><th></th></tr>
              </thead>
              <tbody>
                {itens.map((it, i) => {
                  const sub = it.preco_unit * it.quantidade;
                  return (
                    <tr key={it.product.id}>
                      <td>{it.product.nome}<div className="muted small">{it.product.categoria}</div></td>
                      <td className="num">
                        <input type="number" min="1" value={it.quantidade} style={{ width: 80 }}
                          onChange={e => setItem(i, { quantidade: Math.max(1, Number(e.target.value) || 0) })} />
                      </td>
                      <td className="num">
                        <input type="number" step="0.01" min={it.product.preco_min} max={it.product.preco_max}
                          value={it.preco_unit} style={{ width: 90 }}
                          onChange={e => setItem(i, { preco_unit: clamp(Number(e.target.value) || 0, it.product.preco_min, it.product.preco_max) })} />
                        <div className="muted small">{fmt(it.product.preco_min)}–{fmt(it.product.preco_max)}</div>
                      </td>
                      <td className="num">{fmt(sub)}</td>
                      <td><button className="btn ghost sm" onClick={() => remover(i)}>×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="divider" />
          <div className="row">
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label>Cliente</label>
              <input type="text" value={cliente} onChange={e => setCliente(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '0 0 180px' }}>
              <label>Desconto (%) <span className="hint">máx {calc.descontoMaxPct.toFixed(1)}%</span></label>
              <input type="number" min="0" max={Math.floor(calc.descontoMaxPct * 10) / 10} step="0.5" value={descontoPct}
                onChange={e => setDescontoPct(clamp(Number(e.target.value) || 0, 0, calc.descontoMaxPct))} />
            </div>
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label>Prazo de entrega</label>
              <input type="datetime-local" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Anotações</label>
            <textarea maxLength={280} value={anotacoes} onChange={e => setAnotacoes(e.target.value)}
              placeholder="Observações para os trabalhadores (opcional, até 280 caracteres)" />
          </div>

          <div className="grid-3 mt-2">
            <div className="stat">
              <div className="label">Subtotal</div>
              <div className="value">{fmt(calc.subtotal)}</div>
            </div>
            <div className="stat">
              <div className="label">Desconto</div>
              <div className="value" style={{ color: calc.descAbs > 0 ? 'var(--vermelho)' : 'var(--tinta-mute)' }}>
                −{fmt(calc.descAbs)}
              </div>
              {calc.extrapolado && <div className="hint" style={{ color: 'var(--vermelho)' }}>capado em {calc.descontoMaxPct.toFixed(1)}%</div>}
            </div>
            <div className="stat accent">
              <div className="label">Total</div>
              <div className="value">{fmt(calc.total)}</div>
            </div>
          </div>

          <div className="flex gap-2 mt-3 wrap">
            <button className="btn ghost" disabled={salvando} onClick={() => salvar('rascunho')}>Salvar Rascunho</button>
            <button className="btn" disabled={salvando} onClick={() => salvar('aprovado')}>
              {salvando ? 'Salvando…' : 'Aprovar & Enviar à Produção'}
            </button>
          </div>
          {erro && <p style={{ color: 'var(--vermelho)' }} className="mt-2">{erro}</p>}
        </section>
      </div>
    </div>
  );
}
