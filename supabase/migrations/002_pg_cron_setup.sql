-- ==========================================
-- DashIG — pg_cron + pg_net Setup
-- Executar no SQL Editor do Supabase
-- ==========================================
--
-- SECRET ROTATION: O "Bearer dashig-dev-secret-2026" usado em todas as chamadas
-- abaixo PRECISA bater com process.env.CRON_SECRET no Vercel. Ao rotacionar:
--   1. Atualizar CRON_SECRET no Vercel
--   2. Atualizar o valor hardcoded em TODAS as migrations pg_cron (002, 027, 028, ...)
--   3. Para cada job afetado:
--        SELECT cron.unschedule('dashig-<job>');
--        + re-run do cron.schedule com o novo valor
-- Migracao pra Vault (vault.read_secret) fica como pos-MVP (ver roadmap).

-- 1. Habilitar extensoes necessarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Sync diario (posts, reels, snapshots) — 8h BRT (11h UTC)
SELECT cron.schedule(
  'dashig-sync-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mkt-insta.vercel.app/api/instagram/sync',
    headers := '{"Authorization": "Bearer dashig-dev-secret-2026", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 3. Sync stories diario — 11h BRT (14h UTC)
SELECT cron.schedule(
  'dashig-sync-stories',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mkt-insta.vercel.app/api/instagram/sync-stories',
    headers := '{"Authorization": "Bearer dashig-dev-secret-2026", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 4. Sync audiencia semanal (segunda) — 8h BRT (11h UTC)
SELECT cron.schedule(
  'dashig-sync-audience',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://mkt-insta.vercel.app/api/instagram/sync-audience',
    headers := '{"Authorization": "Bearer dashig-dev-secret-2026", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 5. Relatorio mensal (dia 1) — 5h BRT (8h UTC)
SELECT cron.schedule(
  'dashig-report-monthly',
  '0 8 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://mkt-insta.vercel.app/api/instagram/report',
    headers := '{"Authorization": "Bearer dashig-dev-secret-2026", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ==========================================
-- Comandos uteis para gerenciar crons:
--
-- Ver todos os crons ativos:
--   SELECT * FROM cron.job;
--
-- Ver historico de execucoes:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- Remover um cron:
--   SELECT cron.unschedule('dashig-sync-daily');
--
-- Remover todos:
--   SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'dashig-%';
-- ==========================================
