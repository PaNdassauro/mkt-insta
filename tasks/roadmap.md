# DashIG — Roadmap do que falta

> Snapshot em **23/04/2026** após sessão de integração Boost / Ads / Sistema / Campaign Studio.
> Ordem vertical = impacto decrescente. Dentro de cada bloco, itens na ordem que eu atacaria.
> Última atualização: 23/04/2026 — ver `tasks/todo.md` pro detalhe da sessão.

---

## 🔴 Crítico — bloqueia uso em produção

### 1. ~~Crons não rodam sozinhos~~ ✅ RESOLVIDO (23/04/2026)
Cron nunca foi Vercel — é `pg_cron` + `pg_net` no Supabase (migration 002). Estado final aplicado em prod:
- [x] `dashig-sync-daily` — `0 11 * * *`
- [x] `dashig-sync-stories` — `0 */6 * * *` (migration 028 aumentou de 1×/dia pra 4×/dia)
- [x] `dashig-sync-audience` — `0 11 * * 1`
- [x] `dashig-refresh-token` — `0 3 */7 * *` (migration 027 agendou — estava faltando, risco de expiração silenciosa)
- [x] `dashig-report-monthly` — `0 8 1 * *`
- [x] `dashig-auto-publish` — `*/30 * * * *` (pre-existente)
- [x] `dashig-knowledge-scrape` — `0 9 * * 1` (pre-existente)

**Débito técnico restante:** secret `dashig-dev-secret-2026` está hardcoded em todas as migrations pg_cron em vez de ler `CRON_SECRET` do env. Migração pro Vault do Supabase (`vault.read_secret`) fica como pós-MVP — ver header da migration 002.

### 2. Calendário não tem upload de mídia
- [ ] Botão "Upload" em cada entrada do calendário (UI em [components/instagram/CalendarTable.tsx](components/instagram/CalendarTable.tsx))
- [ ] Endpoint `POST /api/instagram/calendar/[id]/upload-media` recebe um arquivo, sobe pro Supabase Storage (bucket `post-media`), grava `media_url` na entrada
- [ ] Suportar: imagem única, carrossel (múltiplas imagens → `carousel_urls`), vídeo/Reel (`cover_url` opcional)
- [ ] Validar dimensões/duração pelos limites da Meta Graph API (imagem ≥ 320px, vídeo MP4 ≤ 90s pra Reel)

**Impacto**: sem `media_url`, `/api/instagram/publish` rejeita a entrada com "Adicione uma URL de midia antes de publicar". Hoje o pipeline de publicação só roda se alguém colar URL direto no banco. O "Publicar + Impulsionar" que construímos fica inutilizável sem esse botão.

### 3. ~~Ads dashboard é só leitura~~ ✅ RESOLVIDO (23/04/2026 — commit `74cacad`)
- [x] Endpoint `PATCH /api/instagram/ads/[adId]/status` aceita ACTIVE/PAUSED/DELETED
- [x] 3 botões ícone (Pause/Play/Trash) na tabela com optimistic update + toast + log em `activity_log`
- [x] `confirm()` nativo antes do DELETE

**Ainda pendente:** drill-down + agrupamento por campanha → virou item #5 abaixo.

---

## 🟡 Importante — experiência fica truncada

### 4. Campaign Studio ↔ Impulsionar integrado
- [ ] Em [/dashboard/instagram/campaigns/[id]](app/dashboard/instagram/campaigns/[id]/page.tsx), cada `campaign_post` com `calendar_entry.published_media_id` mostra botão "Impulsionar"
- [ ] Backend: join `campaign_posts.calendar_entry_id → editorial_calendar.published_media_id → instagram_posts.media_id` pra resolver o post publicado
- [ ] Opcional: defaults de boost por campanha (budget + audience) salvos em `instagram_campaigns.boost_config` JSONB, pré-preenchem o modal

**Impacto**: hoje você planeja campanha de 7 posts → publica → pra boostar tem que caçar cada um na aba Posts. Fecha o ciclo `Plan → Publish → Boost` numa tela só.

### 5. Ads dashboard com drill-down
- [ ] Clicar numa linha abre `/dashboard/instagram/ads/[adId]` com:
  - [ ] Gráfico de spend/reach/impressões por dia (insights com breakdown `time_increment=1`)
  - [ ] Breakdown por idade/gênero/placement (hierarquia `breakdowns=age,gender,publisher_platform`)
  - [ ] Histórico de mudanças de status (via `/{ad_id}/adlabels` ou activity log interno)
- [ ] Agrupar por campanha na tela principal (3 níveis: Campanha → Conjunto → Anúncio)

**Impacto**: 796 ads numa lista plana vira inviável. Agrupar + drill-down é como todo mundo que usa Ads Manager pensa.

### 6. ~~Sync de stories silenciosamente erra~~ ✅ RESOLVIDO (23/04/2026 — commit `74cacad`)
- [x] `getStoryInsights` em [lib/meta-client.ts](lib/meta-client.ts) trata `(#10) Not enough viewers` retornando `{skipped: true}`
- [x] Stories < 2h pulam métricas (Meta ainda não consolidou)
- [x] Response separa `stories_skipped` de `stories_synced`
- [x] Métricas válidas de syncs anteriores são preservadas quando o atual foi skipped

---

## 🟢 Qualidade / Futuro

### 7. Zero testes pros novos fluxos
- [ ] Unit: `boostFormToPayload`, `validateBoostForm` em [components/instagram/BoostConfigFields.tsx](components/instagram/BoostConfigFields.tsx)
- [ ] Unit: `validateBoostConfig` em [lib/meta-ads-validation.ts](lib/meta-ads-validation.ts)
- [ ] Integration: mock da Meta API pra testar `boostInstagramPost()`, `listAdsWithInsights()`
- [ ] E2E Playwright: fluxo "abrir modal → preencher → clicar Impulsionar → ver sucesso"

### 8. Restaurar `.env.example`
- [ ] Arquivo foi deletado antes desta sessão (a deleção aparece no `git status` como pendente há vários commits)
- [ ] Listar todas as vars que o app usa: META_*, NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, RESEND_*, OPENAI_API_KEY, ANTHROPIC_API_KEY, TELEGRAM_*, WEBHOOK_URL, CANVA_*

### 9. Observabilidade
- [ ] Integrar Sentry ou Logtail — hoje `lib/logger.ts` só escreve pra stdout, erros em produção somem
- [ ] Alertas: token prestes a expirar, sync falhando X vezes seguidas, boost retornando erro de billing

### 10. Migration tracker automatizado
- [ ] Hoje tem 3+ migrations pendentes no Supabase do projeto (023, 024, 025, 026). Foram aplicadas manualmente hoje via SQL Editor.
- [ ] Usar Supabase CLI + `supabase migration up` no CI pra aplicar automaticamente quando um PR for mergeado

### 11. UI de templates de campanha
- [ ] Tabela `campaign_templates` (migration 023) foi criada, mas não tem página pra gerenciar
- [ ] CRUD simples em `/dashboard/instagram/campaigns/templates`

---

## 🔵 Pós-MVP de boost

Features Tier 2 do boost:

- [x] ~~Impulsionamento de carrossel~~ (23/04/2026, commit `74cacad`) — backend já aceitava via `source_instagram_media_id`; adicionado pre-flight `is_eligible_for_promotion` pra falhar cedo
- [x] ~~Públicos personalizados~~ (23/04/2026, commit `74cacad`) — GET `/api/instagram/ads/audiences`, include/exclude no modal, desabilita públicos < 100 pessoas
- [ ] Lookalike audiences — requer fonte (lista de leads)
- [ ] Pixel/conversion tracking — requer pixel instalado no site
- [ ] Dayparting (só rodar das 18h-22h) — requer orçamento vitalício + UI calendário
- [ ] Dynamic creative (A/B automático de textos/imagens)
- [ ] Frequency capping
- [ ] Bid strategy com cap (COST_CAP, BID_CAP)
- [ ] Idiomas

---

## Histórico do que foi feito nesta sessão (23/04/2026)

Em ordem cronológica dos commits:

- `698ec11` — Boost Instagram posts via Meta Marketing API (campaign → adset → creative → ad chain), token-debug endpoint, env-first token resolution, thumbnail fallback para IMAGE/CAROUSEL
- `c0f4215` — Ads performance dashboard (`/dashboard/instagram/ads`), 60-day token warning no Sistema, acentos no sidebar
- `73ebe64` — Merge Configurações + Sistema, opções avançadas no boost (objetivo, URL+CTA, idade, gênero, países, placements), logos da marca no sidebar
- `90e1686` — "Publicar + Impulsionar" no calendário, fix de cache de fetch do Supabase (mostrava só 1 de 3 campanhas)
- `1fa2d4c` — 6 campos Tier 1 no boost (interesses, cidades/estados, data início, UTM tags, orçamento vitalício, excluir seguidores), TargetingSearch autocomplete, endpoint proxy `/meta-targeting/search`, validação compartilhada boost↔publish-boost, sync com fix de contador + fallback `media_url` em IMAGE/CAROUSEL, `manual-sync` encadeando `backfill-media`, aviso de co-authoring em Posts/Reels/Sistema, migration tracker de `lib/supabase.ts` com `cache: 'no-store'`
- `7bb7377` — Header period selector filtra Posts/Reels/Overview de verdade
- `2ff802d` — Migrations pg_cron: agenda `dashig-refresh-token` (estava ausente) + aumenta `dashig-sync-stories` pra 4×/dia + header documentando rotação de `CRON_SECRET` (aplicadas em prod no mesmo dia)
- `74cacad` — 4 blocos: (a) ads dashboard mutável com pause/play/delete, (b) sync-stories silencioso no `(#10) Not enough viewers` + skip < 2h, (c) pre-flight de elegibilidade no boost (formaliza suporte a carrossel), (d) públicos personalizados no boost com include/exclude
