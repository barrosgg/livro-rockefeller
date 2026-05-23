import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useLocalStorage } from '../lib/storage.js';
import { fmt, clamp } from '../lib/calc.js';
import { useUI } from '../lib/ui.jsx';
import ProdutoCombo from '../components/ProdutoCombo.jsx';
import ProductIcon from '../components/ProductIcon.jsx';
import { useCategorias } from '../lib/settings.jsx';
import { useFocusTrap } from '../lib/a11y.js';

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
  const [novoProdutoOpen, setNovoProdutoOpen] = useState(false);

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

  /* Aviso ao fechar/recarregar com itens não enviados */
  useEffect(() => {
    if (itens.length === 0) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [itens.length]);

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
    <div className="page novo-pedido" style={{ paddingBottom: 100 }}>
      {/* ---------- Cabeçalho ---------- */}
      <div className="np-header">
        <div className="np-header-main">
          <h1 className="mt-0">Novo Pedido</h1>
          <div className="np-meta">
            <span className="np-nota">Nota Nº <strong>{numero}</strong></span>
            {temDraft && (
              <>
                <span className="np-meta-sep">·</span>
                <span className="np-draft-status">
                  <span className="np-draft-dot" aria-hidden="true" />
                  rascunho salvo
                </span>
                <button
                  type="button"
                  aria-label="Descartar rascunho"
                  className="np-link-danger"
                  onClick={async () => {
                    const ok = await confirmar?.(
                      'O rascunho será apagado. Itens não enviados serão perdidos.',
                      { title: 'Descartar rascunho?', danger: true, confirmLabel: 'Descartar' });
                    if (ok) limparDraft();
                  }}>descartar</button>
              </>
            )}
          </div>
        </div>
        <div className="np-shortcuts">
          <span><Kbd>/</Kbd> buscar</span>
          <span><Kbd>↵</Kbd> adicionar</span>
          <span><Kbd>Ctrl</Kbd>+<Kbd>↵</Kbd> aprovar</span>
          <span><Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> rascunho</span>
        </div>
      </div>

      {/* ---------- Barra de adicionar item ---------- */}
      <section className="np-section">
        <div className="np-section-header">
          <h2 className="mt-0">Adicionar Item</h2>
          {templates.length > 0 && (
            <div className="np-template-load">
              <label htmlFor="tpl-load" className="muted small">Carregar template:</label>
              <select id="tpl-load" value="" onChange={e => e.target.value && carregarTemplate(e.target.value)}>
                <option value="">— escolha —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.nome} ({(t.items || []).length} itens)</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="np-add-card">
          {/* Linha 1: Produto + Quantidade + Adicionar */}
          <div className="np-add-row">
            <div className="np-field np-field-produto">
              <label className="np-field-label">
                <span>Produto</span>
                <button type="button" className="np-mini-link"
                  onClick={() => setNovoProdutoOpen(true)}>
                  + Criar novo
                </button>
              </label>
              <ProdutoCombo
                ref={comboRef}
                produtos={produtos}
                value={selProd}
                onSelect={onProdutoSelect}
                placeholder="Buscar produto…  ( / )"
              />
              {/* Reserva sempre 1 linha pra dica — evita layout shift */}
              <div className="np-field-hint">
                {selProd
                  ? <>{selProd.categoria} · {fmt(selProd.preco_min)}–{fmt(selProd.preco_max)}</>
                  : <span className="muted np-hint-placeholder">Selecione um produto para ver a faixa de preço</span>}
              </div>
            </div>

            <div className="np-field np-field-qtd">
              <label className="np-field-label">Quantidade</label>
              <input ref={qtdRef} type="number" min="1" value={qtd}
                className="np-qtd-input"
                onChange={(e) => setQtd(Number(e.target.value) || 0)}
                onKeyDown={onQtdKey} />
              <div className="np-field-hint">&nbsp;</div>
            </div>

            <div className="np-field np-field-action">
              {/* spacer placeholder pra alinhar com inputs */}
              <div className="np-field-label" aria-hidden="true">&nbsp;</div>
              <button
                className="np-btn-add"
                disabled={!selProd || qtd <= 0}
                onClick={() => adicionar()}
                aria-label="Adicionar item ao pedido">
                Adicionar <span aria-hidden="true">→</span>
              </button>
              <div className="np-field-hint">&nbsp;</div>
            </div>
          </div>

          {/* Linha 2: Atalhos de quantidade */}
          <div className="np-presets">
            <span className="np-presets-label">Atalhos:</span>
            {QTD_PRESETS.map(n => (
              <button key={n} type="button"
                className={`np-preset ${qtd === n ? 'active' : ''}`}
                onClick={() => setQtd(n)}>{n}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Lista de itens (sempre renderiza container) ---------- */}
      <section className="np-section">
        <div className="np-section-header">
          <h2 className="mt-0">Itens <span className="np-count">({itens.length})</span></h2>
          {itens.length > 0 && (
            salvarTplOpen ? (
              <div className="flex gap-1 center-y wrap">
                <input type="text" placeholder="Nome do template" value={tplNome}
                  onChange={e => setTplNome(e.target.value)} autoFocus
                  style={{ minWidth: 200, padding: '6px 10px' }} />
                <button className="btn sm" onClick={salvarComoTemplate}>Salvar</button>
                <button className="btn ghost sm" onClick={() => { setSalvarTplOpen(false); setTplNome(''); }}>Cancelar</button>
              </div>
            ) : (
              <button className="np-mini-link" onClick={() => setSalvarTplOpen(true)}>
                💾 Salvar como template
              </button>
            )
          )}
        </div>

      {itens.length === 0 ? (
        <div className="np-empty">
          <div className="np-empty-icon" aria-hidden="true">📜</div>
          <p className="muted it mt-0">
            Nenhum item ainda. Pressione <Kbd>/</Kbd> para buscar produtos.
          </p>
        </div>
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
      </section>

      {/* ---------- Configurações secundárias ---------- */}
      <section className="np-section">
        <div className="np-section-header">
          <h2 className="mt-0">Configurações do Pedido</h2>
        </div>
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
      </section>

      {erro && <p style={{ color: 'var(--burgundy)' }} className="mt-2">{erro}</p>}

      {/* ---------- Sticky bottom bar com totais + ações ---------- */}
      <div className="np-actions-bar">
        <div className="np-totals">
          <div className="np-total-block">
            <div className="np-total-label">Subtotal</div>
            <div className="np-total-value">{fmt(calc.subtotal)}</div>
          </div>
          <div className="np-total-block">
            <div className="np-total-label">Desconto</div>
            <div className={`np-total-value ${calc.descAbs > 0 ? 'has-disc' : 'no-disc'}`}>
              {calc.descAbs > 0 ? `−${fmt(calc.descAbs)}` : fmt(0)}
            </div>
          </div>
          <div className="np-total-block np-total-final">
            <div className="np-total-label">Total</div>
            <div className="np-total-value np-total-final-value">{fmt(calc.total)}</div>
          </div>
        </div>
        <div className="np-actions">
          <button className="btn ghost" disabled={salvando} onClick={() => salvar('rascunho')}>
            Salvar Rascunho <Kbd>Ctrl S</Kbd>
          </button>
          <button className="btn" disabled={salvando || itens.length === 0} onClick={() => salvar('aprovado')}>
            {salvando ? 'Salvando…' : <>Aprovar &amp; Enviar <Kbd>Ctrl ↵</Kbd></>}
          </button>
        </div>
      </div>

      {novoProdutoOpen && (
        <NovoProdutoModal
          onClose={() => setNovoProdutoOpen(false)}
          onCreated={async (criado) => {
            // Atualiza catálogo local e seleciona o recém-criado
            const { data } = await supabase.from('products').select('*').order('nome');
            setProdutos(data || []);
            const novoComp = (data || []).find(p => p.id === criado.id) || criado;
            setSelProd(novoComp);
            setNovoProdutoOpen(false);
            showToast?.(`Produto "${criado.nome}" adicionado.`, { type: 'success' });
            setTimeout(() => qtdRef.current?.select(), 100);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Modal: criar produto inline ---------- */
function NovoProdutoModal({ onClose, onCreated }) {
  const categorias = useCategorias();
  const modalRef = useFocusTrap(true);
  const [form, setForm] = useState({
    nome: '', categoria: '', preco_min: '', preco_max: '', icon: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!form.categoria && categorias.length) {
      setForm(f => ({ ...f, categoria: categorias[0] }));
    }
  }, [categorias, form.categoria]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErro(null);
    const nome = form.nome.trim();
    const pmin = Number(form.preco_min);
    const pmax = Number(form.preco_max);
    if (!nome) { setErro('Nome do produto é obrigatório.'); return; }
    if (isNaN(pmin) || pmin <= 0 || isNaN(pmax) || pmax < pmin) {
      setErro('Preço inválido (mínimo > 0 e máximo ≥ mínimo).');
      return;
    }
    setSalvando(true);
    const { data, error } = await supabase.from('products').insert({
      nome, categoria: form.categoria,
      preco_min: pmin, preco_max: pmax,
      icon: form.icon.trim() || null,
    }).select().single();
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onCreated(data);
  };

  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="novo-prod-title"
         onClick={onClose}>
      <div className="confirm-modal" ref={modalRef} onClick={e => e.stopPropagation()}
           style={{ maxWidth: 540 }}>
        <h3 id="novo-prod-title" className="mt-0">Criar Novo Produto</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="np-nome">Nome</label>
            <input id="np-nome" type="text" autoFocus required value={form.nome} onChange={set('nome')} />
          </div>
          <div className="row">
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="np-cat">Categoria</label>
              <select id="np-cat" value={form.categoria} onChange={set('categoria')}>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: '0 0 110px' }}>
              <label htmlFor="np-min">Preço mín.</label>
              <input id="np-min" type="number" step="0.01" min="0" required
                value={form.preco_min} onChange={set('preco_min')} style={{ textAlign: 'right' }} />
            </div>
            <div className="field" style={{ flex: '0 0 110px' }}>
              <label htmlFor="np-max">Preço máx.</label>
              <input id="np-max" type="number" step="0.01" min="0" required
                value={form.preco_max} onChange={set('preco_max')} style={{ textAlign: 'right' }} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="np-icon">
              Ícone{' '}
              <a href="https://game-icons.net" target="_blank" rel="noopener noreferrer"
                 style={{ fontSize: '.7rem', marginLeft: 4 }}>buscar →</a>
            </label>
            <input id="np-icon" type="text" placeholder="ex: delapouite/corn (opcional)"
              value={form.icon} onChange={set('icon')} />
          </div>
          {erro && <p style={{ color: 'var(--burgundy)' }} className="small">{erro}</p>}
          <div className="flex gap-1 mt-2" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar e Selecionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
