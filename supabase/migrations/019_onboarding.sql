-- =====================================================================
-- Migration 019 — Onboarding (rastreia quem já viu o tutorial inicial)
-- =====================================================================
alter table profiles add column if not exists onboarding_completed_em timestamptz;
