import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useUI } from '../lib/ui.jsx';
import { useLocalStorage } from '../lib/storage.js';
import { statusLabel } from '../lib/calc.js';

const STATUS_FILTROS = ['todos','rascunho','aprovado','em_producao','entregue','pago','concluido','cancelado'];

const STATUS_ICON = {
  rascunho: '✎',
  aprovado: '✓',
  em_producao: '⚙',
  entregue: '⊠',
  pago: '◆',
  concluido: '★',
  cancelado: '✕',
};

const STATUS_ATIVOS = ['aprovado','em_producao','entregue','pago'];

/** Devolve string da data + relativa + classe de urgência */
function fmtPrazo(d) {
  if (!d) return { text: '—', rel: '', cls: 'muted' };
  const date = new Date(d);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.floor((date.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  const text = new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  if (diffMs < 0) {
    const od = Math.abs(diffDays);
    return { text, rel: od === 0 ? 'atrasado' : `atrasado há ${od}d`, cls: 'overdue' };
  }
  if (diffDays === 0) return { text, rel: 'hoje', cls: 'urgent' };
  if (diffDays === 1) return { text, rel: 'amanhã', cls: 'warn' };
  if (diffDays <= 3) return { text, rel: `em ${diffDays}d`, cls: 'warn' };
  if (diffDays <= 7) return { text, rel: `em ${diffDays}d`, cls: 'soon' };
  return { text, rel: `em ${diffDays}d`, cls: '' };
}

/** Data de criação relativa */
function fmtCriado(d) {
  if (!d) return '—';
  const diffDays = Math.floor((new Date().setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 7) return `há ${diffDays}d`;
  if (diffDays < 30) return `há ${Math.floor(diffDays / 7)}sem`;
  return new Date(d).toLocaleDateString('pt-BR');
}

/** Primeira letra do nome do cliente em maiúscula */
function inicial(nome) {
  if (!nome) return '?';
  const t = String(nome).trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

export default function Pedidos() {
  const { profile } = useAuth();
  const { showToast, confirmar } = useUI() || {};
  const isManager = profile?.role === 'gerente' || profile?.role === 'proprietario';

  const [pedidos, setPedidos] = useState([]);
  const [balances, setBalances] = useState({}); // { order_id: { total, assumida, aberto } }
  const [filtro, setFiltro] = useLocalStorage('pedidos:filtro', 'todos');
  const [busca, setBusca] = useLocalStorage('pedidos:busca', '');
  const [ordem, setOrdem] = useLocalStorage('pedidos:ordem', { campo: 'criado_em', dir: 'desc' });
  const [loading, setLoading] = useState(true);
  const [selecionados, setSelecionados] = useState(new Set());

  // Status em que faz sentido mostrar progresso de produção
  const MOSTRA_PROGRESSO = new Set(['aprovado', 'em_producao', 'entregue', 'pago']);

  const trocarOrdem = (campo) => {
    setOrdem(o => o.campo === campo
      ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' }
      : { campo, dir: 'asc' });
  };
  const setaOrdem = (campo) => {
    if (ordem.campo !== campo) return '';
    return ordem.dir === 'asc' ? ' ↑' : ' ↓';
  };

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, short_code, numero_nota, cliente, status, prazo_entrega, criado_em')
      .order('criado_em', { ascending: false });
    if (!error) {
      setPedidos(data || []);
      // Busca saldos em aberto pra todos os pedidos da lista
      const ids = (data || []).map(p => p.id);
      if (ids.length > 0) {
        const { data: balData } = await supabase
          .from('order_item_balance')
          .select('order_id, quantidade_total, quantidade_assumida, quantidade_em_aberto')
          .in('order_id', ids);
        const grouped = {};
        for (const b of (balData || [])) {
          if (!grouped[b.order_id]) grouped[b.order_id] = { total: 0, assumida: 0, aberto: 0 };
          grouped[b.order_id].total    += Number(b.quantidade_total)    || 0;
          grouped[b.order_id].assumida += Number(b.quantidade_assumida) || 0;
          grouped[b.order_id].aberto   += Number(b.quantidade_em_aberto)|| 0;
        }
        setBalances(grouped);
      } else {
        setBalances({});
      }
    }
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const contagens = useMemo(() => {
    const c = { todos: pedidos.length };
    for (const s of STATUS_FILTROS) if (s !== 'todos') c[s] = 0;
    pedidos.forEach(p => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [pedidos]);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const ativos = pedidos.filter(p => STATUS_ATIVOS.includes(p.status)).length;
    const emAberto = Object.values(balances).reduce((s, b) => s + (b?.aberto || 0), 0);
    const agora = new Date();
    const atrasados = pedidos.filter(p =>
      p.prazo_entrega &&
      !['concluido','cancelado','pago'].includes(p.status) &&
      new Date(p.prazo_entrega) < agora
    ).length;
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const concluidosMes = pedidos.filter(p =>
      p.status === 'concluido' && new Date(p.criado_em) >= inicioMes
    ).length;
    return { ativos, emAberto, atrasados, concluidosMes };
  }, [pedidos, balances]);

  const lista = useMemo(() => {
    let arr = [...pedidos];
    if (filtro !== 'todos') arr = arr.filter(p => p.status === filtro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter(p =>
        (p.numero_nota || '').toLowerCase().includes(q) ||
        (p.cliente || '').toLowerCase().includes(q) ||
        (p.short_code || '').toLowerCase().includes(q)
      );
    }
    // Ordenacao
    const fator = ordem.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va = a[ordem.campo] ?? '';
      const vb = b[ordem.campo] ?? '';
      if (typeof va === 'string' && typeof vb === 'string') {
        return fator * va.localeCompare(vb, 'pt-BR');
      }
      return fator * ((va > vb ? 1 : va < vb ? -1 : 0));
    });
    return arr;
  }, [pedidos, filtro, busca, ordem]);

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
        <div className="search-wrap">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            type="text"
            placeholder="Buscar por número, cliente ou código…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="search-input"
          />
          {busca && (
            <button type="button" className="search-clear"
              aria-label="Limpar busca"
              onClick={() => setBusca('')}>✕</button>
          )}
        </div>
      </div>

      {/* ---------- KPIs ---------- */}
      <div className="kpi-grid mt-2">
        <div className="kpi-card">
          <div className="kpi-icon">⚙</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis.ativos}</div>
            <div className="kpi-label">em andamento</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">⊡</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis.emAberto}</div>
            <div className="kpi-label">unidades em aberto</div>
          </div>
        </div>
        <div className={`kpi-card ${kpis.atrasados > 0 ? 'danger' : ''}`}>
          <div className="kpi-icon">!</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis.atrasados}</div>
            <div className="kpi-label">atrasados</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">★</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis.concluidosMes}</div>
            <div className="kpi-label">concluídos no mês</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 wrap mt-2 filter-chips">
        {STATUS_FILTROS.map(s => (
          <button key={s}
            className={`chip ${filtro === s ? 'active' : ''} ${s !== 'todos' ? `chip-${s}` : ''}`}
            onClick={() => setFiltro(s)}>
            {s !== 'todos' && <span className="chip-icon">{STATUS_ICON[s]}</span>}
            {s === 'todos' ? 'Todos' : statusLabel(s)}
            <span className="chip-count">{contagens[s] || 0}</span>
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
              <th style={{ width: 90, cursor: 'pointer' }} onClick={() => trocarOrdem('numero_nota')}
                  aria-sort={ordem.campo === 'numero_nota' ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                Nº Nota{setaOrdem('numero_nota')}
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => trocarOrdem('cliente')}
                  aria-sort={ordem.campo === 'cliente' ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                Cliente{setaOrdem('cliente')}
              </th>
              <th style={{ width: 140, cursor: 'pointer' }} onClick={() => trocarOrdem('status')}
                  aria-sort={ordem.campo === 'status' ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                Status{setaOrdem('status')}
              </th>
              <th style={{ width: 170, cursor: 'pointer' }} onClick={() => trocarOrdem('prazo_entrega')}
                  aria-sort={ordem.campo === 'prazo_entrega' ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                Prazo{setaOrdem('prazo_entrega')}
              </th>
              <th style={{ width: 130, cursor: 'pointer' }} onClick={() => trocarOrdem('criado_em')}
                  aria-sort={ordem.campo === 'criado_em' ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                Criado{setaOrdem('criado_em')}
              </th>
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(p => {
              const prazo = fmtPrazo(p.prazo_entrega);
              return (
              <tr key={p.id} className={`pedido-row ${selecionados.has(p.id) ? 'selected' : ''} ${prazo.cls === 'overdue' ? 'row-overdue' : ''}`}>
                {isManager && (
                  <td data-label="Selecionar">
                    <input type="checkbox"
                      aria-label={`Selecionar pedido Nº ${p.numero_nota}`}
                      checked={selecionados.has(p.id)}
                      onChange={() => toggleSel(p.id)} />
                  </td>
                )}
                <td className="num cell-num" data-label="Nº Nota">
                  <span className="num-hash">Nº</span>
                  <span className="num-value">{p.numero_nota}</span>
                </td>
                <td data-label="Cliente">
                  <div className="client-cell">
                    <span className="client-initial" aria-hidden="true">{inicial(p.cliente)}</span>
                    <div className="client-info">
                      <div className="client-name">{p.cliente || <span className="muted">Sem cliente</span>}</div>
                      {MOSTRA_PROGRESSO.has(p.status) && balances[p.id] && balances[p.id].total > 0 && (() => {
                        const b = balances[p.id];
                        const pctAssumida = Math.min(100, Math.round((b.assumida / b.total) * 100));
                        const tudoAssumido = b.aberto === 0;
                        return (
                          <div
                            className="prod-progress"
                            aria-label={`${b.aberto} unidades em aberto de ${b.total} totais`}>
                            <div className="prod-progress-bar">
                              <div className="prod-progress-fill" style={{ width: pctAssumida + '%' }} />
                            </div>
                            <div className="prod-progress-text">
                              {tudoAssumido
                                ? <em>✓ Tudo assumido</em>
                                : <><strong>{b.aberto}</strong> em aberto · {b.total} total</>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </td>
                <td data-label="Status">
                  <span className={`badge ${p.status}`} title={statusLabel(p.status)}>
                    <span className="badge-icon" aria-hidden="true">{STATUS_ICON[p.status]}</span>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td data-label="Prazo">
                  {p.prazo_entrega ? (
                    <div className={`prazo-cell prazo-${prazo.cls}`}>
                      <div className="prazo-date">{prazo.text}</div>
                      {prazo.rel && <div className="prazo-rel">{prazo.rel}</div>}
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td data-label="Criado">
                  <div className="criado-cell">
                    <div className="criado-rel">{fmtCriado(p.criado_em)}</div>
                    <div className="criado-abs">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</div>
                  </div>
                </td>
                <td data-label="">
                  <Link className="btn-abrir" to={`/pedidos/${p.short_code || p.id}`} aria-label={`Abrir pedido ${p.numero_nota}`}>
                    Abrir <span aria-hidden="true">→</span>
                  </Link>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      )}
    </div>
  );
}
