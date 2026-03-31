-- ============================================================
-- DashIG: Limpeza de entries orfaos no calendario editorial
-- Rode no SQL Editor do Supabase
-- ============================================================

-- 1. Limpar referencia de campaign_posts para calendar entries que serao deletados
UPDATE campaign_posts
SET calendar_entry_id = NULL
WHERE calendar_entry_id IS NOT NULL
  AND campaign_id NOT IN (SELECT id FROM instagram_campaigns);

-- 2. Ver quantas entries orfas existem (preview antes de deletar)
SELECT id, scheduled_for, content_type, topic, status, created_at
FROM instagram_editorial_calendar
WHERE id IN (
  SELECT calendar_entry_id FROM campaign_posts WHERE calendar_entry_id IS NOT NULL
)
OR id NOT IN (
  SELECT COALESCE(calendar_entry_id, '00000000-0000-0000-0000-000000000000') FROM campaign_posts
);

-- 3. Deletar entries do calendario que nao foram publicados e nao tem campanha vinculada
-- (descomente para executar)
/*
DELETE FROM instagram_editorial_calendar
WHERE status != 'PUBLISHED'
  AND id NOT IN (
    SELECT COALESCE(calendar_entry_id, '00000000-0000-0000-0000-000000000000')
    FROM campaign_posts
    WHERE calendar_entry_id IS NOT NULL
  );
*/

-- 4. Se quiser deletar TUDO que nao esta publicado (limpar calendario inteiro exceto publicados):
-- (descomente para executar)
/*
UPDATE campaign_posts SET calendar_entry_id = NULL WHERE calendar_entry_id IS NOT NULL;
DELETE FROM instagram_editorial_calendar WHERE status != 'PUBLISHED';
*/
