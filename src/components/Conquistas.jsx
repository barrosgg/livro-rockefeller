import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { BADGES } from '../lib/badges.js';
import { useWorkerPct } from '../lib/settings.jsx';
import { fmt } from '../lib/calc.js';

async function carregarStats(userId, workerPct) {
  const [meusClaimsRes, todosClaimsRes, profileRes] = await Promise.all([
    supabase.from('claims')
      .select('status, criado_em, entregue_em, pago_em, data_prevista_entrega, items:claim_items(quantidade, order_item:order_items(preco_unit))')
      .eq('trabalhador_id', userId),
    supabase.from('claims')
      .select('trabalhador_id, items:claim_items(quantidade, order_item:order_items(preco_unit))')
      .eq('status', 'pago'),
    supabase.from('profiles')
      .select('criado_em, badges_extras')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const meusClaims = meusClaimsRes.data || [];
  const todosClaimsPagos = todosClaimsRes.data || [];
  const profile = profileRes.data;

  const claimsPagos = meusClaims.filter(c => c.status === 'pago');
  const unidadesTotal = claimsPagos.reduce((a, c) =>
    a + (c.items || []).reduce((b, ci) => b + Number(ci.quantidade), 0), 0);
  const brutoTotal = claimsPagos.reduce((a, c) =>
    a + (c.items || []).reduce((b, ci) => b + ci.quantidade * Number(ci.order_item.preco_unit), 0), 0);
  const liquidoTotal = brutoTotal * workerPct;

  const entregasNoPrazo = claimsPagos.filter(c =>
    c.entregue_em && c.data_prevista_entrega &&
    new Date(c.entregue_em) <= new Date(c.data_prevista_entrega)
  ).length;

  // Ranking pelo bruto total entre todos trabalhadores
  const porTrab = new Map();
  todosClaimsPagos.forEach(c => {
    const bruto = (c.items || []).reduce((a, ci) => a + ci.quantidade * Number(ci.order_item.preco_unit), 0);
    porTrab.set(c.trabalhador_id, (porTrab.get(c.trabalhador_id) || 0) + bruto);
  });
  const ranking = [...porTrab.entries()].sort((a, b) => b[1] - a[1]);
  const idx = ranking.findIndex(([id]) => id === userId);
  const posicao_ranking = idx >= 0 ? idx + 1 : null;

  const dias_desde_inicio = profile?.criado_em
    ? Math.floor((Date.now() - new Date(profile.criado_em).getTime()) / 86400000)
    : 0;

  return {
    claims_total: claimsPagos.length,
    unidades_total: unidadesTotal,
    bruto_total: brutoTotal,
    liquido_total: liquidoTotal,
    entregas_no_prazo: entregasNoPrazo,
    posicao_ranking,
    dias_desde_inicio,
    badges_extras: profile?.badges_extras || [],
  };
}

export default function Conquistas({ userId }) {
  const [stats, setStats] = useState(null);
  const workerPct = useWorkerPct();

  useEffect(() => {
    if (!userId) return;
    carregarStats(userId, workerPct).then(setStats);
  }, [userId, workerPct]);

  if (!stats) {
    return <div className="card"><p className="muted it small mt-0">Calculando suas conquistas…</p></div>;
  }

  const extras = stats.badges_extras || [];
  const desbloqueada = (b) => b.check(stats) || extras.includes(b.id);
  const conquistadas = BADGES.filter(desbloqueada);
  const pendentes = BADGES.filter(b => !desbloqueada(b));

  return (
    <div>
      {/* KPIs em destaque */}
      <div className="grid-3 mt-0">
        <div className="stat">
          <div className="label">Produções concluídas</div>
          <div className="value">{stats.claims_total}</div>
          <div className="hint">claims pagos no histórico</div>
        </div>
        <div className="stat">
          <div className="label">Unidades produzidas</div>
          <div className="value">{stats.unidades_total.toLocaleString('pt-BR')}</div>
          <div className="hint">itens totais entregues</div>
        </div>
        <div className="stat accent">
          <div className="label">Total recebido</div>
          <div className="value">{fmt(stats.liquido_total)}</div>
          <div className="hint">líquido acumulado · bruto {fmt(stats.bruto_total)}</div>
        </div>
      </div>

      <div className="grid-3 mt-2">
        <div className="stat">
          <div className="label">Entregas no prazo</div>
          <div className="value">{stats.entregas_no_prazo}</div>
          <div className="hint">claims entregues dentro da data prevista</div>
        </div>
        <div className="stat">
          <div className="label">Posição na Fazenda</div>
          <div className="value">{stats.posicao_ranking ? `${stats.posicao_ranking}º` : '—'}</div>
          <div className="hint">ranking por valor produzido</div>
        </div>
        <div className="stat">
          <div className="label">Dias na Fazenda</div>
          <div className="value">{stats.dias_desde_inicio}</div>
          <div className="hint">desde sua admissão</div>
        </div>
      </div>

      {/* Grade de conquistas */}
      <h2 className="mt-3">Conquistas ({conquistadas.length}/{BADGES.length})</h2>
      <div className="conquistas-grid">
        {conquistadas.map(b => (
          <div key={b.id} className="conquista" title={b.desc}>
            <div className="conquista-emoji">{b.emoji}</div>
            <div className="conquista-nome">{b.nome}</div>
            <div className="conquista-desc">{b.desc}</div>
          </div>
        ))}
        {pendentes.map(b => (
          <div key={b.id} className="conquista locked" title={`Bloqueado: ${b.desc}`}>
            <div className="conquista-emoji">🔒</div>
            <div className="conquista-nome">{b.nome}</div>
            <div className="conquista-desc">{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
