-- ==========================================
-- DashIG — Agendar refresh do long-lived token
-- ==========================================
-- Contexto: o token de 60 dias precisa ser renovado periodicamente, senao todos
-- os syncs quebram silenciosamente. O endpoint /api/instagram/refresh-token ja
-- existe e valida CRON_SECRET; faltava o schedule.
--
-- IMPORTANTE: O Bearer abaixo precisa bater com process.env.CRON_SECRET no Vercel.
-- Se o secret for rotacionado, atualizar aqui tambem via:
--   SELECT cron.unschedule('dashig-refresh-token');
-- + re-run deste schedule com o novo valor.

SELECT cron.schedule(
  'dashig-refresh-token',
  '0 3 */7 * *',
  $$
  SELECT net.http_post(
    url := 'https://mkt-insta.vercel.app/api/instagram/refresh-token',
    headers := '{"Authorization": "Bearer dashig-dev-secret-2026", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
