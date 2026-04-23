-- ==========================================
-- DashIG — Aumentar frequencia do sync-stories
-- ==========================================
-- Contexto: stories expiram em 24h e hoje o cron roda so 1x/dia (14h UTC).
-- Stories publicados depois das 14h so sao capturados no dia seguinte, apos expirar.
-- Nova frequencia: 4x/dia (a cada 6 horas).

SELECT cron.unschedule('dashig-sync-stories');

SELECT cron.schedule(
  'dashig-sync-stories',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mkt-insta.vercel.app/api/instagram/sync-stories',
    headers := '{"Authorization": "Bearer dashig-dev-secret-2026", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
