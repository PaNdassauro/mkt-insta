-- ============================================
-- Migration 012: Comments + Mentions
-- ============================================

CREATE TABLE instagram_comments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id       TEXT UNIQUE NOT NULL,    -- ID do comentario no Instagram
  media_id         TEXT NOT NULL,           -- ID da midia que recebeu o comentario
  parent_id        TEXT,                    -- ID do comentario pai (se for reply)
  username         TEXT NOT NULL,
  text             TEXT NOT NULL,
  timestamp        TIMESTAMP WITH TIME ZONE,
  like_count       INTEGER DEFAULT 0,
  is_hidden        BOOLEAN DEFAULT FALSE,
  is_replied       BOOLEAN DEFAULT FALSE,
  reply_text       TEXT,                    -- nossa resposta
  replied_at       TIMESTAMP WITH TIME ZONE,
  sentiment        TEXT,                    -- POSITIVE | NEUTRAL | NEGATIVE | QUESTION
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_media ON instagram_comments(media_id);
CREATE INDEX idx_comments_replied ON instagram_comments(is_replied);

CREATE TABLE instagram_mentions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id         TEXT UNIQUE NOT NULL,    -- ID da midia que nos mencionou
  username         TEXT NOT NULL,           -- quem mencionou
  caption          TEXT,
  permalink        TEXT,
  media_type       TEXT,                    -- IMAGE | VIDEO | CAROUSEL_ALBUM
  media_url        TEXT,                    -- URL da midia
  timestamp        TIMESTAMP WITH TIME ZONE,
  is_saved         BOOLEAN DEFAULT FALSE,   -- salvo como UGC
  notes            TEXT,                    -- notas do analista
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mentions_saved ON instagram_mentions(is_saved);
CREATE INDEX idx_mentions_timestamp ON instagram_mentions(timestamp DESC);
