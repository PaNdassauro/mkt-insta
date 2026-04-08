-- ==========================================
-- DashIG — Storage para thumbnails de Posts e Reels
-- Executar no SQL Editor do Supabase
-- ==========================================
-- Motivacao: as URLs thumbnail_url retornadas pela Instagram Graph API
-- sao URLs assinadas do CDN do Facebook que expiram em ~24h. Para
-- garantir que as imagens persistam no dashboard, fazemos download e
-- upload para o Supabase Storage durante o sync.

-- 1. Criar bucket publico para midias de posts/reels
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politica de leitura publica
DROP POLICY IF EXISTS "Public read post-media" ON storage.objects;
CREATE POLICY "Public read post-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-media');

-- 3. Politica de escrita para service role
DROP POLICY IF EXISTS "Service write post-media" ON storage.objects;
CREATE POLICY "Service write post-media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-media');

DROP POLICY IF EXISTS "Service update post-media" ON storage.objects;
CREATE POLICY "Service update post-media" ON storage.objects
  FOR UPDATE USING (bucket_id = 'post-media');

-- 4. Coluna para URL persistente em posts e reels
ALTER TABLE instagram_posts
  ADD COLUMN IF NOT EXISTS stored_thumbnail_url TEXT;

ALTER TABLE instagram_reels
  ADD COLUMN IF NOT EXISTS stored_thumbnail_url TEXT;
