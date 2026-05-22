-- =====================================================================
-- Migration 017 — Conquistas manuais (badges extras)
-- Permite ao Proprietario conceder badges manualmente, alem das
-- calculadas automaticamente das estatisticas.
-- =====================================================================

alter table profiles add column if not exists badges_extras text[];

-- Concede todas as 9 conquistas para o usuário barrosgg
update profiles
set badges_extras = array[
  'first_claim','five_claims','thousand_units','ten_thousand_units',
  'punctual','veteran','top_3','top_1','big_earner'
]
where discord_handle = 'barrosgg';
