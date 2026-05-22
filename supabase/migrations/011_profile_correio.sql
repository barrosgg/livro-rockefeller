-- =====================================================================
-- Migration 011 — Campo Correio (PO Box) no perfil
-- =====================================================================
alter table profiles add column if not exists correio text;
