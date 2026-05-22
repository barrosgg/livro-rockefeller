-- =====================================================================
-- Migration 004 — Corrige cascade nas FKs para permitir delete em ordem
-- Sem isso, deletar uma ordem com claims exige deletar manualmente
-- claim_items antes (ver erro 23503).
-- =====================================================================

-- claim_items.order_item_id → ON DELETE CASCADE
alter table claim_items
  drop constraint if exists claim_items_order_item_id_fkey;
alter table claim_items
  add constraint claim_items_order_item_id_fkey
  foreign key (order_item_id) references order_items(id) on delete cascade;

-- Garantia: claim_items.claim_id (já tinha cascade no schema original, mas
-- recria por segurança caso tenha sido alterado).
alter table claim_items
  drop constraint if exists claim_items_claim_id_fkey;
alter table claim_items
  add constraint claim_items_claim_id_fkey
  foreign key (claim_id) references claims(id) on delete cascade;
