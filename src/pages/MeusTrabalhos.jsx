import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useWorkerPct } from '../lib/settings.jsx';
import { fmt, statusLabel } from '../lib/calc.js';

export default function MeusTrabalhos() {
  const { user } = useAuth();
  const TRABALHADOR_PCT = useWorkerPct();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('claims')
      .select('*, public_code, order:orders(id, short_code, numero_nota, cliente, status), items:claim_items(quantidade, order_item:order_items(preco_unit, product:products(nome)))')
      .eq('trabalhador_id', user.id)
      .order('criado_em', { ascending: false })
      .then(({ data }) => { setClaims(data || []); setLoading(false); });
  }, [user]);

  if (loading) return (
    <div className="page">
      <h1 className="mt-0">Meus Trabalhos</h1>
      <hr className="divider" />
      <div>
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
      <div className="divider" />
      {claims.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌾</div>
          <h3 className="mt-0">Nenhuma produção ainda</h3>
          <p className="muted">
            Vá em <strong>Pedidos</strong> e assuma sua primeira produção. O histórico e remuneração aparecem aqui.
          </p>
          <Link className="btn mt-2" to="/pedidos">Ver Pedidos disponíveis</Link>
        </div>
      ) : (
        <table className="book">
          <thead>
            <tr><th>Pedido</th><th>Itens</th><th>Bruto</th><th>Líquido ({(TRABALHADOR_PCT*100).toFixed(0)}%)</th><th>Status</th><th>Prevista</th><th></th></tr>
          </thead>
          <tbody>
            {claims.map(c => {
              const bruto = (c.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0);
              return (
                <tr key={c.id}>
                  <td>Nº {c.order?.numero_nota}</td>
                  <td>{(c.items || []).map(ci => `${ci.order_item.product.nome} ×${ci.quantidade}`).join(', ')}</td>
                  <td className="num">{fmt(bruto)}</td>
                  <td className="num"><strong>{fmt(bruto * TRABALHADOR_PCT)}</strong></td>
                  <td><span className={`badge ${c.status}`}>{statusLabel(c.status)}</span></td>
                  <td>{new Date(c.data_prevista_entrega).toLocaleString('pt-BR')}</td>
                  <td>
                    <div className="flex gap-1 wrap">
                      <Link className="btn ghost sm" to={`/pedidos/${c.order?.short_code || c.order?.id}`}>abrir</Link>
                      {c.status === 'pago' && c.public_code && (
                        <a className="btn ghost sm" href={`/r/${c.public_code}`} target="_blank" rel="noopener noreferrer">
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
