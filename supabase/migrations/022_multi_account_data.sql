-- ============================================================
-- Migration 022: Multi-Account — Adicionar account_id em todas as tabelas de dados
-- Permite filtrar dados por conta Instagram
-- ============================================================

-- 1. Tabelas de Analytics
ALTER TABLE instagram_account_snapshots ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE instagram_posts ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE instagram_reels ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE instagram_stories ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE instagram_audience_snapshots ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);

-- 2. Tabelas de Concorrentes
ALTER TABLE instagram_competitors ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE instagram_competitor_snapshots ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);

-- 3. Tabelas de Producao
ALTER TABLE instagram_editorial_calendar ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE instagram_campaigns ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);

-- 4. Tabelas de Engajamento
ALTER TABLE instagram_comments ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE instagram_mentions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE instagram_conversations ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);
ALTER TABLE monitored_hashtags ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES instagram_accounts(id);

-- 5. Indexes para filtragem eficiente
CREATE INDEX IF NOT EXISTS idx_posts_account ON instagram_posts(account_id);
CREATE INDEX IF NOT EXISTS idx_reels_account ON instagram_reels(account_id);
CREATE INDEX IF NOT EXISTS idx_stories_account ON instagram_stories(account_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_account ON instagram_account_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_audience_account ON instagram_audience_snapshots(account_id);
CREATE INDEX IF NOT EXISTS idx_competitors_account ON instagram_competitors(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_account ON instagram_editorial_calendar(account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_account ON instagram_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_comments_account ON instagram_comments(account_id);
CREATE INDEX IF NOT EXISTS idx_mentions_account ON instagram_mentions(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_account ON instagram_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_hashtags_account ON monitored_hashtags(account_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_account ON knowledge_documents(account_id);

-- 6. Seed: popular dados existentes com a conta Welcome Weddings
-- Primeiro, garantir que a conta existe
INSERT INTO instagram_accounts (ig_user_id, username, access_token, label)
VALUES ('17841402369678583', 'welcomeweddings', 'pending_manual_update', 'Welcome Weddings')
ON CONFLICT (ig_user_id) DO NOTHING;

-- Depois, preencher account_id em todos os registros existentes
DO $$
DECLARE
  ww_account_id UUID;
BEGIN
  SELECT id INTO ww_account_id FROM instagram_accounts WHERE ig_user_id = '17841402369678583';

  IF ww_account_id IS NOT NULL THEN
    UPDATE instagram_account_snapshots SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_posts SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_reels SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_stories SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_audience_snapshots SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_competitors SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_competitor_snapshots SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_editorial_calendar SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_campaigns SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE knowledge_documents SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_comments SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_mentions SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE instagram_conversations SET account_id = ww_account_id WHERE account_id IS NULL;
    UPDATE monitored_hashtags SET account_id = ww_account_id WHERE account_id IS NULL;
  END IF;
END $$;
