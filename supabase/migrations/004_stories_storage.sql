-- ==========================================
-- DashIG — Storage para Stories
-- Executar no SQL Editor do Supabase
-- ==========================================

-- 1. Criar bucket para media de stories
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-media', 'story-media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politica de acesso publico para leitura
CREATE POLICY "Public read story-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'story-media');

-- 3. Politica de escrita para service role
CREATE POLICY "Service write story-media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'story-media');

-- 4. Campo para URL persistente
ALTER TABLE instagram_stories
  ADD COLUMN IF NOT EXISTS stored_media_url TEXT;
