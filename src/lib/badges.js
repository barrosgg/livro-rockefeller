/* Catálogo de conquistas/selos do trabalhador.
   Cada badge tem uma função check(stats) que decide se foi conquistado. */

export const BADGES = [
  { id: 'first_claim', emoji: '🌱', nome: 'Primeiro Plantio',
    desc: 'Concluiu sua primeira produção para a Fazenda',
    check: (s) => s.claims_total >= 1 },

  { id: 'five_claims', emoji: '🌾', nome: 'Cinco Colheitas',
    desc: 'Concluiu 5 produções',
    check: (s) => s.claims_total >= 5 },

  { id: 'thousand_units', emoji: '📦', nome: 'Mil Unidades',
    desc: 'Produziu 1.000 ou mais unidades',
    check: (s) => s.unidades_total >= 1000 },

  { id: 'ten_thousand_units', emoji: '🏭', nome: 'Industrioso',
    desc: 'Produziu 10.000 ou mais unidades',
    check: (s) => s.unidades_total >= 10000 },

  { id: 'punctual', emoji: '🎯', nome: 'Pontualidade',
    desc: '10 entregas dentro do prazo',
    check: (s) => s.entregas_no_prazo >= 10 },

  { id: 'veteran', emoji: '🤝', nome: 'Veterano',
    desc: '6 meses de Fazenda Rockefeller',
    check: (s) => s.dias_desde_inicio >= 180 },

  { id: 'top_3', emoji: '👑', nome: 'Top 3 da Fazenda',
    desc: 'Está entre os 3 mais produtivos',
    check: (s) => s.posicao_ranking != null && s.posicao_ranking <= 3 },

  { id: 'top_1', emoji: '💎', nome: 'Diamante',
    desc: 'Top 1 do ranking',
    check: (s) => s.posicao_ranking === 1 },

  { id: 'big_earner', emoji: '💰', nome: 'Fortuna',
    desc: 'Acumulou mais de $5.000 em líquido',
    check: (s) => s.liquido_total >= 5000 },
];
