import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { statusLabel } from '../lib/calc.js';

const STATUS_FILTROS = ['todos','rascunho','aprovado','em_producao','entregue','pago','concluido','cancelado'];

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, short_code, numero_nota, cliente, status, prazo_entrega, criado_em')
        .order('criado_em', { ascending: false });
      if (!error) setPedidos(data || []);
      setLoading(false);
    })();
  }, []);

  const contagens = useMemo(() => {
    const c = { todos: pedidos.length };
    for (const s of STATUS_FILTROS) if (s !== 'todos') c[s] = 0;
    pedidos.forEach(p => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [pedidos]);

  const lista = useMemo(() => {
    let arr = pedidos;
    if (filtro !== 'todos') arr = arr.filter(p => p.status === filtro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter(p =>
        (p.numero_nota || '').toLowerCase().includes(q) ||
        (p.cliente || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [pedidos, filtro, busca]);

  return (
    <div className="page">
      <div className="flex between center-y wrap gap-2">
        <h1 className="mt-0">Pedidos</h1>
        <input
          type="text"
          placeholder="Buscar por número ou cliente…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ minWidth: 240 }}
        />
      </div>

      {/* Filtros como chips */}
      <div className="flex gap-1 wrap mt-2">
        {STATUS_FILTROS.map(s => (
          <button
            key={s}
            className={`btn sm ${filtro === s ? '' : 'ghost'}`}
            onClick={() => setFiltro(s)}
          >
            {s === 'todos' ? 'Todos' : statusLabel(s)} · {contagens[s] || 0}
          </button>
        ))}
      </div>

      <div className="divider" />

      {loading ? <p className="muted">Carregando…</p> : lista.length === 0 ? (
        <div className="card center"><p className="muted it">Nenhum pedido encontrado.</p></div>
      ) : (
        <table className="book">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Nº Nota</th>
              <th>Cliente</th>
              <th style={{ width: 140 }}>Status</th>
              <th style={{ width: 170 }}>Prazo</th>
              <th style={{ width: 130 }}>Criado</th>
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(p => (
              <tr key={p.id}>
                <td className="num">Nº {p.numero_nota}</td>
                <td>{p.cliente || <span className="muted">—</span>}</td>
                <td><span className={`badge ${p.status}`}>{statusLabel(p.status)}</span></td>
                <td>{p.prazo_entrega ? new Date(p.prazo_entrega).toLocaleString('pt-BR') : <span className="muted">—</span>}</td>
                <td>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                <td><Link className="btn ghost sm" to={`/pedidos/${p.short_code || p.id}`}>abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
