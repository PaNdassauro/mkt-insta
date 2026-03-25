-- ============================================
-- Migration 007: Publishing Support
-- Adiciona campos para publicacao direta no Instagram
-- ============================================

ALTER TABLE instagram_editorial_calendar
  ADD COLUMN IF NOT EXISTS media_url TEXT,              -- URL publica da imagem/video
  ADD COLUMN IF NOT EXISTS carousel_urls TEXT[],        -- URLs para itens do carrossel
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS publish_error TEXT;          -- ultimo erro de publicacao
