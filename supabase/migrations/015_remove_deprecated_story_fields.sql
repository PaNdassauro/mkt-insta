-- ==========================================
-- DashIG — Remove deprecated Stories fields
-- v22+: exits, taps_forward, taps_back replaced by navigation
-- ==========================================

ALTER TABLE instagram_stories
  DROP COLUMN IF EXISTS exits,
  DROP COLUMN IF EXISTS taps_forward,
  DROP COLUMN IF EXISTS taps_back;
