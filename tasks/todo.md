# DashIG — Tasks ativas

> Derivado do [roadmap.md](roadmap.md) + feedback da sessão de 23/04/2026.
> Só inclui o que o usuário marcou como prioridade. O resto continua no roadmap como backlog.
>
> **Correção importante vs roadmap:** cron **não** é Vercel, é Supabase (`pg_cron` + `pg_net` via [supabase/migrations/002_pg_cron_setup.sql](supabase/migrations/002_pg_cron_setup.sql)). Item #1 do roadmap propunha bloco em `vercel.json` — seria trabalho duplicado. Task revisada abaixo.

---

## 🔴 Bloco 1 — Crons Supabase (revisado)

**Estado atual** (via `SELECT * FROM cron.job` no Supabase):
- `dashig-sync-daily` — `0 11 * * *` ✅
- `dashig-sync-stories` — `0 14 * * *` (1×/dia) ⚠️ roadmap pedia 4×/dia
- `dashig-sync-audience` — `0 11 * * 1` ✅
- `dashig-report-monthly` — `0 8 1 * *` ✅
- `refresh-token` — **AUSENTE** 🔴 (token de 60 dias vence sem aviso)

**Problema transversal:** todos usam `Bearer dashig-dev-secret-2026` hardcoded na migration em vez de ler o `CRON_SECRET` real. Se trocar o secret no Vercel, os crons quebram.

### Tasks
- [ ] Nova migration `027_pg_cron_refresh_token.sql`:
  - [ ] `cron.schedule('dashig-refresh-token', '0 3 */7 * *', ...)` chamando `POST /api/instagram/refresh-token`
- [ ] Nova migration `028_pg_cron_stories_frequency.sql`:
  - [ ] `cron.unschedule('dashig-sync-stories')` + re-schedule com `0 */6 * * *` (4×/dia)
- [ ] Decidir estratégia do secret (escolher 1 e registrar):
  - **Opção A** (mais simples): manter hardcoded mas rotacionar via `ALTER` quando mudar
  - **Opção B** (correta): usar `vault.secrets` do Supabase + `vault.read_secret('cron_secret')` nas chamadas `net.http_post`
  - [ ] Documentar escolha em [supabase/migrations/002_pg_cron_setup.sql](supabase/migrations/002_pg_cron_setup.sql) como comentário
- [ ] Verificar que `/api/instagram/refresh-token/route.ts` aceita header `Authorization: Bearer` (grep pra confirmar)
- [ ] Smoke test: rodar `SELECT cron.schedule(...)` manualmente e conferir `cron.job_run_details` após 1ª execução

**Critério de pronto:** `SELECT jobname, schedule FROM cron.job` lista 5 jobs, últimos `job_run_details` todos `succeeded`.

---

## 🔴 Bloco 2 — Ads dashboard ganha ações (pause/activate/delete)

**Estado atual:** [app/api/instagram/ads/route.ts](app/api/instagram/ads/route.ts) é só GET. [app/dashboard/instagram/ads/page.tsx](app/dashboard/instagram/ads/page.tsx) lista sem ações.

### Tasks
- [ ] Criar `app/api/instagram/ads/[adId]/status/route.ts` (PATCH):
  - [ ] Zod schema aceitando `{ status: 'ACTIVE' | 'PAUSED' | 'DELETED' }`
  - [ ] Chamar `POST https://graph.facebook.com/v22.0/{ad_id}` com `effective_status` parametrizado
  - [ ] Retornar `{ success, ad_id, new_status }`
  - [ ] Logger com `Meta Ads` tag
- [ ] Estender [lib/meta-ads-client.ts](lib/meta-ads-client.ts) com `updateAdStatus(token, adId, status)` — uma função, reutilizável
- [ ] UI em [app/dashboard/instagram/ads/page.tsx](app/dashboard/instagram/ads/page.tsx):
  - [ ] Coluna "Ações" com 3 botões ícone (Pause/Play/Trash) condicionais ao status atual
  - [ ] Shadcn `AlertDialog` só pro Delete (confirmação)
  - [ ] Optimistic update + toast de sucesso/erro
- [ ] Registrar ação em `activity_log` (migration 017 já existe)

**Critério de pronto:** clicar "Pausar" num ad ativo e confirmar que (a) UI atualiza, (b) Meta Ads Manager mostra pausado em < 30s.

---

## 🟡 Bloco 3 — Sync-stories para de poluir logs

**Estado atual:** [lib/meta-client.ts:380](lib/meta-client.ts#L380) `getStoryInsights` não tem try/catch. O erro `(#10) Not enough viewers for the media to show insights` é **esperado** (story com < 5 views, Meta não libera métricas), mas hoje derruba o sync.

### Tasks
- [ ] Em `getStoryInsights` ([lib/meta-client.ts](lib/meta-client.ts)):
  - [ ] Try/catch específico pro code `#10` → retornar objeto `{ reach: 0, ..., _skipped: true }` em vez de throw
  - [ ] Qualquer outro erro continua propagando
- [ ] Em [app/api/instagram/sync-stories/route.ts](app/api/instagram/sync-stories/route.ts):
  - [ ] Contador novo `totalSkipped`
  - [ ] Se `insights._skipped` → incrementa skipped, pula upsert de métricas (mantém upsert dos campos estáticos tipo `media_url`, `timestamp`)
  - [ ] Stories com `timestamp` < 2h → skip métricas (Meta ainda não consolidou)
  - [ ] Response inclui `stories_skipped: totalSkipped`
- [ ] Logger: usar `logger.info` pra skips, `logger.error` só pra erros de verdade

**Critério de pronto:** executar cron `sync-stories` numa conta com stories recentes, log mostra `skipped: N` e zero `error` pros casos esperados.

---

## 🔵 Bloco 4 — Tier 2 promovidos (carrossel + públicos personalizados)

Usuário flaggou estes 2 do Tier 2 como prioritários.

### 4a. Boost de carrossel
**Estado atual:** grep em [lib/meta-ads-client.ts](lib/meta-ads-client.ts) por `CAROUSEL` = 0 hits. Fluxo atual assume single image/video.

- [ ] Investigar Meta Marketing API: boost de `CAROUSEL_ALBUM` aceita o mesmo `object_story_id` ou precisa rebuild do creative?
  - Se aceita: adicionar `media_type === 'CAROUSEL_ALBUM'` aos tipos permitidos em `boostInstagramPost`
  - Se não aceita: implementar creative com `link_data.child_attachments[]` (formato carousel nativo do Ads)
- [ ] UI em [components/instagram/BoostModal.tsx](components/instagram/BoostModal.tsx) (ou onde mora o modal atual) — remover filtro que esconde carrossel
- [ ] Teste manual: boostar 1 carrossel real e conferir que anúncio aparece no Ads Manager com os N cards

### 4b. Públicos personalizados
**Estado atual:** `BoostAudience` em [lib/meta-ads-client.ts](lib/meta-ads-client.ts) só tem geo/age/gender/interests. Nada de custom audiences.

- [ ] Endpoint `GET /api/instagram/ads/audiences` — lista `customAudiences` da ad account via Meta API (`GET /act_{id}/customaudiences`)
- [ ] Estender `BoostAudience` com `customAudienceIds?: string[]` e `excludedCustomAudienceIds?: string[]`
- [ ] Na montagem do `targeting` em `boostInstagramPost`, adicionar `custom_audiences` e `excluded_custom_audiences` quando presentes
- [ ] UI no modal de boost: `Select` multi com públicos disponíveis (agrupado por tipo: "Visitantes do site", "Engajamento IG", "Lista de leads")
- [ ] Validação: Meta exige que o público tenha ≥ 100 pessoas antes de poder ser usado — mostrar tamanho na lista, desabilitar os pequenos

**Critério de pronto:** criar um público personalizado manualmente no Ads Manager → aparece no dropdown → boost com ele aplicado roda sem erro.

---

## Review (23/04/2026)

### O que foi feito

**Bloco 1 — Crons Supabase**
- Nova migration [supabase/migrations/027_pg_cron_refresh_token.sql](supabase/migrations/027_pg_cron_refresh_token.sql) agenda `refresh-token` a cada 7 dias (`0 3 */7 * *`)
- Nova migration [supabase/migrations/028_pg_cron_stories_frequency.sql](supabase/migrations/028_pg_cron_stories_frequency.sql) aumenta frequência do `sync-stories` de 1×/dia pra 4×/dia (`0 */6 * * *`)
- [supabase/migrations/002_pg_cron_setup.sql](supabase/migrations/002_pg_cron_setup.sql) ganhou header de SECRET ROTATION documentando como rotacionar o bearer em todas as migrations juntas
- **⚠️ Ação manual pendente:** rodar as migrations 027 e 028 no Supabase SQL Editor (não tem CI de migrations — item #10 do roadmap continua em aberto)

**Bloco 2 — Ads dashboard mutável**
- Novo endpoint PATCH [app/api/instagram/ads/[adId]/status/route.ts](app/api/instagram/ads/[adId]/status/route.ts) aceita `{status: ACTIVE|PAUSED|DELETED}`, valida com Zod, registra em `activity_log`
- `updateAdStatus()` em [lib/meta-ads-client.ts](lib/meta-ads-client.ts) wrapa `POST /{ad_id}` + re-fetch do status
- UI em [components/instagram/AdsDashboard.tsx](components/instagram/AdsDashboard.tsx): 3 botões ícone (Pause/Play/Trash), optimistic update, rollback em erro, toast de sucesso/erro, `confirm()` nativo pra delete
- Estendido `withErrorHandler` em [lib/api-response.ts](lib/api-response.ts) pra repassar ctx (backward-compatible — ctx é opcional)

**Bloco 3 — Sync-stories silencioso**
- `getStoryInsights` em [lib/meta-client.ts](lib/meta-client.ts) agora trata `(#10) Not enough viewers` retornando `{skipped: true}` em vez de jogar
- Tipo `StoryInsights` em [types/instagram.ts](types/instagram.ts) ganhou flag opcional `skipped`
- [app/api/instagram/sync-stories/route.ts](app/api/instagram/sync-stories/route.ts) pula métricas de stories < 2h (Meta ainda não consolidou), contabiliza `stories_skipped` separado de `stories_synced`, preserva métricas válidas de syncs anteriores quando o atual foi skipped

**Bloco 4a — Boost de carrossel**
- Validado: `boostInstagramPost` já funcionava pra carrossel via `source_instagram_media_id` (Meta renderiza auto como carousel ad)
- Adicionado pre-flight `checkMediaBoostEligibility` que consulta `is_eligible_for_promotion` da Graph API antes de criar campanha — falha cedo com mensagem clara em vez de poluir o Ads Manager com campanhas vazias
- Sem filtro por `media_type` a remover no frontend (não existia)

**Bloco 4b — Públicos personalizados**
- Nova função `listCustomAudiences()` em [lib/meta-ads-client.ts](lib/meta-ads-client.ts) com paginação
- Novo endpoint [app/api/instagram/ads/audiences/route.ts](app/api/instagram/ads/audiences/route.ts)
- `BoostAudience` estendido com `customAudienceIds` e `excludedCustomAudienceIds`
- `boostInstagramPost` injeta `custom_audiences` / `excluded_custom_audiences` no targeting
- `validateBoostConfig` em [lib/meta-ads-validation.ts](lib/meta-ads-validation.ts) valida os novos campos (IDs numéricos)
- UI em [components/instagram/BoostConfigFields.tsx](components/instagram/BoostConfigFields.tsx): novo bloco `CustomAudiencesBlock` (include + exclude separados), desabilita públicos < 100 pessoas, fetch lazy só quando o Advanced abre, tratamento de empty/error

### Validação
- `npx tsc --noEmit` — sem erros
- `npm test` — 116/116 passam
- `npm run lint` — só warnings pré-existentes de `<img>` em calendar/messages (não afetados por este PR)

### Pendente / próximos passos
- Aplicar migrations 027 e 028 no Supabase SQL Editor (ou esperar o item #10 do roadmap — migration tracker automatizado)
- Rotacionar `CRON_SECRET` (migração pro Vault do Supabase) fica como pós-MVP
- Testar manualmente: boost de carrossel + público personalizado real
- Itens do roadmap não cobertos aqui: #2 upload de mídia no calendário, #4 Campaign Studio↔Impulsionar, #5 drill-down de ads, #7 testes, #8 `.env.example`, #9 observabilidade, #11 templates
