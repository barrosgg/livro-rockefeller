import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { fmt, statusLabel, totalPedido } from '../lib/calc.js';
import StatusTimeline from '../components/StatusTimeline.jsx';
import Avatar from '../components/Avatar.jsx';
import ProductIcon from '../components/ProductIcon.jsx';

export default function PedidoPublico() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let alive = true;
    const carregar = async () => {
      const { data, error } = await supabase.rpc('get_order_public', { p_code: token });
      if (!alive) return;
      if (error) { setErro(error.message); setLoading(false); return; }
      setData(data);
      setLoading(false);
    };
    carregar();
    // Atualização em "tempo real" leve: re-busca a cada 20s
    const t = setInterval(carregar, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [token]);

  if (loading) return (
    <div className="login-wrap"><div className="page login-card">Buscando pedido…</div></div>
  );

  if (erro || !data) return (
    <div className="login-wrap">
      <div className="page login-card">
        <h2>Pedido não encontrado</h2>
        <p className="muted">O link pode ter expirado ou estar incorreto.</p>
      </div>
    </div>
  );

  const { order, items, claims } = data;
  const totais = totalPedido({
    itens: items.map(i => ({ preco_unit: i.preco_unit, quantidade: i.quantidade })),
    desconto_pct: order.desconto_pct,
  });
  const qtdTotal = items.reduce((a, i) => a + i.quantidade, 0);
  // Calcular já em produção a partir dos claims ativos (em_producao, entregue, pago)
  const ativos = (claims || []).filter(c => ['em_producao','entregue','pago'].includes(c.status));
  const assumidoPorItem = {};
  ativos.forEach(c => {
    (c.items || []).forEach(ci => {
      assumidoPorItem[ci.product.nome] = (assumidoPorItem[ci.product.nome] || 0) + ci.quantidade;
    });
  });
  const qtdAssumida = Object.values(assumidoPorItem).reduce((a, b) => a + b, 0);
  const qtdAberto = qtdTotal - qtdAssumida;
  const pct = qtdTotal ? (qtdAssumida / qtdTotal) * 100 : 0;

  return (
    <div className="shell">
      <div className="page">
        <div className="flex between center-y wrap gap-2">
          <div>
            <div className="muted small">Acompanhamento do Cliente</div>
            <h1 className="mt-0">Pedido Nº {order.numero_nota}</h1>
            <p className="muted small mt-0">
              {order.cliente ? <>Cliente <strong>{order.cliente}</strong> · </> : null}
              Emitido em {new Date(order.criado_em).toLocaleString('pt-BR')}
              {order.prazo_entrega && <> · Prazo <strong>{new Date(order.prazo_entrega).toLocaleString('pt-BR')}</strong></>}
            </p>
          </div>
          <span className={`badge ${order.status}`}>{statusLabel(order.status)}</span>
        </div>

        <div className="card mt-2">
          <StatusTimeline pedido={order} claims={claims || []} />
        </div>

        {order.anotacoes && (
          <div className="card mt-2" style={{ background: 'rgba(234,217,160,.25)', borderStyle: 'dashed' }}>
            <span className="muted small">Observações:</span> {order.anotacoes}
          </div>
        )}

        <div className="grid-3 mt-3">
          <div className="stat">
            <div className="label">Progresso</div>
            <div className="value">{pct.toFixed(0)}%</div>
            <div className="hint">{qtdAssumida} de {qtdTotal} unidades</div>
          </div>
          <div className="stat">
            <div className="label">Restam para produzir</div>
            <div className="value">{qtdAberto}</div>
            <div className="hint">{items.length} produto(s)</div>
          </div>
          <div className="stat accent">
            <div className="label">Valor total</div>
            <div className="value">{fmt(totais.total)}</div>
            <div className="hint">Subtotal {fmt(totais.subtotal)} · Desc. −{fmt(totais.desconto)}</div>
          </div>
        </div>

        <h2 className="mt-3">Itens do Pedido</h2>
        <table className="book">
          <thead>
            <tr>
              <th>Produto</th>
              <th className="num">Quantidade</th>
              <th className="num">Preço unit.</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProductIcon slug={it.product.icon} name={it.product.nome} size={22} />
                    <div>
                      {it.product.nome}
                      <div className="muted small">{it.product.categoria}</div>
                    </div>
                  </div>
                </td>
                <td className="num">{it.quantidade}</td>
                <td className="num">{fmt(it.preco_unit)}</td>
                <td className="num">{fmt(it.preco_unit * it.quantidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-3">Produção</h2>
        {(claims || []).length === 0 ? (
          <div className="card"><p className="muted it small mt-0">Aguardando início da produção.</p></div>
        ) : (
          <div className="stack">
            {claims.map((c, i) => (
              <div key={i} className="card">
                <div className="flex between center-y wrap">
                  <div className="flex gap-2 center-y">
                    <Avatar slug={c.trabalhador?.avatar} name={c.trabalhador?.nome_completo} size={40} />
                    <div>
                      <strong>{c.trabalhador?.nome_completo || c.trabalhador?.discord_handle}</strong>
                      <div className="muted small">Discord: {c.trabalhador?.discord_handle}</div>
                    </div>
                  </div>
                  <span className={`badge ${c.status}`}>{statusLabel(c.status)}</span>
                </div>
                <div className="mt-2" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(c.items || []).map((ci, j) => (
                    <span key={j} className="badge" style={{ background: 'var(--page-edge)', color: 'var(--tinta)', border: '1px solid var(--ouro-medio)' }}>
                      {ci.product.nome} ×{ci.quantidade}
                    </span>
                  ))}
                </div>
                <div className="muted small mt-2">
                  Previsto entregar: {new Date(c.data_prevista_entrega).toLocaleString('pt-BR')}
                  {c.entregue_em && <> · Entregue: {new Date(c.entregue_em).toLocaleString('pt-BR')}</>}
                  {c.pago_em && <> · Pagamento confirmado: {new Date(c.pago_em).toLocaleString('pt-BR')}</>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="divider" />
        <p className="muted small center">
          Esta página atualiza automaticamente. Caderno da Fazenda Rockefeller.
        </p>
      </div>
    </div>
  );
}
