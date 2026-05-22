import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { useLocalStorage } from '../lib/storage.js';
import { useCommissionPct, useWorkerPct } from '../lib/settings.jsx';
import { useUI } from '../lib/ui.jsx';
import { fmt, totalPedido, statusLabel } from '../lib/calc.js';
import StatusTimeline from '../components/StatusTimeline.jsx';
import Avatar from '../components/Avatar.jsx';
import ProductIcon from '../components/ProductIcon.jsx';

function Toast({ message, type='ok', onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return <div className={`toast ${type === 'err' ? 'error' : ''}`}>{message}</div>;
}

// Reconhece UUID (36 chars com hífens) vs short_code (6+ alfanumérico)
const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export default function PedidoDetalhe() {
  const { id: param } = useParams();
  const { profile, user } = useAuth();
  const COMISSAO_PCT = useCommissionPct();
  const TRABALHADOR_PCT = useWorkerPct();
  const { confirmar } = useUI() || {};

  const [pedido, setPedido] = useState(null);
  const [itens, setItens] = useState([]);
  const [balance, setBalance] = useState({});
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [toast, setToast] = useState(null);

  const isManager = profile?.role === 'gerente' || profile?.role === 'proprietario';

  /* Rascunho do "começar a produzir" persistente por pedido */
  const [draftClaim, setDraftClaim, limparDraftClaim] = useLocalStorage(
    `draft:claim:${param}`,
    () => ({ quantidades: {}, dataPrevista: '' })
  );
  const novoClaim = draftClaim.quantidades || {};
  const setNovoClaim = (next) => setDraftClaim(d => ({
    ...d,
    quantidades: typeof next === 'function' ? next(d.quantidades || {}) : next,
  }));
  const dataPrevista = draftClaim.dataPrevista || '';
  const setDataPrevista = (v) => setDraftClaim(d => ({ ...d, dataPrevista: v }));
  const [criandoClaim, setCriandoClaim] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      // Aceita UUID OU short_code no path. Se um falhar, tenta o outro.
      let p;
      if (isUuid(param)) {
        p = await supabase.from('orders').select('*').eq('id', param).maybeSingle();
      } else {
        p = await supabase.from('orders').select('*').eq('short_code', param).maybeSingle();
        // fallback: alguns dados antigos podem ter id que coincida
        if (!p.data && !p.error) {
          p = await supabase.from('orders').select('*').eq('id', param).maybeSingle();
        }
      }
      if (p.error) {
        console.error('Erro buscando pedido:', p.error);
        setErro(p.error.message);
        setPedido(null);
        setLoading(false);
        return;
      }
      const orderId = p.data?.id;
      if (!orderId) {
        setPedido(null);
        setLoading(false);
        return;
      }
      const [oi, bal, cl] = await Promise.all([
        supabase.from('order_items').select('*, product:products(*)').eq('order_id', orderId),
        supabase.from('order_item_balance').select('*').eq('order_id', orderId),
        supabase.from('claims')
          .select('*, trabalhador:profiles!claims_trabalhador_id_fkey(*), items:claim_items(*, order_item:order_items(*, product:products(*)))')
          .eq('order_id', orderId)
          .order('criado_em'),
      ]);
      if (p.error) setErro(p.error.message);
      setPedido(p.data || null);
      setItens(oi.data || []);
      const map = {};
      (bal.data || []).forEach(b => { map[b.order_item_id] = b; });
      setBalance(map);
      setClaims(cl.data || []);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [param]);

  useEffect(() => { carregar(); }, [carregar]);

  const agg = useMemo(() => {
    const totais = totalPedido({
      itens: itens.map(i => ({ preco_unit: i.preco_unit, quantidade: i.quantidade })),
      desconto_pct: pedido?.desconto_pct || 0,
    });
    const qtdTotal = itens.reduce((a, i) => a + i.quantidade, 0);
    const qtdAssumida = Object.values(balance).reduce((a, b) => a + Number(b.quantidade_assumida || 0), 0);
    const qtdAberto = Object.values(balance).reduce((a, b) => a + Number(b.quantidade_em_aberto || 0), 0);
    const pctAssumido = qtdTotal > 0 ? (qtdAssumida / qtdTotal) * 100 : 0;
    return { ...totais, qtdTotal, qtdAssumida, qtdAberto, pctAssumido };
  }, [itens, balance, pedido]);

  if (loading) return <div className="page">Carregando…</div>;
  if (!pedido) return <div className="page">Pedido não encontrado. <Link to="/pedidos">Voltar</Link></div>;

  const orderId = pedido.id;

  const aprovar = async () => {
    if (!pedido.prazo_entrega) { setToast({ type: 'err', msg: 'Defina o prazo antes de aprovar.' }); return; }
    const { error } = await supabase.from('orders').update({
      status: 'aprovado',
      aprovado_por: user.id,
      aprovado_em: new Date().toISOString(),
    }).eq('id', orderId);
    if (error) setToast({ type: 'err', msg: error.message });
    else { setToast({ msg: 'Pedido aprovado.' }); carregar(); }
  };
  const cancelar = async () => {
    const ok = await confirmar?.(
      'Este pedido será cancelado. Trabalhadores não poderão mais assumir produção.',
      { title: 'Cancelar pedido?', danger: true, confirmLabel: 'Cancelar pedido' });
    if (!ok) return;
    const { error } = await supabase.from('orders').update({ status: 'cancelado' }).eq('id', orderId);
    if (error) setToast({ type: 'err', msg: error.message });
    else { setToast({ msg: 'Pedido cancelado.' }); carregar(); }
  };

  const totalClaimSelecionado = itens.reduce((acc, it) => acc + Number(novoClaim[it.id] || 0) * it.preco_unit, 0);

  const criarClaim = async () => {
    setErro(null);
    const escolhidos = itens
      .map(it => ({ order_item_id: it.id, quantidade: Number(novoClaim[it.id] || 0) }))
      .filter(x => x.quantidade > 0);
    if (escolhidos.length === 0) { setErro('Selecione ao menos 1 produto que você vai produzir.'); return; }
    if (!dataPrevista) { setErro('Informe quando você pretende entregar no baú.'); return; }
    for (const e of escolhidos) {
      const aberto = balance[e.order_item_id]?.quantidade_em_aberto ?? 0;
      if (e.quantidade > aberto) { setErro('Você marcou mais unidades do que ainda está em aberto.'); return; }
    }

    setCriandoClaim(true);
    try {
      const { data: claim, error: e1 } = await supabase.from('claims').insert({
        order_id: orderId,
        trabalhador_id: user.id,
        data_prevista_entrega: new Date(dataPrevista).toISOString(),
        status: 'em_producao',
      }).select().single();
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('claim_items').insert(
        escolhidos.map(e => ({ claim_id: claim.id, order_item_id: e.order_item_id, quantidade: e.quantidade }))
      );
      if (e2) throw e2;

      if (pedido.status === 'aprovado') {
        await supabase.from('orders').update({ status: 'em_producao' }).eq('id', orderId);
      }
      limparDraftClaim();
      setToast({ msg: 'Produção iniciada! Bom trabalho.' });
      await carregar();
    } catch (e) {
      console.error('Erro criar claim:', e);
      setErro(e.message || 'Não foi possível registrar. Tente novamente.');
    } finally {
      setCriandoClaim(false);
    }
  };

  const marcarEntregue = async (claim) => {
    const ok = await confirmar?.(
      'Esta ação registra a entrega no baú agora e notifica os gerentes para liberar o pagamento.',
      { title: 'Confirmar entrega no baú?', confirmLabel: 'Sim, entreguei' });
    if (!ok) return;
    const { error } = await supabase.from('claims').update({
      status: 'entregue', entregue_em: new Date().toISOString(),
    }).eq('id', claim.id);
    if (error) { setToast({ type: 'err', msg: error.message }); return; }
    await possivelAtualizarStatusPedido();
    setToast({ msg: 'Entrega registrada.' });
    carregar();
  };

  const marcarPago = async (claim) => {
    const ok = await confirmar?.(
      'O pagamento será registrado como efetuado. Esta ação pode ser usada para gerar o recibo.',
      { title: 'Confirmar pagamento?', confirmLabel: 'Pagamento efetuado' });
    if (!ok) return;
    const { error } = await supabase.from('claims').update({
      status: 'pago', pago_em: new Date().toISOString(), pago_por: user.id,
    }).eq('id', claim.id);
    if (error) { setToast({ type: 'err', msg: error.message }); return; }
    await possivelAtualizarStatusPedido();
    setToast({ msg: 'Pagamento registrado.' });
    carregar();
  };

  const possivelAtualizarStatusPedido = async () => {
    const { data: cls } = await supabase.from('claims').select('status').eq('order_id', orderId);
    if (!cls || cls.length === 0) return;
    const todosEntregues = cls.every(c => c.status === 'entregue' || c.status === 'pago');
    const todosPagos = cls.every(c => c.status === 'pago');
    const { data: bal } = await supabase.from('order_item_balance').select('quantidade_em_aberto').eq('order_id', orderId);
    const saldo = (bal || []).reduce((a, b) => a + Number(b.quantidade_em_aberto), 0);
    if (saldo === 0 && todosPagos) {
      await supabase.from('orders').update({ status: 'concluido', concluido_em: new Date().toISOString() }).eq('id', orderId);
    } else if (saldo === 0 && todosEntregues) {
      await supabase.from('orders').update({ status: 'entregue' }).eq('id', orderId);
    }
  };

  const contratoAssinado = !!profile?.contrato_assinado_em;
  const podeAssumir = ['aprovado', 'em_producao'].includes(pedido.status)
    && agg.qtdAberto > 0
    && contratoAssinado;
  const precisaAssinarContrato = ['aprovado', 'em_producao'].includes(pedido.status)
    && agg.qtdAberto > 0
    && !contratoAssinado;
  const urlPedido = `${window.location.origin}/pedidos/${pedido.short_code || pedido.id}`;
  const urlPublico = pedido.public_code
    ? `${window.location.origin}/p/${pedido.public_code}`
    : null;

  const mensagemDiscord = () => {
    const linhas = [
      `📜 **Pedido Nº ${pedido.numero_nota}** — Fazenda Rockefeller`,
      pedido.cliente ? `Cliente: **${pedido.cliente}**` : null,
      `Prazo: **${pedido.prazo_entrega ? new Date(pedido.prazo_entrega).toLocaleString('pt-BR') : 'a definir'}**`,
      `Total: **${fmt(agg.total)}** · Restam **${agg.qtdAberto}/${agg.qtdTotal}** unidades para produzir`,
      '',
      '**Itens em aberto:**',
      ...itens
        .filter(it => (balance[it.id]?.quantidade_em_aberto || 0) > 0)
        .map(it => `• ${it.product.nome} — ${balance[it.id]?.quantidade_em_aberto}× a ${fmt(it.preco_unit)}`),
      '',
      `💰 Quem produz recebe **${(TRABALHADOR_PCT*100).toFixed(0)}%** do bruto.`,
      `👉 Começar a produção: ${urlPedido}`,
      urlPublico ? `🔎 Acompanhamento do cliente: ${urlPublico}` : null,
    ];
    return linhas.filter(Boolean).join('\n');
  };

  const copiar = async (texto, msg) => {
    try {
      await navigator.clipboard.writeText(texto);
      setToast({ msg });
    } catch {
      setToast({ type: 'err', msg: 'Não foi possível copiar.' });
    }
  };

  return (
    <div className="page">
      <div className="flex between center-y wrap gap-2">
        <div>
          <Link to="/pedidos" className="muted small">← Pedidos</Link>
          <h1 className="mt-1">Pedido Nº {pedido.numero_nota}</h1>
          <p className="muted small mt-0">
            {pedido.cliente ? <>Cliente <strong>{pedido.cliente}</strong> · </> : null}
            Criado em {new Date(pedido.criado_em).toLocaleString('pt-BR')}
            {pedido.prazo_entrega && <> · Prazo <strong>{new Date(pedido.prazo_entrega).toLocaleString('pt-BR')}</strong></>}
          </p>
        </div>
        <div className="flex gap-1 center-y wrap">
          <span className={`badge ${pedido.status}`}>{statusLabel(pedido.status)}</span>
          <button type="button" aria-label="Copiar link interno do pedido" className="btn ghost sm" onClick={() => copiar(urlPedido, 'Link interno copiado.')}>📎 Link</button>
          <button type="button" aria-label="Copiar mensagem formatada para Discord" className="btn ghost sm" onClick={() => copiar(mensagemDiscord(), 'Mensagem Discord copiada.')}>💬 Discord</button>
          {urlPublico && (
            <button type="button" aria-label="Copiar link público para o cliente" className="btn ghost sm" onClick={() => copiar(urlPublico, 'Link público do cliente copiado.')}>
              👁 Link p/ Cliente
            </button>
          )}
          {isManager && pedido.status === 'rascunho' && <button className="btn success sm" onClick={aprovar}>Aprovar</button>}
          {isManager && !['concluido','cancelado'].includes(pedido.status) &&
            <button className="btn danger sm" onClick={cancelar}>Cancelar</button>}
        </div>
      </div>

      {/* ---------- Timeline ---------- */}
      <div className="card mt-2" style={{ background: 'var(--page-soft)' }}>
        <StatusTimeline pedido={pedido} claims={claims} />
      </div>

      {pedido.anotacoes && (
        <div className="card mt-2" style={{ background: 'rgba(234,217,160,.25)', borderStyle: 'dashed' }}>
          <span className="muted small">Anotações:</span> {pedido.anotacoes}
        </div>
      )}

      {/* ---------- Notas internas (só gerente/proprietário) ---------- */}
      {isManager && <NotasInternas orderId={orderId} initial={pedido.notas_internas || ''} onSaved={carregar} />}

      {/* ---------- KPIs ---------- */}
      <div className="grid-3 mt-3">
        <div className="stat">
          <div className="label">Progresso da produção</div>
          <div className="value">{agg.pctAssumido.toFixed(0)}%</div>
          <div className="hint">{agg.qtdAssumida} de {agg.qtdTotal} unidades já em produção</div>
        </div>
        <div className="stat">
          <div className="label">Restam para produzir</div>
          <div className="value">{agg.qtdAberto}</div>
          <div className="hint">{itens.length} produto(s) no pedido</div>
        </div>
        <div className="stat accent">
          <div className="label">Valor total</div>
          <div className="value">{fmt(agg.total)}</div>
          <div className="hint">Subtotal {fmt(agg.subtotal)} · Desconto −{fmt(agg.desconto)}</div>
        </div>
      </div>

      {/* ---------- Tabela de itens ---------- */}
      <h2 className="mt-3">Lista de Produtos</h2>
      <table className="book">
        <thead>
          <tr>
            <th>Produto</th>
            <th className="num">Pedido</th>
            <th className="num">Em produção</th>
            <th className="num">Falta produzir</th>
            <th className="num">Preço unit.</th>
            <th className="num">Subtotal</th>
            {podeAssumir && <th className="num">Eu vou produzir</th>}
          </tr>
        </thead>
        <tbody>
          {itens.map(it => {
            const bal = balance[it.id] || { quantidade_total: it.quantidade, quantidade_assumida: 0, quantidade_em_aberto: it.quantidade };
            const aberto = Number(bal.quantidade_em_aberto);
            return (
              <tr key={it.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ProductIcon slug={it.product?.icon} name={it.product?.nome} size={24} />
                    <div>
                      <div>{it.product?.nome}</div>
                      <div className="muted small">{it.product?.categoria}</div>
                    </div>
                  </div>
                </td>
                <td className="num">{bal.quantidade_total}</td>
                <td className="num">{bal.quantidade_assumida}</td>
                <td className="num"><strong style={{ color: aberto > 0 ? 'var(--ouro-prof)' : 'var(--verde-livro)' }}>{aberto}</strong></td>
                <td className="num">{fmt(it.preco_unit)}</td>
                <td className="num">{fmt(it.preco_unit * it.quantidade)}</td>
                {podeAssumir && (
                  <td className="num">
                    {aberto > 0 ? (
                      <input type="number" min="0" max={aberto} style={{ width: 80 }}
                        value={novoClaim[it.id] || ''}
                        placeholder="0"
                        onChange={e => {
                          const v = Math.min(aberto, Math.max(0, Number(e.target.value) || 0));
                          setNovoClaim(c => ({ ...c, [it.id]: v }));
                        }} />
                    ) : <span className="muted small">completo</span>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ---------- Aviso: precisa assinar contrato ---------- */}
      {precisaAssinarContrato && (
        <div className="card mt-3" style={{
          background: 'rgba(132,36,25,.08)',
          borderColor: 'var(--burgundy)',
        }}>
          <h3 className="mt-0" style={{ color: 'var(--burgundy)' }}>⚠ Contrato pendente</h3>
          <p className="mt-0">
            Para assumir a produção de pedidos da Fazenda, você precisa primeiro
            <strong> assinar o contrato de prestação de serviços</strong>.
          </p>
          <Link to="/perfil" className="btn danger">Ir para o Contrato</Link>
        </div>
      )}

      {/* ---------- Formulário Começar a produção ---------- */}
      {podeAssumir && (
        <div className="card mt-3" style={{ borderColor: 'var(--ouro-medio)' }}>
          <h3 className="mt-0">Quero começar a produzir</h3>
          <p className="muted small mt-0">
            1. Na tabela acima, escreva quantas unidades de cada produto <strong>você</strong> vai produzir.<br />
            2. Aqui embaixo, escolha a data em que pretende entregar tudo no baú.<br />
            3. Confira sua remuneração e confirme.
          </p>
          <p className="muted small">
            A Fazenda retém {(COMISSAO_PCT*100).toFixed(0)}% de comissão · você recebe {(TRABALHADOR_PCT*100).toFixed(0)}% do bruto.
          </p>
          <div className="row mt-2">
            <div className="field" style={{ flex: '1 1 260px' }}>
              <label>Quando você vai entregar no baú?</label>
              <input type="datetime-local" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
            </div>
            <div className="stat" style={{ flex: '1 1 240px' }}>
              <div className="label">Você vai receber</div>
              <div className="value" style={{ color: 'var(--verde-livro)' }}>{fmt(totalClaimSelecionado * TRABALHADOR_PCT)}</div>
              <div className="hint">Bruto {fmt(totalClaimSelecionado)} · Comissão Fazenda −{fmt(totalClaimSelecionado * COMISSAO_PCT)}</div>
            </div>
          </div>
          <button className="btn lg" disabled={criandoClaim || totalClaimSelecionado === 0} onClick={criarClaim}>
            {criandoClaim ? 'Salvando…' : '✔ Começar a Produzir'}
          </button>
          {erro && <p className="mt-2" style={{ color: 'var(--vermelho)' }}>{erro}</p>}
        </div>
      )}

      {/* ---------- Trabalhadores na produção ---------- */}
      <h2 className="mt-3">Quem está produzindo ({claims.length})</h2>
      {claims.length === 0 ? (
        <div className="card"><p className="muted it small mt-0">
          Ninguém assumiu nenhum item ainda. Use o botão <strong>💬 Discord</strong> no topo para chamar a galera.
        </p></div>
      ) : (
        <div className="stack">
          {claims.map(c => {
            const bruto = (c.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0);
            const liquido = bruto * TRABALHADOR_PCT;
            const isOwnerClaim = c.trabalhador_id === user.id;
            return (
              <div key={c.id} className="card">
                <div className="flex between center-y wrap gap-2">
                  <div className="flex gap-2 center-y">
                    <Avatar slug={c.trabalhador?.avatar} name={c.trabalhador?.nome_completo} size={44} />
                    <div>
                      <strong>{c.trabalhador?.nome_completo || c.trabalhador?.discord_handle}</strong>
                      <div className="muted small">
                        ID {c.trabalhador?.identificacao} · Conta {c.trabalhador?.conta_bancaria}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 center-y wrap">
                    <span className={`badge ${c.status}`}>{statusLabel(c.status)}</span>
                    {isOwnerClaim && c.status === 'em_producao' && (
                      <button className="btn success sm" onClick={() => marcarEntregue(c)}>✔ Entreguei no baú</button>
                    )}
                    {isManager && c.status === 'entregue' && (
                      <button className="btn sm" onClick={() => marcarPago(c)}>💰 Confirmar Pagamento</button>
                    )}
                    {c.status === 'pago' && c.public_code && (
                      <a className="btn ghost sm" href={`/r/${c.public_code}`} target="_blank" rel="noopener noreferrer">
                        📜 Recibo
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-2" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {(c.items || []).map(ci => (
                    <span key={ci.id} className="badge" style={{ background: 'var(--page-edge)', color: 'var(--tinta)', border: '1px solid var(--ouro-medio)' }}>
                      {ci.order_item.product?.nome} ×{ci.quantidade}
                    </span>
                  ))}
                </div>

                <div className="flex between center-y wrap mt-2 small">
                  <div className="muted">
                    Prevista: {new Date(c.data_prevista_entrega).toLocaleString('pt-BR')}
                    {c.entregue_em && <> · Entregue: {new Date(c.entregue_em).toLocaleString('pt-BR')}</>}
                    {c.pago_em && <> · Pago: {new Date(c.pago_em).toLocaleString('pt-BR')}</>}
                  </div>
                  <div className="right">
                    <span className="muted">Bruto {fmt(bruto)} · </span>
                    <strong style={{ color: 'var(--verde-livro)' }}>Líquido {fmt(liquido)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Toast message={toast?.msg} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}

/* ---------- Notas internas (gerente/proprietário) ---------- */
function NotasInternas({ orderId, initial, onSaved }) {
  const [val, setVal] = useState(initial || '');
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useUI() || {};

  useEffect(() => { setVal(initial || ''); }, [initial]);

  const salvar = async () => {
    setSaving(true);
    const { error } = await supabase.from('orders').update({ notas_internas: val || null }).eq('id', orderId);
    setSaving(false);
    if (error) { showToast?.(error.message, { type: 'error' }); return; }
    setEdit(false);
    showToast?.('Notas internas salvas.', { type: 'success' });
    onSaved?.();
  };

  return (
    <div className="card mt-2" style={{ background: 'rgba(132,36,25,.06)', borderColor: 'rgba(132,36,25,.3)' }}>
      <div className="flex between center-y">
        <span className="muted small">
          🔒 <strong>Notas internas</strong> (só gerentes/proprietário veem)
        </span>
        {!edit && <button className="btn ghost sm" onClick={() => setEdit(true)}>{val ? 'editar' : 'adicionar'}</button>}
      </div>
      {edit ? (
        <>
          <textarea value={val} onChange={e => setVal(e.target.value)} maxLength={500}
            placeholder="Anotações privadas — combustível pra decisões internas, contexto do cliente, ressalvas…"
            style={{ marginTop: 8 }} />
          <div className="flex gap-1 mt-1">
            <button className="btn sm" disabled={saving} onClick={salvar}>Salvar</button>
            <button className="btn ghost sm" onClick={() => { setVal(initial || ''); setEdit(false); }}>Cancelar</button>
          </div>
        </>
      ) : (
        val ? <p className="mt-1" style={{ whiteSpace: 'pre-wrap' }}>{val}</p>
            : <p className="muted it small mt-1">Sem notas internas.</p>
      )}
    </div>
  );
}
