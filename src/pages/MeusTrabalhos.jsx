import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useWorkerPct } from '../lib/settings.jsx';
import { useLocalStorage } from '../lib/storage.js';
import { fmt, statusLabel } from '../lib/calc.js';

const STATUS_FILTROS = ['todos', 'em_producao', 'entregue', 'pago', 'cancelado'];

export default function MeusTrabalhos() {
  const { user } = useAuth();
  const TRABALHADOR_PCT = useWorkerPct();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useLocalStorage('meus-trabalhos:filtro', 'todos');

  useEffect(() => {
    if (!user) return;
    supabase.from('claims')
      .select('*, public_code, order:orders(id, short_code, numero_nota, cliente, status), items:claim_items(quantidade, order_item:order_items(preco_unit, product:products(nome)))')
      .eq('trabalhador_id', user.id)
      .order('criado_em', { ascending: false })
      .then(({ data }) => { setClaims(data || []); setLoading(false); });
  }, [user]);

  const contagens = useMemo(() => {
    const c = { todos: claims.length };
    for (const s of STATUS_FILTROS) if (s !== 'todos') c[s] = 0;
    claims.forEach(cl => { c[cl.status] = (c[cl.status] || 0) + 1; });
    return c;
  }, [claims]);

  const lista = useMemo(() => {
    if (filtro === 'todos') return claims;
    return claims.filter(c => c.status === filtro);
  }, [claims, filtro]);

  if (loading) return (
    <div className="page">
      <h1 className="mt-0">Meus Trabalhos</h1>
      <hr className="divider" />
      <div aria-live="polite" aria-busy="true">
        {[1,2,3].map(i => (
          <div key={i} className="skeleton-row">
            <div className="skeleton skeleton-line medium" />
            <div className="skeleton skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page">
      <h1 className="mt-0">Meus Trabalhos</h1>
      <p className="muted">Histórico das produções que você assumiu, status e remuneração.</p>

      {claims.length > 0 && (
        <div className="flex gap-1 wrap mt-2" role="tablist" aria-label="Filtrar trabalhos por status">
          {STATUS_FILTROS.map(s => (
            <button key={s}
              type="button"
              role="tab"
              aria-selected={filtro === s}
              className={`btn sm ${filtro === s ? '' : 'ghost'}`}
              onClick={() => setFiltro(s)}>
              {s === 'todos' ? 'Todos' : statusLabel(s)} · {contagens[s] || 0}
            </button>
          ))}
        </div>
      )}

      <hr className="divider" />

      {claims.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌾</div>
          <h3 className="mt-0">Nenhuma produção ainda</h3>
          <p className="muted">
            Vá em <strong>Pedidos</strong> e assuma sua primeira produção. O histórico e remuneração aparecem aqui.
          </p>
          <Link className="btn mt-2" to="/pedidos">Ver Pedidos disponíveis</Link>
        </div>
      ) : lista.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3 className="mt-0">Nenhum trabalho neste filtro</h3>
          <p className="muted">Tente outro status acima.</p>
        </div>
      ) : (
        <table className="book responsive" aria-label="Histórico de produções">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Itens</th>
              <th className="num">Bruto</th>
              <th className="num">Líquido ({(TRABALHADOR_PCT*100).toFixed(0)}%)</th>
              <th>Status</th>
              <th>Prevista</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(c => {
              const bruto = (c.items || []).reduce((a, ci) =>
                a + ci.quantidade * Number(ci.order_item?.preco_unit || 0), 0);
              return (
                <tr key={c.id}>
                  <td data-label="Pedido">Nº {c.order?.numero_nota}</td>
                  <td data-label="Itens">
                    {(c.items || []).map(ci => {
                      const nome = ci.order_item?.product?.nome || <em style={{color: 'var(--burgundy)'}}>produto removido</em>;
                      return `${typeof nome === 'string' ? nome : '⚠ removido'} ×${ci.quantidade}`;
                    }).join(', ')}
                  </td>
                  <td className="num" data-label="Bruto">{fmt(bruto)}</td>
                  <td className="num" data-label="Líquido"><strong>{fmt(bruto * TRABALHADOR_PCT)}</strong></td>
                  <td data-label="Status"><span className={`badge ${c.status}`}>{statusLabel(c.status)}</span></td>
                  <td data-label="Prevista">{new Date(c.data_prevista_entrega).toLocaleString('pt-BR')}</td>
                  <td data-label="">
                    <div className="flex gap-1 wrap">
                      <Link className="btn ghost sm" to={`/pedidos/${c.order?.short_code || c.order?.id}`}>abrir</Link>
                      {c.status === 'pago' && c.public_code && (
                        <a className="btn ghost sm" href={`/r/${c.public_code}`} target="_blank" rel="noopener noreferrer"
                           aria-label={`Abrir recibo da produção do pedido Nº ${c.order?.numero_nota}`}>
                          📜 recibo
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
