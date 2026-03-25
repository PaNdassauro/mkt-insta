-- ============================================
-- Migration 008: Campaign Strategy Fields
-- Adiciona campos de justificativa estrategica
-- ============================================

ALTER TABLE instagram_campaigns
  ADD COLUMN IF NOT EXISTS format_strategy TEXT,
  ADD COLUMN IF NOT EXISTS timing_strategy TEXT,
  ADD COLUMN IF NOT EXISTS expected_results TEXT;
