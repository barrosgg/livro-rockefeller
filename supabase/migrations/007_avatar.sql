-- =====================================================================
-- Migration 007 — Avatar nos perfis
-- =====================================================================
alter table profiles add column if not exists avatar text;
