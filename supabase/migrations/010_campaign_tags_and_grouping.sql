-- ============================================
-- Migration 010: Campaign Tags + Post Grouping
-- Tags para comparacao entre campanhas
-- Agrupamento de posts/reels existentes em campanhas
-- ============================================

-- 1. Tags de campanha
ALTER TABLE instagram_campaigns
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_campaigns_tags ON instagram_campaigns USING gin(tags);

-- 2. Vincular posts e reels existentes a campanhas (agrupamento manual)
ALTER TABLE instagram_posts
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES instagram_campaigns(id) ON DELETE SET NULL;

ALTER TABLE instagram_reels
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES instagram_campaigns(id) ON DELETE SET NULL;

ALTER TABLE instagram_stories
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES instagram_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_campaign ON instagram_posts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reels_campaign ON instagram_reels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_stories_campaign ON instagram_stories(campaign_id);
