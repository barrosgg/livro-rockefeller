/* Cálculos de pedido / remuneração — adaptado de _legacy/nota.js */

export const COMISSAO_PCT = 0.25;          // Fazenda retém 25%
export const TRABALHADOR_PCT = 1 - COMISSAO_PCT;

export const fmt = (n) => `$${Number(n ?? 0).toFixed(2)}`;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Total bruto de um pedido (sem desconto). */
export function subtotalPedido(itens) {
  return itens.reduce((acc, it) => acc + Number(it.preco_unit) * Number(it.quantidade), 0);
}

export function totalPedido({ itens, desconto_pct = 0 }) {
  const subtotal = subtotalPedido(itens);
  const desc = subtotal * (Number(desconto_pct) / 100);
  return { subtotal, desconto: desc, total: subtotal - desc };
}

/** Valor do claim para o trabalhador (75%). claim_items = [{order_item, quantidade}] */
export function valorClaim(claim_items) {
  const bruto = claim_items.reduce(
    (acc, ci) => acc + Number(ci.order_item.preco_unit) * Number(ci.quantidade),
    0
  );
  return {
    bruto,
    comissao: bruto * COMISSAO_PCT,
    liquido: bruto * TRABALHADOR_PCT,
  };
}

export function statusLabel(s) {
  return {
    rascunho: 'Rascunho',
    aprovado: 'Aprovado',
    em_producao: 'Em Produção',
    entregue: 'Entregue',
    pago: 'Pago',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  }[s] ?? s;
}
