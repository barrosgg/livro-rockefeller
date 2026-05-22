import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { statusLabel } from '../lib/calc.js';

const STATUS_ORDEM = ['aprovado','em_producao','entregue','pago','concluido','rascunho','cancelado'];

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, numero_nota, cliente, status, prazo_entrega, criado_em')
        .order('criado_em', { ascending: false });
      if (!error) setPedidos(data || []);
      setLoading(false);
    })();
  }, []);

  const lista = filtro === 'todos' ? pedidos : pedidos.filter(p => p.status === filtro);
  lista.sort((a,b) => STATUS_ORDEM.indexOf(a.status) - STATUS_ORDEM.indexOf(b.status));

  return (
    <div className="page">
      <div className="flex between center-y">
        <h1 className="mt-0">Pedidos</h1>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}>
          <option value="todos">Todos os status</option>
          {STATUS_ORDEM.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>
      <div className="divider" />
      {loading ? <p className="muted">Carregando…</p> : lista.length === 0 ? (
        <p className="muted">Nenhum pedido encontrado.</p>
      ) : (
        <table className="book">
          <thead>
            <tr><th>Nota</th><th>Cliente</th><th>Status</th><th>Prazo</th><th>Criado em</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map(p => (
              <tr key={p.id}>
                <td className="num">Nº {p.numero_nota}</td>
                <td>{p.cliente || <span className="muted">—</span>}</td>
                <td><span className={`badge ${p.status}`}>{statusLabel(p.status)}</span></td>
                <td>{p.prazo_entrega ? new Date(p.prazo_entrega).toLocaleString('pt-BR') : <span className="muted">—</span>}</td>
                <td>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                <td><Link className="btn ghost sm" to={`/pedidos/${p.id}`}>abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
