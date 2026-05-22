/* Timeline visual do ciclo de vida do pedido.
   Recebe o pedido (com status, aprovado_em, concluido_em) e os claims (para inferir
   se já houve entrega/pagamento). */

const ETAPAS = [
  { key: 'rascunho',    label: 'Orçamento' },
  { key: 'aprovado',    label: 'Aprovado' },
  { key: 'em_producao', label: 'Em Produção' },
  { key: 'entregue',    label: 'Entregue' },
  { key: 'pago',        label: 'Pagamento' },
  { key: 'concluido',   label: 'Concluído' },
];

const ORDEM_STATUS = ['rascunho','aprovado','em_producao','entregue','pago','concluido'];

function fmtData(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR') + ' ' +
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function StatusTimeline({ pedido, claims = [] }) {
  if (pedido?.status === 'cancelado') {
    return (
      <div className="timeline">
        <div className="step cancelado">
          <div className="dot">✕</div>
          <div className="label">Pedido Cancelado</div>
        </div>
      </div>
    );
  }

  const statusAtual = pedido?.status || 'rascunho';
  const idxAtual = ORDEM_STATUS.indexOf(statusAtual);

  // Inferir datas — para casos onde uma etapa "passou" mas não temos timestamp dedicado
  const primeiroClaim = claims[0];
  const primeiraEntrega = claims.find(c => c.entregue_em);
  const primeiroPago = claims.find(c => c.pago_em);

  const carimbos = {
    rascunho: pedido?.criado_em,
    aprovado: pedido?.aprovado_em,
    em_producao: primeiroClaim?.criado_em,
    entregue: primeiraEntrega?.entregue_em,
    pago: primeiroPago?.pago_em,
    concluido: pedido?.concluido_em,
  };

  return (
    <div className="timeline">
      {ETAPAS.map((etapa, i) => {
        const passed = i < idxAtual;
        const current = i === idxAtual;
        const cls = passed ? 'done' : current ? 'current' : '';
        const ts = carimbos[etapa.key];
        return (
          <div key={etapa.key} className={`step ${cls}`}>
            <div className="dot">{passed ? '✓' : i + 1}</div>
            <div className="label">{etapa.label}</div>
            {ts && (passed || current) && <div className="when">{fmtData(ts)}</div>}
          </div>
        );
      })}
    </div>
  );
}
