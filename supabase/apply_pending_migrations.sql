-- ============================================================
-- DashIG: Apply All Pending Migrations (014-021)
-- Convenience script to run in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- Migration: 014_rls_policies.sql
-- ============================================================

-- Migration 014: Row Level Security (RLS) para todas as tabelas
-- Habilita RLS e cria policies:
--   - service_role: acesso total (backend/cron jobs)
--   - authenticated: leitura (dashboard users)
--   - authenticated + write: tabelas que o dashboard precisa modificar

-- ============================================================
-- 1. HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================

ALTER TABLE instagram_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_audience_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_editorial_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtag_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. POLICIES DE LEITURA PARA USUARIOS AUTENTICADOS
-- Tabelas somente-leitura no dashboard (dados coletados via sync)
-- ============================================================

-- Analytics (somente leitura - dados vem do sync/cron)
CREATE POLICY "authenticated_read" ON instagram_account_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read" ON instagram_posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read" ON instagram_reels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read" ON instagram_stories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read" ON instagram_audience_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read" ON instagram_competitor_snapshots
  FOR SELECT TO authenticated USING (true);

-- Webhooks e chunks (somente leitura no dashboard)
CREATE POLICY "authenticated_read" ON webhook_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read" ON document_chunks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read" ON hashtag_snapshots
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. POLICIES DE LEITURA + ESCRITA PARA USUARIOS AUTENTICADOS
-- Tabelas que o dashboard precisa modificar (CRUD, aprovacao, etc.)
-- ============================================================

-- Competitors (CRUD no dashboard)
CREATE POLICY "authenticated_read" ON instagram_competitors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON instagram_competitors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Editorial Calendar (CRUD no dashboard)
CREATE POLICY "authenticated_read" ON instagram_editorial_calendar
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON instagram_editorial_calendar
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON instagram_editorial_calendar
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete" ON instagram_editorial_calendar
  FOR DELETE TO authenticated USING (true);

-- Campaigns (criar, editar status, aprovar)
CREATE POLICY "authenticated_read" ON instagram_campaigns
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON instagram_campaigns
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON instagram_campaigns
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Campaign Posts (editar caption, aprovar posts individuais)
CREATE POLICY "authenticated_read" ON campaign_posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON campaign_posts
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON campaign_posts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Knowledge Documents (upload, toggle active/inactive)
CREATE POLICY "authenticated_read" ON knowledge_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON knowledge_documents
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update" ON knowledge_documents
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Comments (reply, hide, delete via dashboard)
CREATE POLICY "authenticated_read" ON instagram_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON instagram_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mentions (salvar mencoes do dashboard)
CREATE POLICY "authenticated_read" ON instagram_mentions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON instagram_mentions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Messages (enviar DMs pelo dashboard)
CREATE POLICY "authenticated_read" ON instagram_conversations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON instagram_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read" ON instagram_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON instagram_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-reply rules (CRUD no dashboard)
CREATE POLICY "authenticated_read" ON auto_reply_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON auto_reply_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reply templates (CRUD no dashboard)
CREATE POLICY "authenticated_read" ON reply_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON reply_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Monitored hashtags (CRUD no dashboard)
CREATE POLICY "authenticated_read" ON monitored_hashtags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_write" ON monitored_hashtags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. APP_CONFIG - SOMENTE LEITURA PARA AUTENTICADOS
-- Escrita apenas via service_role (admin backend)
-- ============================================================

CREATE POLICY "authenticated_read" ON app_config
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 5. NOTA SOBRE SERVICE_ROLE
-- O service_role do Supabase IGNORA RLS por padrao.
-- Todas as API routes que usam createServerSupabaseClient()
-- (que usa SUPABASE_SERVICE_ROLE_KEY) continuam com acesso total.
-- Nenhuma policy adicional e necessaria para o backend.
-- ============================================================

-- ============================================================
-- Migration: 015_remove_deprecated_story_fields.sql
-- ============================================================

-- ==========================================
-- DashIG — Remove deprecated Stories fields
-- v22+: exits, taps_forward, taps_back replaced by navigation
-- ==========================================

ALTER TABLE instagram_stories
  DROP COLUMN IF EXISTS exits,
  DROP COLUMN IF EXISTS taps_forward,
  DROP COLUMN IF EXISTS taps_back;

-- ============================================================
-- Migration: 016_user_roles.sql
-- ============================================================

-- Table for user roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON user_roles FOR SELECT TO authenticated USING (true);
-- Only admins can modify roles (enforced at API level since we can't reference user_roles in its own policy easily)

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = uid),
    'viewer'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- Migration: 017_activity_log.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,        -- e.g., 'campaign.created', 'campaign.approved', 'post.scheduled', 'settings.updated', 'user.login'
  entity_type TEXT,            -- e.g., 'campaign', 'post', 'calendar', 'settings'
  entity_id TEXT,              -- ID of the affected entity
  details JSONB,               -- Additional context
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by date and entity
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON activity_log FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Migration: 018_audit_trail.sql
-- ============================================================

-- 018: Audit Trail — add created_by / updated_by to campaigns, campaign_posts, editorial calendar

-- Add audit columns to campaigns
ALTER TABLE instagram_campaigns ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE instagram_campaigns ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add audit columns to campaign_posts
ALTER TABLE campaign_posts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE campaign_posts ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add audit columns to editorial calendar
ALTER TABLE instagram_editorial_calendar ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE instagram_editorial_calendar ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- ============================================================
-- Migration: 019_competitor_ig_user_id.sql
-- ============================================================

-- Add ig_user_id to instagram_competitors for Meta Graph API lookups
ALTER TABLE instagram_competitors ADD COLUMN IF NOT EXISTS ig_user_id TEXT;

-- Also add media_count to snapshots (fetched from API)
ALTER TABLE instagram_competitor_snapshots ADD COLUMN IF NOT EXISTS media_count INTEGER;

-- ============================================================
-- Migration: 020_multi_account.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_user_id TEXT NOT NULL UNIQUE,
  username TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  label TEXT NOT NULL,  -- e.g., "Welcome Weddings", "Welcome Trips"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON instagram_accounts FOR SELECT TO authenticated USING (true);

-- Seed with current account from env vars (will be populated manually)
-- INSERT INTO instagram_accounts (ig_user_id, username, access_token, label)
-- VALUES ('17841402369678583', 'welcomeweddings', '<token>', 'Welcome Weddings');

-- ============================================================
-- Migration: 021_seed_admin_user.sql
-- ============================================================

    -- Seed: definir marcelo@welcometrips.com.br como admin
    -- Busca o user_id na tabela auth.users pelo email e insere na user_roles
    INSERT INTO user_roles (user_id, role)
    SELECT id, 'admin'
    FROM auth.users
    WHERE email = 'marcelo@welcometrips.com.br'
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = now();
