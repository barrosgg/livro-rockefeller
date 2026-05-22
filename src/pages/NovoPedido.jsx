import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useLocalStorage } from '../lib/storage.js';
import { fmt, clamp } from '../lib/calc.js';
import { useUI } from '../lib/ui.jsx';
import ProdutoCombo from '../components/ProdutoCombo.jsx';
import ProductIcon from '../components/ProductIcon.jsx';

function novoNumero() { return String(Math.floor(1000 + Math.random() * 9000)); }

const QTD_PRESETS = [1, 10, 50, 100, 500, 1000];

function Kbd({ children }) {
  return (
    <kbd style={{
      fontFamily: "'Lora', serif",
      fontSize: '.72rem',
      padding: '2px 6px',
      borderRadius: 3,
      border: '1px solid var(--paper-edge)',
      background: '#fff',
      color: 'var(--ink-soft)',
      boxShadow: '0 1px 0 rgba(0,0,0,.04)',
    }}>{children}</kbd>
  );
}

export default function NovoPedido() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, confirmar } = useUI() || {};

  const [produtos, setProdutos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selProd, setSelProd] = useState(null);
  const [qtd, setQtd] = useState(50);
  const [salvarTplOpen, setSalvarTplOpen] = useState(false);
  const [tplNome, setTplNome] = useState('');

  const [draft, setDraft, limparDraft] = useLocalStorage('draft:pedido:novo', () => ({
    itens: [], cliente: '', anotacoes: '', descontoPct: 0, prazo: '', numero: novoNumero(),
  }));
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

  const comboRef = useRef(null);
  const qtdRef = useRef(null);

  useEffect(() => {
    supabase.from('products').select('*').order('nome').then(({ data, error }) => {
      if (error) setErro(error.message);
      else setProdutos(data || []);
    });
    supabase.from('order_templates')
      .select('*, items:order_template_items(*, product:products(*))')
      .order('criado_em', { ascending: false })
      .then(({ data }) => setTemplates(data || []));
  }, []);

  const carregarTemplate = (tplId) => {
    const t = templates.find(x => x.id === tplId);
    if (!t) return;
    setDraft(d => ({
      ...d,
      itens: (t.items || []).map(i => ({ product: i.product, quantidade: i.quantidade, preco_unit: Number(i.preco_unit) })),
    }));
  };

  const salvarComoTemplate = async () => {
    if (!tplNome.trim()) { showToast?.('Dê um nome ao template.', { type: 'error' }); return; }
    if (itens.length === 0) { showToast?.('Adicione itens antes de salvar como template.', { type: 'error' }); return; }
    const { data: tpl, error: e1 } = await supabase.from('order_templates').insert({
      nome: tplNome.trim(), criado_por: user.id,
    }).select().single();
    if (e1) { showToast?.(e1.message, { type: 'error' }); return; }
    const payload = itens.map(i => ({
      template_id: tpl.id, product_id: i.product.id,
      quantidade: i.quantidade, preco_unit: i.preco_unit,
    }));
    const { error: e2 } = await supabase.from('order_template_items').insert(payload);
    if (e2) { showToast?.(e2.message, { type: 'error' }); return; }
    setSalvarTplOpen(false); setTplNome('');
    const { data } = await supabase.from('order_templates')
      .select('*, items:order_template_items(*, product:products(*))')
      .order('criado_em', { ascending: false });
    setTemplates(data || []);
    showToast?.('Template salvo!', { type: 'success' });
  };

  // Foco inicial no combobox
  useEffect(() => { comboRef.current?.focus(); }, []);

  const adicionar = useCallback((produto, quantidade) => {
    const p = produto || selProd;
    const q = quantidade || qtd;
    if (!p || q <= 0) return false;
    // Default = preço máximo (margem total, melhor remuneração)
    const preco_unit = Number(p.preco_max);
    setItens((arr) => {
      const idx = arr.findIndex(i => i.product.id === p.id);
      if (idx >= 0) {
        const copy = [...arr];
        copy[idx] = { ...copy[idx], quantidade: copy[idx].quantidade + q };
        return copy;
      }
      return [...arr, { product: p, quantidade: q, preco_unit }];
    });
    setSelProd(null);
    comboRef.current?.clear();
    comboRef.current?.focus();
    return true;
  }, [selProd, qtd, setItens]);

  const setItem = (i, patch) => setItens((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const remover = (i) => setItens((arr) => arr.filter((_, idx) => idx !== i));

  const calc = useMemo(() => {
    const subtotal = itens.reduce((a, it) => a + it.preco_unit * it.quantidade, 0);
    const subtotalNoMin = itens.reduce((a, it) => a + it.product.preco_min * it.quantidade, 0);
    const margemMaxAbs = Math.max(0, subtotal - subtotalNoMin);
    const descontoMaxPct = subtotal > 0 ? (margemMaxAbs / subtotal) * 100 : 0;
    const pctEfetivo = Math.min(descontoPct, descontoMaxPct);
    const descAbs = subtotal * (pctEfetivo / 100);
    return {
      subtotal, descontoMaxPct, pctEfetivo, descAbs,
      total: subtotal - descAbs,
      extrapolado: descontoPct > descontoMaxPct + 0.001,
    };
  }, [itens, descontoPct]);

  const salvar = useCallback(async (status) => {
    setErro(null);
    if (itens.length === 0) { setErro('Adicione ao menos 1 item.'); return; }
    if (status === 'aprovado' && !prazo) { setErro('Defina o prazo de entrega para aprovar.'); return; }
    setSalvando(true);

    const { data: order, error: e1 } = await supabase.from('orders').insert({
      numero_nota: numero,
      cliente: cliente || null,
      anotacoes: anotacoes || null,
      desconto_pct: calc.pctEfetivo,
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
    limparDraft();
    navigate(`/pedidos/${order.short_code || order.id}`);
  }, [itens, prazo, numero, cliente, anotacoes, calc.pctEfetivo, user, limparDraft, navigate]);

  /* ---- Atalhos globais ---- */
  useEffect(() => {
    const onKey = (e) => {
      // ignorar se digitando em textarea
      const tag = e.target.tagName;
      const inText = tag === 'TEXTAREA';
      // "/" foca busca
      if (e.key === '/' && !inText && !e.ctrlKey && !e.metaKey) {
        const isInput = tag === 'INPUT';
        if (!isInput || e.target.type === 'datetime-local') {
          e.preventDefault();
          comboRef.current?.focus();
        }
      }
      // Ctrl+Enter aprova
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        salvar('aprovado');
      }
      // Ctrl+S salva rascunho
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvar('rascunho');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [salvar]);

  // Quando o usuário escolhe um produto no combo, foca a qtd
  const onProdutoSelect = (p) => {
    setSelProd(p);
    if (p) setTimeout(() => qtdRef.current?.select(), 50);
  };

  const onQtdKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (adicionar()) {
        setQtd(50); // valor default volta pra 50
      }
    }
  };

  const temDraft = itens.length > 0 || cliente || anotacoes || descontoPct > 0 || prazo;

  return (
    <div className="page" style={{ paddingBottom: 100 }}>
      <div className="flex between center-y wrap gap-2">
        <div>
          <h1 className="mt-0">Novo Pedido</h1>
          <div className="muted small">
            Nota Nº {numero}
            {temDraft && <> · <em>rascunho salvo automaticamente</em> · <button
              type="button"
              aria-label="Descartar rascunho"
              className="btn ghost sm" style={{ padding: '2px 8px', fontSize: '.74rem' }}
              onClick={async () => {
                const ok = await confirmar?.(
                  'O rascunho será apagado. Itens não enviados serão perdidos.',
                  { title: 'Descartar rascunho?', danger: true, confirmLabel: 'Descartar' });
                if (ok) limparDraft();
              }}>descartar</button></>}
          </div>
        </div>
        <div className="flex gap-1 small muted" style={{ alignItems: 'center' }}>
          <Kbd>/</Kbd> buscar
          <Kbd>↵</Kbd> adicionar
          <Kbd>Ctrl</Kbd>+<Kbd>↵</Kbd> aprovar
          <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> rascunho
        </div>
      </div>

      {/* ---------- Templates (carregar / salvar) ---------- */}
      {(templates.length > 0 || itens.length > 0) && (
        <div className="card mt-2" style={{ background: 'transparent', borderStyle: 'dashed' }}>
          <div className="flex between center-y wrap gap-2">
            {templates.length > 0 ? (
              <div className="flex gap-1 center-y wrap">
                <span className="muted small">Carregar template:</span>
                <select onChange={e => e.target.value && carregarTemplate(e.target.value)} value="">
                  <option value="">— escolha —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.nome} ({(t.items || []).length} itens)</option>
                  ))}
                </select>
              </div>
            ) : <div />}
            {itens.length > 0 && (
              salvarTplOpen ? (
                <div className="flex gap-1 center-y wrap">
                  <input type="text" placeholder="Nome do template" value={tplNome}
                    onChange={e => setTplNome(e.target.value)} autoFocus style={{ minWidth: 200 }} />
                  <button className="btn sm" onClick={salvarComoTemplate}>Salvar</button>
                  <button className="btn ghost sm" onClick={() => { setSalvarTplOpen(false); setTplNome(''); }}>Cancelar</button>
                </div>
              ) : (
                <button className="btn ghost sm" onClick={() => setSalvarTplOpen(true)}>
                  💾 Salvar como template
                </button>
              )
            )}
          </div>
        </div>
      )}

      <hr className="divider" />

      {/* ---------- Barra de adicionar item (sempre no topo) ---------- */}
      <div className="card" style={{ background: '#fff', padding: '14px 16px' }}>
        <div className="flex gap-2 wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 320px', marginBottom: 0 }}>
            <label>Produto</label>
            <ProdutoCombo
              ref={comboRef}
              produtos={produtos}
              value={selProd}
              onSelect={onProdutoSelect}
              placeholder="Buscar produto…  ( / )"
            />
            {selProd && <div className="hint">{selProd.categoria} · {fmt(selProd.preco_min)}–{fmt(selProd.preco_max)}</div>}
          </div>
          <div className="field" style={{ flex: '0 0 110px', marginBottom: 0 }}>
            <label>Quantidade</label>
            <input ref={qtdRef} type="number" min="1" value={qtd}
              style={{ textAlign: 'center' }}
              onChange={(e) => setQtd(Number(e.target.value) || 0)}
              onKeyDown={onQtdKey} />
          </div>
          <div className="flex gap-1 wrap" style={{ marginBottom: 1, alignSelf: 'flex-end' }}>
            {QTD_PRESETS.map(n => (
              <button key={n} type="button" className="btn ghost sm"
                style={{ minWidth: 44, padding: '6px 10px' }}
                onClick={() => setQtd(n)}>{n}</button>
            ))}
          </div>
          <button className="btn lg" disabled={!selProd || qtd <= 0} onClick={() => adicionar()}>
            Adicionar
          </button>
        </div>
      </div>

      {/* ---------- Lista de itens ---------- */}
      <h2 className="mt-3">Itens ({itens.length})</h2>
      {itens.length === 0 ? (
        <div className="card center"><p className="muted it mt-0">
          Nenhum item ainda. Pressione <Kbd>/</Kbd> para buscar.
        </p></div>
      ) : (
        <table className="book" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 50 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Produto</th>
              <th className="num">Qtd</th>
              <th className="num">Preço unit.</th>
              <th className="num">Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => {
              const sub = it.preco_unit * it.quantidade;
              return (
                <tr key={it.product.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ProductIcon slug={it.product.icon} name={it.product.nome} size={24} />
                      <div>
                        {it.product.nome}
                        <div className="muted small">{it.product.categoria}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">
                    <input type="number" min="1" value={it.quantidade}
                      style={{ width: '100%', textAlign: 'right' }}
                      onChange={e => setItem(i, { quantidade: Math.max(1, Number(e.target.value) || 0) })} />
                  </td>
                  <td className="num">
                    <input type="number" step="0.01" min={it.product.preco_min} max={it.product.preco_max}
                      value={it.preco_unit} style={{ width: '100%', textAlign: 'right' }}
                      onChange={e => setItem(i, { preco_unit: clamp(Number(e.target.value) || 0, it.product.preco_min, it.product.preco_max) })} />
                    <div className="muted" style={{ fontSize: '.7rem', textAlign: 'right', marginTop: 2 }}>
                      {fmt(it.product.preco_min)} – {fmt(it.product.preco_max)}
                    </div>
                  </td>
                  <td className="num"><strong style={{ fontSize: '1rem' }}>{fmt(sub)}</strong></td>
                  <td className="center">
                    <button type="button" className="btn ghost sm"
                      aria-label={`Remover ${it.product.nome} do pedido`}
                      title="Remover item"
                      style={{ width: 32, padding: '4px 0', fontSize: '1rem', lineHeight: 1 }}
                      onClick={() => remover(i)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ---------- Configurações secundárias ---------- */}
      <h2 className="mt-3">Configurações do Pedido</h2>
      <div className="card">
        <div className="row">
          <div className="field" style={{ flex: '2 1 260px' }}>
            <label>Cliente</label>
            <input type="text" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente (opcional)" />
          </div>
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label>Prazo de entrega</label>
            <input type="datetime-local" value={prazo} onChange={e => setPrazo(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '0 0 140px' }}>
            <label>Desconto (%)</label>
            <input type="number" min="0" max={Math.floor(calc.descontoMaxPct * 10) / 10} step="0.5" value={descontoPct}
              style={{ textAlign: 'right' }}
              onChange={e => setDescontoPct(clamp(Number(e.target.value) || 0, 0, calc.descontoMaxPct))} />
            <div className="hint">máximo {calc.descontoMaxPct.toFixed(1)}%</div>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Anotações</label>
          <textarea maxLength={280} value={anotacoes} onChange={e => setAnotacoes(e.target.value)}
            placeholder="Observações para os trabalhadores (opcional, até 280 caracteres)" />
        </div>
      </div>

      {erro && <p style={{ color: 'var(--burgundy)' }} className="mt-2">{erro}</p>}

      {/* ---------- Sticky bottom bar com totais + ações ---------- */}
      <div style={{
        position: 'sticky', bottom: 0, marginTop: 28,
        background: 'var(--paper)',
        borderTop: '1px solid var(--paper-edge)',
        padding: '14px 4px 6px',
        zIndex: 5,
      }}>
        <div className="flex between center-y wrap" style={{ gap: 24 }}>
          {/* Totais com separadores verticais */}
          <div className="flex wrap" style={{ alignItems: 'baseline', gap: 0 }}>
            <div style={{ padding: '0 18px 0 0', borderRight: '1px solid var(--paper-edge)' }}>
              <div className="muted small" style={{ fontSize: '.72rem', letterSpacing: '.04em', textTransform: 'uppercase' }}>Subtotal</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 600 }}>
                {fmt(calc.subtotal)}
              </div>
            </div>
            <div style={{ padding: '0 18px', borderRight: '1px solid var(--paper-edge)' }}>
              <div className="muted small" style={{ fontSize: '.72rem', letterSpacing: '.04em', textTransform: 'uppercase' }}>Desconto</div>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.05rem',
                fontWeight: 600,
                color: calc.descAbs > 0 ? 'var(--burgundy)' : 'var(--ink-faded)',
              }}>
                {calc.descAbs > 0 ? `−${fmt(calc.descAbs)}` : fmt(0)}
              </div>
            </div>
            <div style={{ padding: '0 18px' }}>
              <div className="muted small" style={{ fontSize: '.72rem', letterSpacing: '.04em', textTransform: 'uppercase' }}>Total</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold-deep)', lineHeight: 1 }}>
                {fmt(calc.total)}
              </div>
            </div>
          </div>
          <div className="flex gap-1 wrap">
            <button className="btn ghost" disabled={salvando} onClick={() => salvar('rascunho')}>
              Salvar Rascunho <Kbd>Ctrl S</Kbd>
            </button>
            <button className="btn" disabled={salvando || itens.length === 0} onClick={() => salvar('aprovado')}>
              {salvando ? 'Salvando…' : <>Aprovar &amp; Enviar <Kbd>Ctrl ↵</Kbd></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
