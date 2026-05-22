/* Cálculos de pedido / remuneração — adaptado de _legacy/nota.js.
   A comissão da Fazenda é configurada na tabela `settings` (key=commission_pct).
   Os defaults abaixo servem como fallback caso o SettingsProvider ainda não
   tenha carregado. */

export const COMISSAO_PCT = 0.25;
export const TRABALHADOR_PCT = 1 - COMISSAO_PCT;

export const fmt = (n) => `$${Number(n ?? 0).toFixed(2)}`;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function subtotalPedido(itens) {
  return itens.reduce((acc, it) => acc + Number(it.preco_unit) * Number(it.quantidade), 0);
}

export function totalPedido({ itens, desconto_pct = 0 }) {
  const subtotal = subtotalPedido(itens);
  const desc = subtotal * (Number(desconto_pct) / 100);
  return { subtotal, desconto: desc, total: subtotal - desc };
}

/** Valor do claim para o trabalhador. Aceita comissão dinâmica como segundo arg. */
export function valorClaim(claim_items, comissao_pct = COMISSAO_PCT) {
  const bruto = claim_items.reduce(
    (acc, ci) => acc + Number(ci.order_item.preco_unit) * Number(ci.quantidade),
    0
  );
  return {
    bruto,
    comissao: bruto * comissao_pct,
    liquido: bruto * (1 - comissao_pct),
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
