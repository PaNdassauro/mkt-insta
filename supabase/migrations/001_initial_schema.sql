-- ==========================================
-- DashIG — Schema Inicial
-- ==========================================

-- Snapshots diarios da conta
CREATE TABLE instagram_account_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  followers_count INTEGER,
  following_count INTEGER,
  media_count     INTEGER,
  reach_7d        INTEGER,
  impressions_7d  INTEGER,
  profile_views   INTEGER,
  website_clicks  INTEGER,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts do feed (imagem, video, carrossel)
CREATE TABLE instagram_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id        TEXT NOT NULL UNIQUE,
  media_type      TEXT NOT NULL,
  caption         TEXT,
  permalink       TEXT,
  thumbnail_url   TEXT,
  timestamp       TIMESTAMP WITH TIME ZONE,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),
  content_score   TEXT,
  hashtags        TEXT[],
  synced_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reels (metricas especificas)
CREATE TABLE instagram_reels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id            TEXT NOT NULL UNIQUE,
  caption             TEXT,
  permalink           TEXT,
  thumbnail_url       TEXT,
  timestamp           TIMESTAMP WITH TIME ZONE,
  views               INTEGER DEFAULT 0,
  likes               INTEGER DEFAULT 0,
  comments            INTEGER DEFAULT 0,
  saves               INTEGER DEFAULT 0,
  shares              INTEGER DEFAULT 0,
  reach               INTEGER DEFAULT 0,
  completion_rate     NUMERIC(5,2),
  avg_watch_time_sec  INTEGER,
  duration_sec        INTEGER,
  content_score       TEXT,
  hashtags            TEXT[],
  synced_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stories (janela curta — coletar a cada 6h enquanto ativo)
CREATE TABLE instagram_stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id     TEXT NOT NULL UNIQUE,
  timestamp    TIMESTAMP WITH TIME ZONE,
  expires_at   TIMESTAMP WITH TIME ZONE,
  reach        INTEGER DEFAULT 0,
  impressions  INTEGER DEFAULT 0,
  exits        INTEGER DEFAULT 0,
  replies      INTEGER DEFAULT 0,
  taps_forward INTEGER DEFAULT 0,
  taps_back    INTEGER DEFAULT 0,
  synced_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dados demograficos (snapshot semanal)
CREATE TABLE instagram_audience_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   DATE NOT NULL,
  age_ranges   JSONB,
  gender       JSONB,
  top_cities   JSONB,
  top_countries JSONB,
  active_hours JSONB,
  active_days  JSONB,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Concorrentes monitorados (dados publicos)
CREATE TABLE instagram_competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  added_at        DATE DEFAULT CURRENT_DATE
);

CREATE TABLE instagram_competitor_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id       UUID REFERENCES instagram_competitors(id),
  date                DATE NOT NULL,
  followers_count     INTEGER,
  posts_last_30d      INTEGER,
  reels_last_30d      INTEGER,
  avg_likes_last_10   INTEGER,
  avg_comments_last_10 INTEGER,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(competitor_id, date)
);

-- Planejamento editorial
CREATE TABLE instagram_editorial_calendar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  content_type  TEXT,
  topic         TEXT,
  caption_draft TEXT,
  hashtags_plan TEXT[],
  status        TEXT DEFAULT 'DRAFT',
  published_media_id TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuracao do app (tokens, etc.)
CREATE TABLE app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- Indices
-- ==========================================

CREATE INDEX idx_posts_timestamp ON instagram_posts(timestamp DESC);
CREATE INDEX idx_reels_timestamp ON instagram_reels(timestamp DESC);
CREATE INDEX idx_stories_timestamp ON instagram_stories(timestamp DESC);
CREATE INDEX idx_account_snapshots_date ON instagram_account_snapshots(date DESC);
CREATE INDEX idx_competitor_snapshots_date ON instagram_competitor_snapshots(date DESC);
