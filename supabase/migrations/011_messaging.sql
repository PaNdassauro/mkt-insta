-- ============================================
-- Migration 011: Instagram Messaging
-- DMs, webhooks, auto-reply rules
-- ============================================

-- 1. Conversas (threads)
CREATE TABLE instagram_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_user_id       TEXT NOT NULL,         -- Instagram-scoped ID do usuario
  username         TEXT,                  -- @username (pode ser null inicialmente)
  profile_pic_url  TEXT,
  last_message_at  TIMESTAMP WITH TIME ZONE,
  unread_count     INTEGER DEFAULT 0,
  is_archived      BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_conversations_ig_user ON instagram_conversations(ig_user_id);

-- 2. Mensagens
CREATE TABLE instagram_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID REFERENCES instagram_conversations(id) ON DELETE CASCADE,
  ig_message_id    TEXT UNIQUE,           -- ID da mensagem no Instagram
  direction        TEXT NOT NULL,          -- INCOMING | OUTGOING
  content          TEXT,                  -- Texto da mensagem
  media_url        TEXT,                  -- URL de midia (imagem/video/audio)
  media_type       TEXT,                  -- image | video | audio | sticker
  is_auto_reply    BOOLEAN DEFAULT FALSE,
  replied_to       UUID REFERENCES instagram_messages(id),
  timestamp        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON instagram_messages(conversation_id, timestamp DESC);

-- 3. Regras de auto-reply
CREATE TABLE auto_reply_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  keywords         TEXT[] NOT NULL,       -- palavras-chave que ativam a regra
  match_type       TEXT DEFAULT 'contains', -- contains | exact | starts_with
  reply_text       TEXT NOT NULL,         -- resposta automatica
  is_active        BOOLEAN DEFAULT TRUE,
  priority         INTEGER DEFAULT 0,     -- maior prioridade = avaliado primeiro
  usage_count      INTEGER DEFAULT 0,     -- quantas vezes foi usada
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Templates de resposta rapida
CREATE TABLE reply_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         TEXT,                  -- ex: preco, disponibilidade, destinos, geral
  content          TEXT NOT NULL,
  shortcut         TEXT,                  -- atalho (ex: /preco, /destinos)
  usage_count      INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Webhook events log (para debug)
CREATE TABLE webhook_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       TEXT NOT NULL,         -- messages | comments | mentions
  payload          JSONB NOT NULL,
  processed        BOOLEAN DEFAULT FALSE,
  error            TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);
