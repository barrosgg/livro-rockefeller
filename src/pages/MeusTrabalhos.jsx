import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useWorkerPct } from '../lib/settings.jsx';
import { useLocalStorage } from '../lib/storage.js';
import { fmt, statusLabel } from '../lib/calc.js';

const STATUS_FILTROS = ['todos', 'em_producao', 'entregue', 'pago', 'cancelado'];

const STATUS_ICON = {
  em_producao: '⚙',
  entregue:    '⊠',
  pago:        '◆',
  cancelado:   '✕',
};

/** Devolve string da data + relativa + classe de urgência */
function fmtPrazo(d) {
  if (!d) return { text: '—', rel: '', cls: 'muted' };
  const date = new Date(d);
  const diffDays = Math.floor((new Date(d).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  const diffMs = date - new Date();
  const text = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
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

function inicial(nome) {
  if (!nome) return '?';
  const t = String(nome).trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

export default function MeusTrabalhos() {
  const { user } = useAuth();
  const TRABALHADOR_PCT = useWorkerPct();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useLocalStorage('meus-trabalhos:filtro', 'todos');

  useEffect(() => {
    if (!user) return;
    supabase.from('claims')
      .select('*, public_code, order:orders(id, short_code, numero_nota, cliente, status), items:claim_items(quantidade, order_item:order_items(preco_unit, product:products(nome, icon, categoria)))')
      .eq('trabalhador_id', user.id)
      .order('criado_em', { ascending: false })
      .then(({ data }) => { setClaims(data || []); setLoading(false); });
  }, [user]);

  // Calcula bruto/liquido pra cada claim uma vez só
  const enriched = useMemo(() => {
    return claims.map(c => {
      const bruto = (c.items || []).reduce((a, ci) =>
        a + ci.quantidade * Number(ci.order_item?.preco_unit || 0), 0);
      const liquido = bruto * TRABALHADOR_PCT;
      return { ...c, _bruto: bruto, _liquido: liquido };
    });
  }, [claims, TRABALHADOR_PCT]);

  const contagens = useMemo(() => {
    const c = { todos: enriched.length };
    for (const s of STATUS_FILTROS) if (s !== 'todos') c[s] = 0;
    enriched.forEach(cl => { c[cl.status] = (c[cl.status] || 0) + 1; });
    return c;
  }, [enriched]);

  // KPIs
  const kpis = useMemo(() => {
    const emProducao = enriched.filter(c => c.status === 'em_producao').length;
    const aguardando = enriched.filter(c => c.status === 'entregue');
    const aguardandoValor = aguardando.reduce((s, c) => s + c._liquido, 0);

    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const pagosMes = enriched.filter(c =>
      c.status === 'pago' && c.pago_em && new Date(c.pago_em) >= inicioMes);
    const recebidoMes = pagosMes.reduce((s, c) => s + c._liquido, 0);

    const recebidoTotal = enriched
      .filter(c => c.status === 'pago')
      .reduce((s, c) => s + c._liquido, 0);

    return {
      emProducao,
      aguardandoCount: aguardando.length,
      aguardandoValor,
      recebidoMes,
      recebidoTotal,
    };
  }, [enriched]);

  const lista = useMemo(() => {
    if (filtro === 'todos') return enriched;
    return enriched.filter(c => c.status === filtro);
  }, [enriched, filtro]);

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
      <div className="flex between center-y wrap gap-2">
        <div>
          <h1 className="mt-0">Meus Trabalhos</h1>
          <p className="muted mt-0">Histórico das produções que você assumiu, status e remuneração.</p>
        </div>
      </div>

      {claims.length > 0 && (
        <>
          {/* ---------- KPIs ---------- */}
          <div className="kpi-grid mt-2">
            <div className="kpi-card">
              <div className="kpi-icon">⚙</div>
              <div className="kpi-body">
                <div className="kpi-value">{kpis.emProducao}</div>
                <div className="kpi-label">em produção</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon">⊠</div>
              <div className="kpi-body">
                <div className="kpi-value">{fmt(kpis.aguardandoValor)}</div>
                <div className="kpi-label">a receber ({kpis.aguardandoCount})</div>
              </div>
            </div>
            <div className="kpi-card kpi-money">
              <div className="kpi-icon">◆</div>
              <div className="kpi-body">
                <div className="kpi-value">{fmt(kpis.recebidoMes)}</div>
                <div className="kpi-label">recebido no mês</div>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon">★</div>
              <div className="kpi-body">
                <div className="kpi-value">{fmt(kpis.recebidoTotal)}</div>
                <div className="kpi-label">total na fazenda</div>
              </div>
            </div>
          </div>

          {/* ---------- Filtros ---------- */}
          <div className="flex gap-1 wrap mt-2 filter-chips" role="tablist" aria-label="Filtrar trabalhos por status">
            {STATUS_FILTROS.map(s => (
              <button key={s}
                type="button"
                role="tab"
                aria-selected={filtro === s}
                className={`chip ${filtro === s ? 'active' : ''} ${s !== 'todos' ? `chip-${s}` : ''}`}
                onClick={() => setFiltro(s)}>
                {s !== 'todos' && <span className="chip-icon">{STATUS_ICON[s]}</span>}
                {s === 'todos' ? 'Todos' : statusLabel(s)}
                <span className="chip-count">{contagens[s] || 0}</span>
              </button>
            ))}
          </div>
        </>
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
              <th>Itens produzidos</th>
              <th className="num">Remuneração</th>
              <th>Status</th>
              <th>Entrega</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(c => {
              const prazo = fmtPrazo(c.data_prevista_entrega);
              const isPago = c.status === 'pago';
              return (
                <tr key={c.id} className={`pedido-row ${isPago ? 'row-pago' : ''} ${prazo.cls === 'overdue' && !isPago && c.status !== 'cancelado' ? 'row-overdue' : ''}`}>
                  <td data-label="Pedido">
                    <div className="client-cell">
                      <span className="client-initial" aria-hidden="true">{inicial(c.order?.cliente || c.order?.numero_nota)}</span>
                      <div className="client-info">
                        <div className="cell-num">
                          <span className="num-hash">Nº</span>
                          <span className="num-value">{c.order?.numero_nota}</span>
                        </div>
                        <div className="muted" style={{ fontSize: '.78rem', marginTop: 2 }}>
                          {c.order?.cliente || <em>sem cliente</em>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Itens">
                    <div className="claim-items">
                      {(c.items || []).map((ci, idx) => {
                        const nome = ci.order_item?.product?.nome;
                        return (
                          <span key={idx} className={`claim-item-chip ${!nome ? 'removed' : ''}`}>
                            {nome ? (
                              <>
                                <span className="chip-name">{nome}</span>
                                <span className="chip-qty">×{ci.quantidade}</span>
                              </>
                            ) : (
                              <span className="chip-name">⚠ removido ×{ci.quantidade}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="num" data-label="Remuneração">
                    <div className="remun-cell">
                      <div className="remun-liquido">{fmt(c._liquido)}</div>
                      <div className="remun-bruto">de {fmt(c._bruto)} bruto</div>
                    </div>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${c.status}`}>
                      <span className="badge-icon" aria-hidden="true">{STATUS_ICON[c.status]}</span>
                      {statusLabel(c.status)}
                    </span>
                  </td>
                  <td data-label="Entrega">
                    {c.data_prevista_entrega ? (
                      <div className={`prazo-cell prazo-${prazo.cls}`}>
                        <div className="prazo-date">{prazo.text}</div>
                        {prazo.rel && c.status !== 'pago' && c.status !== 'cancelado' && (
                          <div className="prazo-rel">{prazo.rel}</div>
                        )}
                      </div>
                    ) : <span className="muted">—</span>}
                  </td>
                  <td data-label="" className="cell-actions">
                    <div className="flex gap-1 wrap" style={{ justifyContent: 'flex-end' }}>
                      <Link className="btn-abrir" to={`/pedidos/${c.order?.short_code || c.order?.id}`}>
                        Abrir <span aria-hidden="true">→</span>
                      </Link>
                      {isPago && c.public_code && (
                        <a className="btn-recibo" href={`/r/${c.public_code}`} target="_blank" rel="noopener noreferrer"
                           aria-label={`Abrir recibo da produção do pedido Nº ${c.order?.numero_nota}`}>
                          📜 Recibo
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
