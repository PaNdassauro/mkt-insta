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
