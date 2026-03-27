-- ============================================
-- Migration 013: Hashtag Monitoring
-- ============================================

CREATE TABLE monitored_hashtags (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag          TEXT UNIQUE NOT NULL,
  ig_hashtag_id    TEXT,                   -- ID do hashtag no Instagram
  last_synced_at   TIMESTAMP WITH TIME ZONE,
  top_media_count  INTEGER DEFAULT 0,
  recent_media_count INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE hashtag_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag_id       UUID REFERENCES monitored_hashtags(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  top_media        JSONB,                 -- top posts data
  recent_media     JSONB,                 -- recent posts data
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_hashtag_snapshots_date ON hashtag_snapshots(hashtag_id, date);
