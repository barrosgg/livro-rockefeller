import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { statusLabel } from '../lib/calc.js';

const STATUS_FILTROS = ['todos','rascunho','aprovado','em_producao','entregue','pago','concluido','cancelado'];

export default function Pedidos() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'gerente' || profile?.role === 'proprietario';

  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [selecionados, setSelecionados] = useState(new Set());

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, short_code, numero_nota, cliente, status, prazo_entrega, criado_em')
      .order('criado_em', { ascending: false });
    if (!error) setPedidos(data || []);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

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
        (p.cliente || '').toLowerCase().includes(q) ||
        (p.short_code || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [pedidos, filtro, busca]);

  const toggleSel = (id) => {
    setSelecionados(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selecionados.size === lista.length) setSelecionados(new Set());
    else setSelecionados(new Set(lista.map(p => p.id)));
  };

  const selArr = useMemo(() => lista.filter(p => selecionados.has(p.id)), [lista, selecionados]);
  const podeAprovar = selArr.length > 0 && selArr.every(p => p.status === 'rascunho');
  const podeCancelar = selArr.length > 0 && selArr.every(p => !['concluido','cancelado'].includes(p.status));

  const aprovarLote = async () => {
    const semPrazo = selArr.filter(p => !p.prazo_entrega);
    if (semPrazo.length > 0) {
      alert(`${semPrazo.length} pedido(s) sem prazo definido. Defina o prazo antes de aprovar em lote.`);
      return;
    }
    if (!confirm(`Aprovar ${selArr.length} pedido(s)?`)) return;
    const ids = [...selecionados];
    const { error } = await supabase.from('orders').update({
      status: 'aprovado',
      aprovado_em: new Date().toISOString(),
    }).in('id', ids);
    if (error) alert(error.message); else { setSelecionados(new Set()); carregar(); }
  };

  const cancelarLote = async () => {
    if (!confirm(`Cancelar ${selArr.length} pedido(s)?`)) return;
    const ids = [...selecionados];
    const { error } = await supabase.from('orders').update({ status: 'cancelado' }).in('id', ids);
    if (error) alert(error.message); else { setSelecionados(new Set()); carregar(); }
  };

  return (
    <div className="page">
      <div className="flex between center-y wrap gap-2">
        <h1 className="mt-0">Pedidos</h1>
        <input
          type="text"
          placeholder="Buscar por número, cliente ou código…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ minWidth: 280, maxWidth: 320 }}
        />
      </div>

      <div className="flex gap-1 wrap mt-2">
        {STATUS_FILTROS.map(s => (
          <button key={s}
            className={`btn sm ${filtro === s ? '' : 'ghost'}`}
            onClick={() => setFiltro(s)}>
            {s === 'todos' ? 'Todos' : statusLabel(s)} · {contagens[s] || 0}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {isManager && selecionados.size > 0 && (
        <div className="card mt-2" style={{ background: '#fff', borderColor: 'var(--gold)' }}>
          <div className="flex between center-y wrap gap-1">
            <span className="small">
              <strong>{selecionados.size}</strong> selecionado(s)
            </span>
            <div className="flex gap-1">
              {podeAprovar && <button className="btn success sm" onClick={aprovarLote}>✓ Aprovar em lote</button>}
              {podeCancelar && <button className="btn danger sm" onClick={cancelarLote}>✕ Cancelar em lote</button>}
              <button className="btn ghost sm" onClick={() => setSelecionados(new Set())}>Limpar seleção</button>
            </div>
          </div>
        </div>
      )}

      <hr className="divider" />

      {loading ? <p className="muted">Carregando…</p> : lista.length === 0 ? (
        <div className="card center"><p className="muted it">Nenhum pedido encontrado.</p></div>
      ) : (
        <table className="book">
          <thead>
            <tr>
              {isManager && (
                <th style={{ width: 36 }}>
                  <input type="checkbox"
                    checked={selecionados.size === lista.length && lista.length > 0}
                    onChange={toggleAll} />
                </th>
              )}
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
              <tr key={p.id} style={selecionados.has(p.id) ? { background: 'rgba(176,141,61,.10)' } : null}>
                {isManager && (
                  <td>
                    <input type="checkbox"
                      checked={selecionados.has(p.id)}
                      onChange={() => toggleSel(p.id)} />
                  </td>
                )}
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
