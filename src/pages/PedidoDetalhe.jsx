import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { fmt, totalPedido, statusLabel, TRABALHADOR_PCT, COMISSAO_PCT } from '../lib/calc.js';

export default function PedidoDetalhe() {
  const { id } = useParams();
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [itens, setItens] = useState([]);
  const [balance, setBalance] = useState({});      // order_item_id -> em_aberto
  const [claims, setClaims] = useState([]);        // todos claims com itens + trabalhador
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const isManager = profile?.role === 'gerente' || profile?.role === 'proprietario';

  // ---- formulário de claim ----
  const [novoClaim, setNovoClaim] = useState({}); // order_item_id -> qtd
  const [dataPrevista, setDataPrevista] = useState('');
  const [criandoClaim, setCriandoClaim] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [p, oi, bal, cl] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).maybeSingle(),
      supabase.from('order_items').select('*, product:products(*)').eq('order_id', id),
      supabase.from('order_item_balance').select('*').eq('order_id', id),
      supabase.from('claims')
        .select('*, trabalhador:profiles!claims_trabalhador_id_fkey(*), items:claim_items(*, order_item:order_items(*, product:products(*)))')
        .eq('order_id', id)
        .order('criado_em'),
    ]);
    if (p.error) setErro(p.error.message);
    setPedido(p.data || null);
    setItens(oi.data || []);
    const map = {};
    (bal.data || []).forEach(b => { map[b.order_item_id] = b; });
    setBalance(map);
    setClaims(cl.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <div className="page">Carregando…</div>;
  if (!pedido) return <div className="page">Pedido não encontrado. <Link to="/pedidos">Voltar</Link></div>;

  const totais = totalPedido({
    itens: itens.map(i => ({ preco_unit: i.preco_unit, quantidade: i.quantidade })),
    desconto_pct: pedido.desconto_pct,
  });

  // ---- ações do gerente ----
  const aprovar = async () => {
    if (!pedido.prazo_entrega) { alert('Defina o prazo antes de aprovar.'); return; }
    const { error } = await supabase.from('orders').update({
      status: 'aprovado',
      aprovado_por: user.id,
      aprovado_em: new Date().toISOString(),
    }).eq('id', id);
    if (error) alert(error.message); else carregar();
  };

  const cancelar = async () => {
    if (!confirm('Cancelar este pedido?')) return;
    const { error } = await supabase.from('orders').update({ status: 'cancelado' }).eq('id', id);
    if (error) alert(error.message); else carregar();
  };

  // ---- claim (trabalhador) ----
  const totalClaimSelecionado = itens.reduce((acc, it) => {
    const q = Number(novoClaim[it.id] || 0);
    return acc + q * it.preco_unit;
  }, 0);

  const criarClaim = async () => {
    setErro(null);
    const escolhidos = itens
      .map(it => ({ order_item_id: it.id, quantidade: Number(novoClaim[it.id] || 0) }))
      .filter(x => x.quantidade > 0);
    if (escolhidos.length === 0) { setErro('Selecione ao menos 1 item.'); return; }
    if (!dataPrevista) { setErro('Informe a data prevista de entrega.'); return; }
    for (const e of escolhidos) {
      const aberto = balance[e.order_item_id]?.quantidade_em_aberto ?? 0;
      if (e.quantidade > aberto) { setErro(`Quantidade acima do saldo em aberto para um item.`); return; }
    }
    setCriandoClaim(true);
    const { data: claim, error: e1 } = await supabase.from('claims').insert({
      order_id: id,
      trabalhador_id: user.id,
      data_prevista_entrega: new Date(dataPrevista).toISOString(),
      status: 'em_producao',
    }).select().single();
    if (e1) { setErro(e1.message); setCriandoClaim(false); return; }
    const { error: e2 } = await supabase.from('claim_items').insert(
      escolhidos.map(e => ({ claim_id: claim.id, order_item_id: e.order_item_id, quantidade: e.quantidade }))
    );
    if (e2) { setErro(e2.message); setCriandoClaim(false); return; }

    // muda status do pedido para em_producao se ainda estava aprovado
    if (pedido.status === 'aprovado') {
      await supabase.from('orders').update({ status: 'em_producao' }).eq('id', id);
    }
    setNovoClaim({}); setDataPrevista(''); setCriandoClaim(false);
    carregar();
  };

  // ---- entrega (trabalhador) ----
  const marcarEntregue = async (claim) => {
    if (!confirm('Confirma a entrega no baú agora?')) return;
    const { error } = await supabase.from('claims').update({
      status: 'entregue',
      entregue_em: new Date().toISOString(),
    }).eq('id', claim.id);
    if (error) { alert(error.message); return; }
    // sobe pedido para 'entregue' se todos os itens claim cobrirem 100% e todos claims entregues
    await possivelAtualizarStatusPedido();
    carregar();
  };

  // ---- pagamento (gerente) ----
  const marcarPago = async (claim) => {
    if (!confirm('Marcar pagamento como efetuado?')) return;
    const { error } = await supabase.from('claims').update({
      status: 'pago',
      pago_em: new Date().toISOString(),
      pago_por: user.id,
    }).eq('id', claim.id);
    if (error) { alert(error.message); return; }
    await possivelAtualizarStatusPedido();
    carregar();
  };

  const possivelAtualizarStatusPedido = async () => {
    const { data: cls } = await supabase.from('claims').select('status').eq('order_id', id);
    if (!cls || cls.length === 0) return;
    const todosEntregues = cls.every(c => c.status === 'entregue' || c.status === 'pago');
    const todosPagos = cls.every(c => c.status === 'pago');
    // saldo em aberto?
    const { data: bal } = await supabase.from('order_item_balance').select('quantidade_em_aberto').eq('order_id', id);
    const saldo = (bal || []).reduce((a, b) => a + Number(b.quantidade_em_aberto), 0);
    if (saldo === 0 && todosPagos) {
      await supabase.from('orders').update({ status: 'concluido', concluido_em: new Date().toISOString() }).eq('id', id);
    } else if (saldo === 0 && todosEntregues) {
      await supabase.from('orders').update({ status: 'entregue' }).eq('id', id);
    }
  };

  const podeAssumir = ['aprovado', 'em_producao'].includes(pedido.status);

  return (
    <div className="page">
      <div className="flex between center-y">
        <div>
          <h1 className="mt-0">Pedido Nº {pedido.numero_nota}</h1>
          <p className="muted">
            Cliente: {pedido.cliente || '—'} · Criado em {new Date(pedido.criado_em).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-2 center-y">
          <span className={`badge ${pedido.status}`}>{statusLabel(pedido.status)}</span>
          {isManager && pedido.status === 'rascunho' && <button className="btn" onClick={aprovar}>Aprovar</button>}
          {isManager && pedido.status !== 'concluido' && pedido.status !== 'cancelado' &&
            <button className="btn danger" onClick={cancelar}>Cancelar</button>}
        </div>
      </div>
      <div className="divider" />

      {pedido.anotacoes && <p><em>{pedido.anotacoes}</em></p>}
      <p>
        Prazo: {pedido.prazo_entrega ? new Date(pedido.prazo_entrega).toLocaleString('pt-BR') : <span className="muted">não definido</span>}
      </p>

      <h2>Itens</h2>
      <table className="book">
        <thead>
          <tr><th>Produto</th><th>Pedido</th><th>Assumido</th><th>Em aberto</th><th>Preço</th><th>Subtotal</th>
            {podeAssumir && <th>Assumir qtd.</th>}
          </tr>
        </thead>
        <tbody>
          {itens.map(it => {
            const bal = balance[it.id] || { quantidade_total: it.quantidade, quantidade_assumida: 0, quantidade_em_aberto: it.quantidade };
            return (
              <tr key={it.id}>
                <td>{it.product?.nome}</td>
                <td className="num">{bal.quantidade_total}</td>
                <td className="num">{bal.quantidade_assumida}</td>
                <td className="num"><strong>{bal.quantidade_em_aberto}</strong></td>
                <td className="num">{fmt(it.preco_unit)}</td>
                <td className="num">{fmt(it.preco_unit * it.quantidade)}</td>
                {podeAssumir && (
                  <td className="num">
                    <input type="number" min="0" max={bal.quantidade_em_aberto} style={{ width: 80 }}
                      value={novoClaim[it.id] || ''} disabled={bal.quantidade_em_aberto === 0}
                      onChange={e => setNovoClaim(c => ({ ...c, [it.id]: e.target.value }))} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex between mt-2">
        <div />
        <div className="right">
          <div className="muted">Subtotal: <span className="num">{fmt(totais.subtotal)}</span></div>
          <div className="muted">Desconto ({pedido.desconto_pct}%): <span className="num">−{fmt(totais.desconto)}</span></div>
          <div><strong>Total: <span className="num">{fmt(totais.total)}</span></strong></div>
        </div>
      </div>

      {/* Formulário de claim */}
      {podeAssumir && (
        <>
          <div className="divider" />
          <h2>Assumir Produção</h2>
          <p className="muted">
            Você produzirá os itens marcados acima. A Fazenda retém {(COMISSAO_PCT*100).toFixed(0)}% de comissão;
            sua remuneração será {(TRABALHADOR_PCT*100).toFixed(0)}% do bruto.
          </p>
          <div className="row">
            <div className="field" style={{ flex: '1 1 260px' }}>
              <label>Data prevista de entrega</label>
              <input type="datetime-local" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
            </div>
            <div className="card" style={{ flex: '1 1 260px' }}>
              <div className="muted">Bruto da sua produção: <span className="num">{fmt(totalClaimSelecionado)}</span></div>
              <div className="muted">Comissão Fazenda ({(COMISSAO_PCT*100).toFixed(0)}%): <span className="num">−{fmt(totalClaimSelecionado * COMISSAO_PCT)}</span></div>
              <div><strong>Você receberá: <span className="num">{fmt(totalClaimSelecionado * TRABALHADOR_PCT)}</span></strong></div>
            </div>
          </div>
          <button className="btn" disabled={criandoClaim || totalClaimSelecionado === 0} onClick={criarClaim}>
            {criandoClaim ? 'Salvando…' : 'Confirmar Produção'}
          </button>
          {erro && <p style={{ color: 'var(--vermelho)' }}>{erro}</p>}
        </>
      )}

      {/* Lista de claims */}
      <div className="divider" />
      <h2>Trabalhadores na Produção</h2>
      {claims.length === 0 ? <p className="muted">Nenhum trabalhador assumiu itens ainda.</p> : (
        <div className="stack">
          {claims.map(c => {
            const bruto = (c.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0);
            const liquido = bruto * TRABALHADOR_PCT;
            const isOwnerClaim = c.trabalhador_id === user.id;
            return (
              <div key={c.id} className="card">
                <div className="flex between center-y">
                  <div>
                    <strong>{c.trabalhador?.nome_completo || c.trabalhador?.discord_handle || c.trabalhador_id}</strong>
                    <div className="muted" style={{ fontSize: '.85rem' }}>
                      ID {c.trabalhador?.identificacao} · Discord {c.trabalhador?.discord_handle} · Conta {c.trabalhador?.conta_bancaria}
                    </div>
                  </div>
                  <span className={`badge ${c.status}`}>{statusLabel(c.status)}</span>
                </div>
                <table className="book mt-2">
                  <thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Subtotal</th></tr></thead>
                  <tbody>
                    {(c.items || []).map(ci => (
                      <tr key={ci.id}>
                        <td>{ci.order_item.product?.nome}</td>
                        <td className="num">{ci.quantidade}</td>
                        <td className="num">{fmt(ci.order_item.preco_unit)}</td>
                        <td className="num">{fmt(ci.quantidade * Number(ci.order_item.preco_unit))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex between mt-2">
                  <div className="muted">
                    Prevista: {new Date(c.data_prevista_entrega).toLocaleString('pt-BR')}
                    {c.entregue_em && <> · Entregue: {new Date(c.entregue_em).toLocaleString('pt-BR')}</>}
                    {c.pago_em && <> · Pago: {new Date(c.pago_em).toLocaleString('pt-BR')}</>}
                  </div>
                  <div className="right">
                    <div className="muted">Bruto: <span className="num">{fmt(bruto)}</span></div>
                    <div><strong>Líquido: <span className="num">{fmt(liquido)}</span></strong></div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {isOwnerClaim && c.status === 'em_producao' && (
                    <button className="btn" onClick={() => marcarEntregue(c)}>Confirmar entrega no baú</button>
                  )}
                  {isManager && c.status === 'entregue' && (
                    <button className="btn" onClick={() => marcarPago(c)}>Marcar como Pago</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
