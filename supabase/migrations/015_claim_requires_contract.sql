-- =====================================================================
-- Migration 015 — Reforco no banco: so permite criar claim se o
-- trabalhador assinou o contrato. Garantia que ninguem burla via API.
-- =====================================================================

drop policy if exists claims_insert_self on claims;
create policy claims_insert_self on claims for insert
  with check (
    trabalhador_id = auth.uid()
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and disabled = false
        and contrato_assinado_em is not null
    )
  );
