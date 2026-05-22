import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { fmt, clamp, totalPedido } from '../lib/calc.js';

function novoNumero() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function NovoPedido() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState([]);            // [{product, quantidade, preco_unit}]
  const [qtd, setQtd] = useState(50);
  const [selProd, setSelProd] = useState(null);

  const [cliente, setCliente] = useState('');
  const [anotacoes, setAnotacoes] = useState('');
  const [descontoPct, setDescontoPct] = useState(0);
  const [prazo, setPrazo] = useState('');
  const [numero] = useState(novoNumero());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    supabase.from('products').select('*').order('nome').then(({ data, error }) => {
      if (error) setErro(error.message);
      else setProdutos(data || []);
    });
  }, []);

  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtos.slice(0, 20);
    return produtos.filter(p => p.nome.toLowerCase().includes(q)).slice(0, 20);
  }, [busca, produtos]);

  const adicionar = () => {
    if (!selProd || qtd <= 0) return;
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
    setBusca(''); setSelProd(null);
  };

  const setItem = (i, patch) => setItens((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const remover = (i) => setItens((arr) => arr.filter((_, idx) => idx !== i));

  const totais = totalPedido({ itens: itens.map(i => ({ preco_unit: i.preco_unit, quantidade: i.quantidade })), desconto_pct: descontoPct });

  const salvar = async (status) => {
    setErro(null);
    if (itens.length === 0) { setErro('Adicione ao menos 1 item.'); return; }
    if (status === 'aprovado' && !prazo) { setErro('Defina o prazo de entrega para aprovar.'); return; }
    setSalvando(true);

    const { data: order, error: e1 } = await supabase.from('orders').insert({
      numero_nota: numero,
      cliente: cliente || null,
      anotacoes: anotacoes || null,
      desconto_pct: descontoPct,
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
    navigate(`/pedidos/${order.id}`);
  };

  return (
    <div className="page">
      <div className="flex between center-y">
        <h1 className="mt-0">Novo Pedido</h1>
        <span className="seal">Nota Nº {numero}</span>
      </div>
      <p className="muted">Monte o orçamento. Ao <em>aprovar</em>, o pedido vai para produção e os trabalhadores poderão assumir itens.</p>
      <div className="divider" />

      <div className="row">
        {/* Página esquerda — buscar e adicionar */}
        <section className="card" style={{ flex: '1 1 360px' }}>
          <h3>Adicionar Item</h3>
          <div className="field">
            <label>Produto</label>
            <input type="text" value={busca} placeholder="Buscar produto…"
              onChange={(e) => { setBusca(e.target.value); setSelProd(null); }} />
            {busca && !selProd && (
              <div className="card" style={{ marginTop: 6, padding: 6, maxHeight: 220, overflow: 'auto' }}>
                {sugestoes.length === 0 && <div className="muted">Nenhum produto.</div>}
                {sugestoes.map(p => (
                  <div key={p.id} className="flex between center-y"
                       style={{ padding: '4px 6px', cursor: 'pointer' }}
                       onClick={() => { setSelProd(p); setBusca(p.nome); }}>
                    <span>{p.nome}</span>
                    <span className="muted num">{fmt(p.preco_min)}–{fmt(p.preco_max)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="field">
            <label>Quantidade</label>
            <input type="number" min="1" value={qtd} onChange={(e) => setQtd(Number(e.target.value) || 0)} />
            <div className="flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
              {[1, 10, 50, 100, 500, 1000].map(n => (
                <button key={n} type="button" className="btn ghost sm" onClick={() => setQtd(q => q + n)}>+{n}</button>
              ))}
              <button type="button" className="btn ghost sm" onClick={() => setQtd(0)}>zerar</button>
            </div>
          </div>
          <button className="btn" disabled={!selProd || qtd <= 0} onClick={adicionar}>Adicionar ao Pedido</button>
        </section>

        {/* Página direita — pedido */}
        <section className="card" style={{ flex: '2 1 520px' }}>
          <h3>Itens do Pedido</h3>
          {itens.length === 0 ? (
            <p className="muted">Nenhum item ainda.</p>
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
                      <td>{it.product.nome}<div className="muted" style={{fontSize:'.8rem'}}>{it.product.categoria}</div></td>
                      <td className="num">
                        <input type="number" min="1" value={it.quantidade} style={{ width: 80 }}
                          onChange={e => setItem(i, { quantidade: Math.max(1, Number(e.target.value) || 0) })} />
                      </td>
                      <td className="num">
                        <input type="number" step="0.01" min={it.product.preco_min} max={it.product.preco_max}
                          value={it.preco_unit} style={{ width: 90 }}
                          onChange={e => setItem(i, { preco_unit: clamp(Number(e.target.value) || 0, it.product.preco_min, it.product.preco_max) })} />
                        <div className="muted" style={{fontSize:'.75rem'}}>{fmt(it.product.preco_min)}–{fmt(it.product.preco_max)}</div>
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
            <div className="field" style={{ flex: '0 0 140px' }}>
              <label>Desconto (%)</label>
              <input type="number" min="0" max="100" step="1" value={descontoPct}
                onChange={e => setDescontoPct(clamp(Number(e.target.value) || 0, 0, 100))} />
            </div>
            <div className="field" style={{ flex: '1 1 240px' }}>
              <label>Prazo de entrega</label>
              <input type="datetime-local" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Anotações</label>
            <textarea maxLength={280} value={anotacoes} onChange={e => setAnotacoes(e.target.value)} />
          </div>

          <div className="flex between center-y mt-2">
            <div>
              <div className="muted">Subtotal: <span className="num">{fmt(totais.subtotal)}</span></div>
              <div className="muted">Desconto: <span className="num">−{fmt(totais.desconto)}</span></div>
              <div><strong>Total: <span className="num">{fmt(totais.total)}</span></strong></div>
            </div>
            <div className="flex gap-2">
              <button className="btn ghost" disabled={salvando} onClick={() => salvar('rascunho')}>Salvar Rascunho</button>
              <button className="btn" disabled={salvando} onClick={() => salvar('aprovado')}>Aprovar &amp; Enviar à Produção</button>
            </div>
          </div>
          {erro && <p style={{ color: 'var(--vermelho)' }}>{erro}</p>}
        </section>
      </div>
    </div>
  );
}
