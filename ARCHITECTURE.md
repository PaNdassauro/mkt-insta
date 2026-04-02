# ARCHITECTURE.md — DashIG
> Instagram Analytics Dashboard + Campaign Studio · Welcome Weddings
> Stack: Next.js 14 · Supabase · Vercel · Meta Graph API v21.0

---

## 1. Visao Geral do Projeto

DashIG e um dashboard interno de analytics e gestao de conteudo para o Instagram da **Welcome Weddings** (@welcomeweddings). O sistema coleta dados via Meta Graph API, armazena historico no Supabase, e oferece capacidades de analytics, geracao de campanhas com IA, gestao de engajamento (comentarios, mensagens, mencoes) e publicacao direta.

**Conta monitorada**: `@welcomeweddings` (Welcome Weddings | Destination Weddings)
**IG User ID**: `17841402369678583`
**URL producao**: https://mkt-insta.vercel.app
**Repositorio**: https://github.com/marcelowelcome/mkt-insta

---

## 2. Stack Tecnologica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS v3 + shadcn/ui (v3, Radix primitives) + Lucide React |
| Graficos | Recharts (dynamic import para bundle otimizado) |
| Backend | Next.js API Routes (Route Handlers) |
| Banco de dados | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (login/sessao/middleware) + CRON_SECRET (cron jobs) + validateDashboardRequest (dashboard routes) + RLS |
| Fonte de dados | Meta Graph API v21.0 (Instagram Graph API) |
| Deploy | Vercel |
| Cron Jobs | Supabase pg_cron + pg_net |
| Storage | Supabase Storage (story media) |
| Email Reports | Resend |
| Embeddings | OpenAI text-embedding-3-small (RAG) |
| Geracao IA | Anthropic Claude claude-sonnet-4-20250514 (Campaign Studio) |
| Notificacoes | Telegram Bot API + Webhook (Slack/Teams) |
| Assets visuais | Canva Connect API (OAuth PKCE) |
| Toasts | Sonner |
| Tema escuro | next-themes |
| Testes unitarios | Vitest |
| Testes E2E | Playwright |

---

## 3. Fluxo de Dados

### 3.1 Analytics
```
Meta Graph API v21.0
      |
/api/instagram/sync (pg_cron — diario as 8h BRT)
      |
Normalizacao + upsert no Supabase (ON CONFLICT DO UPDATE)
      |
/api/instagram/[endpoint] (Route Handlers internos)
      |
Componentes React (Client Components com hooks)
      |
Dashboard renderizado no browser
```

### 3.2 Campaign Studio
```
PDFs + Site welcomeweddings.com.br
      |
Pipeline de ingestao (chunking + embeddings OpenAI)
      |
Supabase pgvector (document_chunks)
      |
                    Briefing do usuario
                          |
         /api/campaigns/generate
         (vector search + metrics query + Claude API streaming)
                          |
              Campanha estruturada (JSON)
                          |
              Campaign Editor (revisao humana)
                          |
              Assets aprovados pelo analista
                          |
         Agendamento na instagram_editorial_calendar
                          |
         Publicacao manual OU auto-publish (cron 30 min)
```

---

## 4. Estrutura de Diretorios

### 4.1 Pages (29 page.tsx files)
```
/app
  page.tsx                              <- Redirect para /dashboard/instagram
  /login
    page.tsx                            <- Login (Supabase Auth)
  /dashboard
    /instagram
      layout.tsx                        <- Layout com sidebar responsiva + mobile nav
      page.tsx                          <- Visao Geral (KPIs, graficos, top posts, heatmap, scorecard)
      error.tsx                         <- Error boundary global do modulo
      /posts/page.tsx                   <- Grid de posts com filtros, ordenacao, paginacao
      /reels/page.tsx                   <- Reels analytics (views, completion, engagement)
      /stories/page.tsx                 <- Stories com thumbnails persistentes + video player
      /growth/page.tsx                  <- Historico de seguidores + metricas
      /audience/page.tsx                <- Dados demograficos (idade, genero, cidade)
      /hashtags/page.tsx                <- Hashtag Intelligence com trend
      /competitors/page.tsx             <- Benchmarking de concorrentes (CRUD + sync automatico)
      /calendar/page.tsx                <- Calendario editorial (mensal + Kanban view)
      /calendar/[id]/page.tsx           <- Editor completo de entrada com preview Instagram
      /messages/page.tsx                <- Inbox de DMs + gestao de auto-reply rules
      /comments/page.tsx               <- Gestao de comentarios (sync, reply, hide, delete, sentimento)
      /mentions/page.tsx               <- Mencoes e tags + galeria UGC
      /hashtag-monitor/page.tsx        <- Monitoramento de hashtags (top/recent media)
      /report/page.tsx                  <- Relatorio PDF mensal
      /settings/page.tsx               <- Configuracoes gerais (token, Telegram, crons)
      /settings/users/page.tsx         <- Gestao de usuarios e roles (admin only)
      /settings/activity/page.tsx      <- Log de atividades do sistema
      /settings/system/page.tsx        <- Dashboard de saude do sistema
      /settings/accounts/page.tsx      <- Gestao de contas Instagram (multi-account)
      /campaigns/page.tsx              <- Lista de campanhas com status
      /campaigns/new/page.tsx          <- Briefing form (step 1)
      /campaigns/new/generating/page.tsx <- Streaming de geracao (step 2)
      /campaigns/compare/page.tsx      <- Comparacao de campanhas (metricas + radar chart)
      /campaigns/[id]/page.tsx         <- Campaign Editor — revisao e aprovacao (step 3)
      /campaigns/[id]/report/page.tsx  <- Relatorio da campanha (parcial ou final)
      /knowledge/page.tsx              <- Gestao da Knowledge Base (upload de PDFs, status)
```

### 4.2 API Routes (63 route.ts files)
```
/app/api/instagram
  /sync/route.ts                        <- Cron principal (posts, reels, insights, content scores)
  /sync-stories/route.ts                <- Cron stories + persistencia de media no Storage
  /sync-audience/route.ts               <- Cron audiencia semanal (follower_demographics)
  /sync-competitors/route.ts           <- Cron semanal — sync de concorrentes via Meta Graph API
  /auto-publish/route.ts               <- Cron 30min — publica posts agendados automaticamente
  /posts/route.ts                       <- GET posts
  /reels/route.ts                       <- GET reels
  /stories/route.ts                     <- GET stories
  /insights/route.ts                    <- GET insights da conta
  /audience/route.ts                    <- GET dados de audiencia
  /hashtags/route.ts                    <- GET hashtag intelligence
  /hashtags/suggest/route.ts           <- GET sugestao inteligente de hashtags por caption
  /competitors/route.ts                <- CRUD concorrentes
  /competitor-snapshots/route.ts       <- GET snapshots de concorrentes
  /calendar/route.ts                    <- GET/POST/PUT/DELETE calendario editorial
  /calendar/[id]/route.ts              <- GET/PATCH/DELETE entrada individual
  /report/route.ts                      <- POST gera relatorio mensal + envia email
  /refresh-token/route.ts              <- POST refresh do token Meta
  /export/route.ts                      <- GET exportacao CSV
  /publish/route.ts                     <- POST publica no Instagram via Meta API
  /comments/route.ts                   <- GET lista + POST sync/reply/hide/delete comentarios
  /comments/sentiment/route.ts         <- GET distribuicao de sentimento agregada por semana
  /mentions/route.ts                   <- GET lista + POST sync/save mencoes e tags
  /messages/route.ts                   <- GET conversas + POST enviar DM
  /messages/[conversationId]/route.ts  <- GET mensagens de uma conversa
  /messages/enrich/route.ts            <- POST enriquecimento de mensagens
  /auto-reply/route.ts                <- CRUD regras de auto-reply
  /hashtag-monitor/route.ts           <- GET/POST monitoramento de hashtags
  /recommendations/route.ts           <- GET recomendacoes acionaveis (timing, formato, gaps, temas)
  /reply-templates/route.ts           <- CRUD templates de resposta
  /competitors/insights/route.ts     <- GET relatorio competitivo (insights comparativos)

/app/api/webhooks
  /instagram/route.ts                   <- GET verify + POST recebe eventos (messages, comments)

/app/api/campaigns
  /route.ts                             <- GET lista de campanhas
  /generate/route.ts                    <- POST orquestra RAG + Claude API com streaming
  /compare/route.ts                    <- GET compara campanhas por tags
  /[id]/route.ts                        <- GET campanha / PATCH status e tags
  /[id]/posts/route.ts                  <- GET posts da campanha
  /[id]/posts/[postId]/route.ts         <- PATCH edicao de post individual
  /[id]/chat/route.ts                   <- POST chat estrategico com IA sobre a campanha
  /[id]/schedule/route.ts               <- POST envia posts aprovados para o calendario
  /[id]/report/route.ts                <- GET relatorio da campanha (parcial ou final)
  /[id]/media/route.ts                 <- POST/DELETE vincular midias reais a campanha
  /[id]/brief/route.ts                 <- GET designer brief formatado da campanha
  /templates/route.ts                  <- GET/POST/DELETE templates de campanha reutilizaveis

/app/api/canva
  /templates/route.ts                  <- GET lista templates Canva do usuario
  /generate/route.ts                   <- POST autofill de template Canva com dados da campanha
  /export/route.ts                     <- POST exporta design finalizado do Canva

/app/api/auth
  /instagram/route.ts                  <- GET inicia OAuth do Instagram
  /instagram/callback/route.ts         <- GET callback do OAuth Instagram
  /canva/route.ts                      <- GET inicia OAuth do Canva (PKCE)
  /canva/callback/route.ts             <- GET callback do OAuth Canva
  /canva/status/route.ts               <- GET verifica status da conexao Canva

/app/api/knowledge
  /ingest/route.ts                      <- Upload e ingestao de PDFs
  /scrape/route.ts                      <- Dispara scraping do site (manual ou cron)
  /documents/route.ts                   <- GET lista / PATCH toggle ativo

/app/api/notifications
  /badges/route.ts                      <- GET contagens de notificacoes pendentes

/app/api/settings
  /route.ts                             <- GET configuracoes gerais (token, telegram, etc.)
  /telegram-test/route.ts              <- POST teste de conexao do Telegram
  /users/route.ts                       <- GET/POST/PATCH/DELETE gestao de usuarios (admin only)
  /activity/route.ts                    <- GET log de atividades com filtros
  /accounts/route.ts                    <- CRUD contas Instagram (multi-account)
  /system/route.ts                      <- GET saude do sistema (token, syncs, db stats, storage)
  /webhook-test/route.ts               <- POST teste de webhook (Slack/Teams)

/app/api/admin
  /export-all/route.ts                  <- GET exportacao completa de dados (CSV)
```

### 4.3 Lib
```
/lib
  meta-client.ts                        <- Wrapper Meta Graph API v21.0 (com retry/backoff)
  supabase.ts                           <- Cliente Supabase server (createServerSupabaseClient)
  supabase-browser.ts                   <- Cliente Supabase browser (createBrowserSupabaseClient)
  supabase-middleware.ts                <- Middleware de sessao Supabase Auth
  analytics.ts                          <- Funcoes puras de calculo (engagement, QEI, scores)
  auth.ts                               <- Auth centralizada (validateCronSecret, validateDashboardRequest, escapeHtml)
  api-response.ts                       <- Helpers padronizados (apiSuccess, apiError, getErrorMessage, withErrorHandler)
  logger.ts                             <- Logging estruturado (JSON em prod, ANSI em dev)
  roles.ts                              <- getUserRole() e helpers de controle de acesso
  activity.ts                           <- logActivity() para registro no activity_log
  telegram.ts                           <- sendTelegramMessage() via Telegram Bot API
  storage.ts                            <- Persistencia de media no Supabase Storage
  report-generator.ts                   <- Geracao de relatorio HTML mensal
  constants.ts                          <- Constantes (API URL, pesos, cores, formatadores)
  utils.ts                              <- cn() para classes Tailwind
  canva-client.ts                       <- Client Canva Connect API (OAuth, templates, autofill, export)
  content-classifier.ts                <- Classificador de conteudo por keywords (categories)
  webhook-notifier.ts                  <- Notificador generico via webhook (Slack/Teams)
  account-context.ts                   <- Contexto de conta ativa (server-side)
  fetch-with-account.ts                <- Fetch com header x-account-id automatico
  rag/
    embeddings.ts                       <- Wrapper OpenAI Embeddings API
    chunker.ts                          <- Chunking de texto (512 tokens, overlap 64)
    vector-search.ts                    <- Query ao pgvector via search_knowledge()
    pdf-parser.ts                       <- Extracao de texto de PDFs
  campaign/
    prompt-builder.ts                   <- Monta prompt com 3 camadas de contexto
    campaign-parser.ts                  <- Parseia e valida JSON gerado pelo Claude
    system-prompt.ts                    <- System prompt com boas praticas do Instagram
```

### 4.4 Components
```
/components
  ErrorBoundary.tsx                     <- Error boundary reutilizavel
  ThemeProvider.tsx                      <- Provider para dark mode (next-themes)
  ThemeToggle.tsx                        <- Toggle de tema no sidebar
  /instagram
    OverviewKPIs.tsx
    PostCard.tsx
    PostGrid.tsx
    ReelCard.tsx
    GrowthChart.tsx
    EngagementChart.tsx
    HeatmapPostingTime.tsx
    ContentScorecard.tsx
    HashtagTable.tsx
    AudienceDemographics.tsx
    CompetitorTable.tsx
    CompetitorEvolutionChart.tsx
    CompetitorEvolutionWrapper.tsx
    CompetitorInsights.tsx               <- Widget de insights comparativos de concorrentes
    EditorialCalendar.tsx               <- Calendario mensal com publicacao direta
    CalendarKanban.tsx                  <- Visao Kanban do calendario (drag-and-drop)
    CalendarTable.tsx                   <- Visao tabela do calendario (com bulk actions)
    ExportButton.tsx
    StoryMetrics.tsx
    SentimentChart.tsx                  <- Grafico de sentimento dos comentarios
    RecommendationWidget.tsx            <- Widget de recomendacoes acionaveis
    /campaigns
      BriefingForm.tsx                  <- Formulario de briefing (step 1)
      GeneratingScreen.tsx              <- Tela de streaming com progresso (step 2)
      PostEditor.tsx                    <- Edicao inline de post individual (nao-destrutiva)
      CampaignTimeline.tsx              <- Linha do tempo visual da campanha
      ScheduleButton.tsx                <- Envia posts aprovados para o calendario editorial
      StrategyChatPanel.tsx             <- Chat com IA para discutir estrategia
      CanvaAssetGenerator.tsx           <- Geracao de assets via Canva Connect API
    /knowledge
      KnowledgeBaseManager.tsx          <- Upload, lista e toggle de documentos indexados

  PeriodSelector.tsx                     <- Seletor global de periodo (7d, 30d, 90d, 365d, all)

  /ui                                   <- shadcn/ui v3 (Radix primitives)
    badge.tsx, button.tsx, card.tsx, dialog.tsx, select.tsx, separator.tsx,
    skeleton.tsx, sonner.tsx, table.tsx, tabs.tsx, textarea.tsx
```

### 4.5 Hooks (7 arquivos)
```
/hooks
  useInstagramMetrics.ts               <- Busca metricas gerais do Instagram
  usePostPerformance.ts                <- Busca performance de posts
  useReelPerformance.ts                <- Busca performance de reels
  useNotificationBadges.ts             <- Polling de badges de notificacao (60s)
  useSessionCheck.ts                   <- Verifica sessao ativa (60s), redireciona para login se expirada
  useCurrentAccount.ts                 <- Selecao de conta ativa (multi-account, localStorage)
  usePeriodFilter.ts                   <- Filtro de periodo global (7d/30d/90d/365d/all) com persistencia
```

### 4.6 Testes
```
/tests                                  <- Testes unitarios (Vitest)
  activity.test.ts
  analytics.test.ts
  api-response.test.ts
  auth.test.ts
  campaign-parser.test.ts
  chunker.test.ts
  hashtag-suggest.test.ts
  logger.test.ts
  roles.test.ts
  sentiment-api.test.ts
  telegram.test.ts

/e2e                                    <- Testes E2E (Playwright)
  auth.spec.ts
  calendar.spec.ts
  campaigns.spec.ts
  dashboard.spec.ts
  settings.spec.ts
```

### 4.7 Types
```
/types
  instagram.ts                          <- Tipos TypeScript para todas as entidades
```

---

## 5. Banco de Dados (Supabase)

### 5.1 Tabelas

| Tabela | Descricao | Chave unica |
|--------|-----------|-------------|
| `instagram_account_snapshots` | Snapshots diarios da conta | `date` |
| `instagram_posts` | Posts do feed (IMAGE, VIDEO, CAROUSEL_ALBUM) | `media_id` |
| `instagram_reels` | Reels com metricas de video | `media_id` |
| `instagram_stories` | Stories (expiracao 24h) | `media_id` |
| `instagram_audience_snapshots` | Demograficos semanais (JSONB) | `week_start` |
| `instagram_competitors` | Concorrentes monitorados | `username` |
| `instagram_competitor_snapshots` | Snapshots de concorrentes | `(competitor_id, date)` |
| `instagram_editorial_calendar` | Planejamento editorial + publicacao | `id` |
| `instagram_comments` | Comentarios sincronizados | `comment_id` |
| `instagram_mentions` | Mencoes e tags da marca | `media_id` |
| `monitored_hashtags` | Hashtags monitoradas | `hashtag` |
| `hashtag_snapshots` | Snapshots de hashtags (top/recent media) | `(hashtag_id, date)` |
| `user_roles` | Papeis de usuario (admin/editor/viewer) | `user_id` |
| `activity_log` | Log de atividades do sistema | `id` |
| `instagram_accounts` | Contas Instagram cadastradas (multi-account) | `ig_user_id` |
| `knowledge_documents` | Documentos indexados na Knowledge Base | `id` |
| `document_chunks` | Chunks de texto com embeddings vetoriais | `id` |
| `instagram_campaigns` | Campanhas geradas pelo Campaign Studio | `id` |
| `campaign_posts` | Posts individuais de cada campanha | `id` |
| `conversations` | Conversas de DM | `id` |
| `messages` | Mensagens individuais de DM | `id` |
| `auto_reply_rules` | Regras de auto-reply por keyword | `id` |
| `reply_templates` | Templates de resposta | `id` |
| `webhook_events` | Eventos recebidos via webhook | `id` |
| `campaign_templates` | Templates de campanha reutilizaveis | `id` |
| `canva_tokens` | Tokens OAuth da Canva Connect API | `account_id` |
| `app_config` | Configuracao (tokens, etc.) | `key` |

### 5.2 Migrations (25 arquivos)

| Arquivo | Descricao |
|---------|-----------|
| `001_initial_schema.sql` | Schema completo (9 tabelas + indices + app_config) |
| `002_pg_cron_setup.sql` | pg_cron + pg_net para cron jobs |
| `003_stories_new_fields.sql` | Campos media_type, media_url, permalink, follows, shares, navigation para stories |
| `004_stories_storage.sql` | Bucket story-media + stored_media_url |
| `005_stories_video_url.sql` | stored_video_url para videos persistidos |
| `006_campaign_studio.sql` | pgvector, knowledge_documents, document_chunks, instagram_campaigns, campaign_posts, search_knowledge() |
| `007_publishing_support.sql` | media_url, carousel_urls, published_at, publish_error no calendario |
| `008_campaign_strategy_fields.sql` | format_strategy, timing_strategy, expected_results nas campanhas |
| `009_publishing_enhancements.sql` | location_id, user_tags, alt_text, collaborators, cover_url, auto_publish |
| `010_campaign_tags_and_grouping.sql` | tags nas campanhas, campaign_id em posts/reels/stories (GIN index) |
| `011_messaging.sql` | conversations, messages, auto_reply_rules, reply_templates, webhook_events |
| `012_comments_mentions.sql` | instagram_comments, instagram_mentions |
| `013_hashtag_monitoring.sql` | monitored_hashtags, hashtag_snapshots |
| `014_rls_policies.sql` | Row Level Security em todas as tabelas |
| `015_remove_deprecated_story_fields.sql` | Remove campos deprecados de stories |
| `016_user_roles.sql` | Tabela user_roles (admin/editor/viewer) + funcao get_user_role() |
| `017_activity_log.sql` | Tabela activity_log com indices por data e entidade |
| `018_audit_trail.sql` | Campos de auditoria adicionais |
| `019_competitor_ig_user_id.sql` | ig_user_id em competitors + media_count em snapshots |
| `020_multi_account.sql` | Tabela instagram_accounts (preparacao multi-conta) |
| `021_seed_admin_user.sql` | Seed do usuario admin inicial |
| `022_multi_account_data.sql` | account_id em todas as tabelas de dados (filtro por conta) |
| `023_campaign_templates.sql` | Tabela campaign_templates + campos recurrence no calendario |
| `024_content_categories.sql` | Campo category em posts e reels (auto-categorizacao) |
| `025_canva_tokens.sql` | Tabela canva_tokens para OAuth Canva Connect API |

---

## 6. Meta Graph API v21.0 — Endpoints Utilizados

**IMPORTANTE**: Metricas mudaram significativamente na v21+/v22+. Os endpoints abaixo refletem o estado atual.

| Dado | Endpoint | Notas |
|---|---|---|
| Info da conta | `GET /{user_id}?fields=followers_count,media_count` | `following_count` removido na v21+ |
| Lista de midias | `GET /{user_id}/media?fields=id,media_type,media_product_type,caption,permalink,thumbnail_url,timestamp` | Paginacao cursor-based |
| Insights de post | `GET /{media_id}/insights?metric=reach,saved,shares` + `GET /{media_id}?fields=like_count,comments_count` | `impressions` removido para midias na v22+ |
| Insights de Reel | `GET /{media_id}/insights?metric=reach,saved,shares,comments,likes,ig_reels_avg_watch_time,views` | `views` substitui `plays` desde abr/2025 |
| Stories ativos | `GET /{user_id}/stories?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp` | Apenas enquanto ativo |
| Insights de story | `GET /{media_id}/insights?metric=reach,replies,navigation,follows,profile_visits,shares,total_interactions` | v22+: `navigation` substitui exits/taps |
| Insights de conta | `GET /{user_id}/insights?metric=reach,profile_views,website_clicks&period=day&metric_type=total_value` | `metric_type=total_value` obrigatorio |
| Audiencia | `GET /{user_id}/insights?metric=follower_demographics&period=lifetime&breakdown=age,gender` | Substitui `audience_gender_age` |
| Audiencia cidade | `GET /{user_id}/insights?metric=follower_demographics&period=lifetime&breakdown=city` | |
| Publicacao | `POST /{user_id}/media` + `POST /{user_id}/media_publish` | IMAGE, CAROUSEL, REEL |

### Metricas descontinuadas (NAO usar)

| Metrica antiga | Substituicao |
|---|---|
| `plays` | `views` (Reels) |
| `impressions` | Removido para conta e midias (v22+) |
| `following_count` | Removido (v21+) |
| `audience_gender_age` | `follower_demographics` com `breakdown=age,gender` |
| `audience_city` | `follower_demographics` com `breakdown=city` |
| `exits`, `taps_forward`, `taps_back` | `navigation` (Stories v22+) |

---

## 7. Cron Jobs (pg_cron + pg_net no Supabase)

| Job | Schedule | O que faz |
|---|---|---|
| `dashig-sync-daily` | `0 11 * * *` (8h BRT) | Posts, Reels, insights da conta, snapshot de seguidores, recalcula content scores (batch) |
| `dashig-sync-stories` | `0 14 * * *` (11h BRT) | Stories ativos + persistencia de thumbs/videos no Supabase Storage |
| `dashig-sync-audience` | `0 11 * * 1` (seg 8h BRT) | Snapshot demografico via `follower_demographics` (numeros convertidos para %) |
| `dashig-report-monthly` | `0 8 1 * *` (dia 1, 5h BRT) | Gera relatorio HTML e envia por email via Resend |
| `dashig-knowledge-scrape` | `0 6 * * 1` (seg 6h BRT) | Re-indexa o site da Welcome Weddings no pgvector |
| `dashig-auto-publish` | `*/30 * * * *` (30 em 30 min) | Publica entradas com auto_publish=true e scheduled_for <= now |
| `dashig-sync-competitors` | `0 11 * * 1` (seg 8h BRT) | Sync de perfis publicos de concorrentes via Meta Graph API |

Gerenciar: `SELECT * FROM cron.job WHERE jobname LIKE 'dashig-%';`
Historico: `SELECT * FROM cron.job_run_details WHERE jobname LIKE 'dashig-%' ORDER BY start_time DESC LIMIT 20;`

Todos os cron jobs validam `CRON_SECRET` via `lib/auth.ts:validateCronSecret()`.

---

## 8. Calculos e Logica de Negocio

### 8.1 Engagement Rate
```
engagement_rate = (likes + comments + saves + shares) / reach x 100
```
Guard: `if (reach === 0) return 0`

### 8.2 Qualitative Engagement Index (QEI)
```
QEI = (likes x 1) + (comments x 2) + (saves x 4) + (shares x 5)
QEI_rate = QEI / reach x 100
```
Calculado em runtime no frontend (pesos ajustaveis).

### 8.3 Content Score (Tier)
```
> media + 1 desvio padrao  -> VIRAL
> media                    -> GOOD
> media - 1 desvio padrao  -> AVERAGE
abaixo                     -> WEAK
```
Recalculado no sync via batch update (4 queries por tabela em vez de N).

### 8.4 Heatmap de Melhor Hora para Postar
Cruza `active_hours`/`active_days` da audiencia com `engagement_rate` historico dos posts por hora/dia.

### 8.5 Hashtag Intelligence
Agrega por hashtag: media de reach, media de engagement_rate, frequencia de uso, trend 4 semanas.
Impacto estimado = avg_reach x avg_engagement_rate.

---

## 9. Campaign Studio — Arquitetura RAG

### 9.1 Pipeline de ingestao de contexto (offline)

**PDFs (playbook, tom de voz, identidade de marca):**
```
Upload via KnowledgeBaseManager.tsx
      |
/api/knowledge/ingest
      |
pdf-parser.ts (extracao de texto)
      |
chunker.ts (512 tokens, overlap 64)
      |
embeddings.ts (OpenAI text-embedding-3-small, lotes de 100)
      |
upsert em document_chunks
```

**Site welcomeweddings.com.br (pg_cron semanal):**
```
/api/knowledge/scrape (pg_cron segundas 6h BRT)
      |
chunking + embeddings
      |
upsert em document_chunks (por URL + chunk_index)
```

### 9.2 Geracao de campanha (runtime)

**3 camadas de contexto montadas em prompt-builder.ts:**

| Camada | Fonte | Como acessa |
|---|---|---|
| Marca e negocio | knowledge_documents + document_chunks | Vector search (similarity >= 0.70) |
| Performance do perfil | instagram_posts, instagram_reels, instagram_audience_snapshots | Query direta ao Supabase |
| Boas praticas | system-prompt.ts | Hardcoded, atualizado periodicamente |

**Fluxo de geracao:**
```
Briefing do usuario
      |
prompt-builder.ts
  1. generateEmbedding(briefing.theme + objective + audience)
  2. vectorSearch(embedding, { threshold: 0.70, limit: 8 })
  3. getTopPostsByScore(10) + getLatestAudienceSnapshot() + getTopHashtags(20) + getBestSlots(5)
  4. buildSystemPrompt()
  5. Monta prompt com as 3 camadas
      |
/api/campaigns/generate
  1. Cria rascunho com status GENERATING
  2. Chama Claude API com streaming
  3. Retorna ReadableStream para o cliente
  4. Ao finalizar: campaign-parser.ts valida JSON + persiste em campaign_posts
      |
Campaign Editor (analista revisa)
      |
Posts aprovados -> /api/campaigns/[id]/schedule
      |
Upsert em instagram_editorial_calendar
      |
campaign_posts.calendar_entry_id vinculado
```

### 9.3 Modelo e configuracao Claude

- **Modelo**: `claude-sonnet-4-20250514` (melhor relacao custo/velocidade)
- **max_tokens**: 8000
- **Output**: JSON puro com justificativas estrategicas (format_strategy, timing_strategy, expected_results)
- **Streaming**: obrigatorio — geracao leva 30-90s
- **Chat estrategico**: `/api/campaigns/[id]/chat` para analista discutir estrategia com a IA

### 9.4 Fluxo de agendamento

Ao aprovar todos os posts de uma campanha, o analista clica em "Agendar campanha". O sistema:
1. Para cada `campaign_post` com status `APPROVED`, cria uma entrada em `instagram_editorial_calendar`
2. Campos mapeados: `scheduled_for`, `format` (content_type), `caption_edited ?? caption`, `hashtags_edited ?? hashtags`, `cta`, `visual_brief` + `visual_notes` (como notes)
3. Vincula `campaign_post.calendar_entry_id` ao id criado
4. Atualiza `instagram_campaigns.status` para `SCHEDULED`

---

## 10. Seguranca

### Auth do sistema
- **Supabase Auth**: login/sessao/middleware para acesso ao dashboard
- **CRON_SECRET**: `lib/auth.ts:validateCronSecret()` — protege rotas de cron/sync/knowledge
- **Dashboard**: `lib/auth.ts:validateDashboardRequest()` — protege rotas que modificam dados
- **RLS**: Row Level Security habilitado em todas as tabelas (migration 014)
- **Session check**: hook `useSessionCheck()` verifica sessao a cada 60s no client

### Token Meta
- Long-Lived Token (60 dias) salvo na tabela `app_config`
- Fallback para `process.env.META_ACCESS_TOKEN` apenas no setup inicial
- Sync diario verifica expiracao (alerta se < 15 dias)
- Refresh via `POST /api/instagram/refresh-token`

### Supabase
- `SUPABASE_SERVICE_ROLE_KEY` apenas em API Routes via `createServerSupabaseClient()` (de `lib/supabase.ts`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` para Client Components via `createBrowserSupabaseClient()` (de `lib/supabase-browser.ts`)

### XSS
- Report generator usa `escapeHtml()` de `lib/auth.ts` para sanitizar captions no HTML

### API Keys de IA
- `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` sao server-only (sem prefixo NEXT_PUBLIC_)
- Nunca expor no client — embeddings e geracao apenas em API Routes

### Roles de Usuario
Tabela `user_roles` com tres niveis: `admin`, `editor`, `viewer`. Funcao SQL `get_user_role(uid)` retorna o role (default: `viewer`).

- **Admin**: gerencia usuarios, configura sistema, exporta dados
- **Editor**: cria/edita campanhas, agenda posts, gerencia comentarios e mensagens
- **Viewer**: somente leitura

API: `GET/POST/PATCH/DELETE /api/settings/users` (requer admin).

### Log de Atividades
Tabela `activity_log` registra acoes com `user_id`, `action`, `entity_type`, `entity_id` e `details` (JSONB).

API: `GET /api/settings/activity` com filtros por `entity_type`, `user_id` e `since`.
Pagina: `/dashboard/instagram/settings/activity`

---

## 11. Motor de Recomendacoes

O endpoint `GET /api/instagram/recommendations` analisa dados historicos dos ultimos 30 dias e retorna 3-5 recomendacoes acionaveis:

| Tipo | O que analisa |
|---|---|
| `timing` | Melhores dias/horarios com base em engagement historico vs. frequencia de postagem |
| `format` | Qual formato (Reel, Carrossel, Imagem) tem melhor performance atual |
| `gap` | Periodos sem postagem ou formatos subutilizados |
| `theme` | Temas e hashtags com tendencia de alta |
| `trend` | Mudancas significativas em metricas (ex.: queda de reach, alta de saves) |

Cada recomendacao inclui `confidence` (high/medium/low) e `data` com os numeros que embasam a sugestao.

---

## 12. Integracao Telegram

Notificacoes via Telegram Bot API (`lib/telegram.ts`):

- **Configuracao**: `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` nas variaveis de ambiente
- **Teste**: `POST /api/settings/telegram-test` envia mensagem de teste
- **Uso**: alertas de sync, erros criticos, e eventos configurados
- **Formato**: HTML (bold, links) suportado pela Telegram API

---

## 13. Monitoramento de Saude do Sistema

Pagina `/dashboard/instagram/settings/system` e API `GET /api/settings/system`:

| Dado | O que mostra |
|---|---|
| Token Meta | Status (valid/expiring) e dias restantes |
| Ultimos syncs | Data da ultima execucao de cada tipo de sync |
| Cron jobs | Lista de jobs ativos com schedule |
| Telegram | Se esta configurado |
| DB stats | Contagem de posts, reels, stories, campanhas, comentarios |
| Storage | Quantidade de arquivos no bucket story-media |

---

## 14. Publicacao Direta no Instagram

### 14.1 Permissoes (todas granted)

| Permissao | Status |
|---|---|
| `instagram_content_publish` | Granted |
| `instagram_manage_comments` | Granted |
| `instagram_manage_messages` | Granted |
| `instagram_manage_events` | Granted |
| `instagram_manage_contents` | Granted |
| Quota | 100 posts/24h |

### 14.2 Fluxo de publicacao

```
1. POST /{user_id}/media — Cria container (image_url/video_url + caption + params)
2. GET /{container_id}?fields=status_code — Poll ate FINISHED
3. POST /{user_id}/media_publish — Publica o container
```

### 14.3 Parametros suportados

| Parametro | IMAGE | CAROUSEL | REEL |
|---|---|---|---|
| caption | Sim | Sim | Sim |
| location_id | Sim | Sim | Sim |
| user_tags | Sim | Sim (por item) | Nao |
| alt_text | Sim | Sim (por item) | Nao |
| collaborators | Sim | Sim | Sim |
| cover_url | Nao | Nao | Sim |

### 14.4 Auto-publish

Cron `dashig-auto-publish` roda a cada 30 minutos. Publica entradas com:
- `auto_publish = true`
- `status = 'APPROVED'`
- `scheduled_for <= now`
- `media_url` preenchida

---

## 15. Variaveis de Ambiente

```env
# Meta Graph API
META_ACCESS_TOKEN=           # Long-lived token (apenas setup inicial)
META_IG_USER_ID=             # ID da conta business do Instagram
META_APP_ID=
META_APP_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # APENAS server-side

# Email (Resend)
RESEND_API_KEY=
REPORT_RECIPIENT_EMAIL=

# Seguranca
CRON_SECRET=                 # Min 32 chars em producao

# IA (Campaign Studio) — server-only
OPENAI_API_KEY=              # Apenas para embeddings (text-embedding-3-small)
ANTHROPIC_API_KEY=           # Geracao de campanhas (Claude)

# Telegram (notificacoes)
TELEGRAM_BOT_TOKEN=          # Token do bot criado via @BotFather
TELEGRAM_CHAT_ID=            # ID do chat/grupo para receber alertas

# Canva Connect API
CANVA_CLIENT_ID=               # Client ID do app Canva
CANVA_CLIENT_SECRET=           # Client Secret do app Canva

# Webhook (Slack/Teams)
WEBHOOK_URL=                   # URL do incoming webhook (Slack, Teams, etc.)

# Site para scraping
WELCOME_WEDDINGS_SITE_URL=https://www.welcomeweddings.com.br
```

---

## 16. Status do Roadmap

### Sprints 1-5: Analytics + Campaign Studio base (CONCLUIDOS)
- [x] Meta App + Long-Lived Token + schema inicial
- [x] Overview, Posts, Reels, Stories, Growth, Audience, Hashtags
- [x] Concorrentes (CRUD), Relatorio mensal, Calendario Editorial
- [x] Campaign Studio: RAG (pgvector), Geracao (Claude streaming), Editor, Agendamento
- [x] Publicacao direta (IMAGE, CAROUSEL, REEL) + auto-publish
- [x] Kanban, editor com preview, tags e comparacao
- [x] DMs + Webhooks (inbox, envio, auto-reply)
- [x] Comentarios + Mencoes + UGC
- [x] Hashtag monitoring
- [x] Supabase Auth + Dark mode + Unit tests

### Sprint 6: Sentimento, Hashtag Suggest, Telegram (CONCLUIDO)
- [x] Grafico de sentimento dos comentarios (ultimos 90 dias)
- [x] API `/api/instagram/comments/sentiment`
- [x] Sugestao inteligente de hashtags por caption
- [x] Integracao Telegram + endpoint de teste
- [x] Logging estruturado (`lib/logger.ts`)

### Sprint 7: Roles, Activity Log, RLS (CONCLUIDO)
- [x] Tabela `user_roles` + funcao SQL `get_user_role()`
- [x] `lib/roles.ts` + API + pagina de gestao de usuarios
- [x] Tabela `activity_log` + `lib/activity.ts` + pagina de consulta
- [x] RLS policies em todas as tabelas

### Sprint 8: Recomendacoes, Competidores, Saude (CONCLUIDO)
- [x] Motor de recomendacoes + widget
- [x] Sync automatico de concorrentes via cron semanal
- [x] Dashboard de saude do sistema

### Sprint 9: Exportacao, Multi-account Prep, Polish (CONCLUIDO)
- [x] Exportacao administrativa completa
- [x] Tabela `instagram_accounts` + API + pagina de contas
- [x] Auth em todas as rotas restantes

### Sprints 10-12: Badges, Brief, E2E, Polish (CONCLUIDOS)
- [x] Notification badges (API + hook `useNotificationBadges`)
- [x] Designer brief endpoint (`/api/campaigns/[id]/brief`)
- [x] Session check hook (`useSessionCheck`)
- [x] Current account hook (`useCurrentAccount`)
- [x] ErrorBoundary component
- [x] Messages enrich endpoint
- [x] E2E tests (Playwright): 5 specs
- [x] Canva client stub
- [x] `lib/api-response.ts` (apiSuccess, apiError, getErrorMessage, withErrorHandler)

### Sprint 13: Multi-account completo (CONCLUIDO)
- [x] Instagram OAuth flow (`/api/auth/instagram`, `/api/auth/instagram/callback`)
- [x] Migration 022: `account_id` em todas as tabelas de dados
- [x] Filtro de dados por conta ativa (header `x-account-id`)
- [x] `lib/account-context.ts` e `lib/fetch-with-account.ts`
- [x] Cron jobs adaptados para multiplas contas

### Sprint 14: Relatorio competitivo, alertas, filtro de periodo (CONCLUIDO)
- [x] Relatorio competitivo (`/api/instagram/competitors/insights`)
- [x] Alertas de crescimento de concorrentes
- [x] Widget `CompetitorInsights`
- [x] Filtro de periodo global (`PeriodSelector` + `usePeriodFilter`)
- [x] Melhorias nos cron jobs multi-conta

### Sprint 15: Templates, calendario recorrente, classificacao, webhook (CONCLUIDO)
- [x] Templates de campanha (`campaign_templates` + `/api/campaigns/templates`)
- [x] Entradas recorrentes no calendario (`recurrence`, `recurrence_end`)
- [x] Auto-categorizacao de conteudo (`lib/content-classifier.ts`, migration 024)
- [x] Webhook generico Slack/Teams (`lib/webhook-notifier.ts` + `/api/settings/webhook-test`)
- [x] Bulk actions no `CalendarTable`

### Sprint 16: Canva Connect API (CONCLUIDO)
- [x] OAuth com PKCE (`/api/auth/canva`, callback, status)
- [x] Listagem de templates Canva (`/api/canva/templates`)
- [x] Autofill de templates (`/api/canva/generate`)
- [x] Exportacao de designs (`/api/canva/export`)
- [x] Componente `CanvaAssetGenerator`
- [x] Migration 025: tabela `canva_tokens`
- [x] `lib/canva-client.ts` completo

### Backlog futuro
- [ ] Integracao com TikTok e LinkedIn
- [ ] Analytics de Instagram Ads (Meta Ads API)
- [ ] Accessibility pass completo (aria labels, keyboard nav)

---

## 17. Decisoes Tecnicas Importantes

1. **shadcn/ui v3 (Radix)**: Compativel com Tailwind CSS v3. A versao 4 (base-ui) NAO e compativel com Next.js 14.
2. **Meta API v21/v22**: `metric_type=total_value` obrigatorio para insights de conta. `follower_demographics` com `breakdown` substitui `audience_gender_age`. `impressions` removido. Stories usam `navigation`.
3. **Batch content scores**: 4 queries por tier em vez de N queries individuais.
4. **Auth em 3 camadas**: `validateCronSecret()` (cron), `validateDashboardRequest()` (dashboard), Supabase Auth + RLS (usuario).
5. **Error boundaries**: `app/dashboard/instagram/error.tsx` + `components/ErrorBoundary.tsx`.
6. **QEI no frontend**: Runtime para pesos ajustaveis.
7. **Stories persistidos**: Supabase Storage bucket `story-media` (thumbs/ e videos/).
8. **pg_cron**: Migrado do Vercel (limitacao Hobby). Sem restricao de frequencia.
9. **Audiencia em %**: API retorna absolutos, convertemos para % antes de salvar.
10. **OpenAI apenas para embeddings**: `text-embedding-3-small` (1536 dims). Claude para geracao. Separacao consciente de responsabilidades.
11. **Agendamento via calendario existente**: Campaign Studio nao cria modulo novo — os posts aprovados fluem para `instagram_editorial_calendar`.
12. **Edicao nao-destrutiva**: `caption_edited`/`hashtags_edited` preservam o output original da IA para comparacao.
13. **Claude Sonnet para geracao**: Usando `claude-sonnet-4-20250514` — melhor relacao custo/velocidade para campanhas com streaming.
14. **Logging estruturado**: `lib/logger.ts` com JSON em producao (compativel com Vercel Log Drain) e ANSI colorido em dev. Nunca usar `console.log` direto.
15. **Respostas de API padronizadas**: `apiSuccess`/`apiError`/`getErrorMessage` de `lib/api-response.ts` em todas as rotas.
16. **Dynamic import do Recharts**: Reduz bundle inicial em ~200KB.
