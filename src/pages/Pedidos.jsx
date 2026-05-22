import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useUI } from '../lib/ui.jsx';
import { useLocalStorage } from '../lib/storage.js';
import { statusLabel } from '../lib/calc.js';

const STATUS_FILTROS = ['todos','rascunho','aprovado','em_producao','entregue','pago','concluido','cancelado'];

export default function Pedidos() {
  const { profile } = useAuth();
  const { showToast, confirmar } = useUI() || {};
  const isManager = profile?.role === 'gerente' || profile?.role === 'proprietario';

  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useLocalStorage('pedidos:filtro', 'todos');
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
      showToast?.(
        `${semPrazo.length} pedido(s) sem prazo definido. Abra cada um e defina o prazo antes de aprovar em lote.`,
        { type: 'error', duration: 5000 });
      return;
    }
    const ok = await confirmar?.(
      `${selArr.length} pedido(s) serão aprovados e enviados à produção.`,
      { title: 'Aprovar em lote?', confirmLabel: `Aprovar ${selArr.length}` });
    if (!ok) return;
    const ids = [...selecionados];
    const { error } = await supabase.from('orders').update({
      status: 'aprovado',
      aprovado_em: new Date().toISOString(),
    }).in('id', ids);
    if (error) showToast?.(error.message, { type: 'error' });
    else {
      showToast?.(`${selArr.length} pedido(s) aprovados.`, { type: 'success' });
      setSelecionados(new Set()); carregar();
    }
  };

  const cancelarLote = async () => {
    const ok = await confirmar?.(
      `${selArr.length} pedido(s) serão cancelados. Trabalhadores não poderão mais assumir produção destes pedidos.`,
      { title: 'Cancelar em lote?', danger: true, confirmLabel: `Cancelar ${selArr.length}` });
    if (!ok) return;
    const ids = [...selecionados];
    const { error } = await supabase.from('orders').update({ status: 'cancelado' }).in('id', ids);
    if (error) showToast?.(error.message, { type: 'error' });
    else {
      showToast?.(`${selArr.length} pedido(s) cancelados.`, { type: 'info' });
      setSelecionados(new Set()); carregar();
    }
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
        <div className="empty-state">
          <div className="empty-state-icon">📜</div>
          <h3 className="mt-0">Nenhum pedido encontrado</h3>
          <p className="muted">
            {busca || filtro !== 'todos'
              ? 'Tente outro filtro ou outra busca.'
              : isManager
                ? 'Comece criando um novo pedido para a Fazenda.'
                : 'Quando houver pedidos aprovados, eles aparecerão aqui.'}
          </p>
          {!busca && filtro === 'todos' && isManager && (
            <Link className="btn mt-2" to="/novo">Criar Novo Pedido</Link>
          )}
        </div>
      ) : (
        <table className="book responsive">
          <thead>
            <tr>
              {isManager && (
                <th style={{ width: 36 }}>
                  <input type="checkbox"
                    aria-label="Selecionar todos os pedidos"
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
                  <td data-label="Selecionar">
                    <input type="checkbox"
                      aria-label={`Selecionar pedido Nº ${p.numero_nota}`}
                      checked={selecionados.has(p.id)}
                      onChange={() => toggleSel(p.id)} />
                  </td>
                )}
                <td className="num" data-label="Nº Nota">Nº {p.numero_nota}</td>
                <td data-label="Cliente">{p.cliente || <span className="muted">—</span>}</td>
                <td data-label="Status"><span className={`badge ${p.status}`}>{statusLabel(p.status)}</span></td>
                <td data-label="Prazo">{p.prazo_entrega ? new Date(p.prazo_entrega).toLocaleString('pt-BR') : <span className="muted">—</span>}</td>
                <td data-label="Criado">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                <td data-label=""><Link className="btn ghost sm" to={`/pedidos/${p.short_code || p.id}`}>abrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
