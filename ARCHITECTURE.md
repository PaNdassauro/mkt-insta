# ARCHITECTURE.md — DashIG
> Instagram Analytics Dashboard + Campaign Studio · Welcome Weddings
> Stack: Next.js 14 · Supabase · Vercel · Meta Graph API v21.0

---

## 1. Visao Geral do Projeto

DashIG e um dashboard interno de analytics e gestao de conteudo para o Instagram da **Welcome Weddings** (@welcomeweddings). O sistema coleta dados via Meta Graph API, armazena historico no Supabase, e oferece duas capacidades principais:

1. **Analytics**: coleta, historico e inteligencia sobre performance de conteudo
2. **Campaign Studio**: geracao de campanhas com IA + RAG, revisao humana e agendamento integrado

O projeto segue os mesmos padroes arquiteturais do DashWT (dashboard de vendas da Welcome Trips): modular, documentado para agentes de IA, e deployado no Vercel.

**Conta monitorada**: `@welcomeweddings` (Welcome Weddings | Destination Weddings)
**IG User ID**: `17841402369678583`
**URL producao**: https://mkt-insta.vercel.app
**Repositorio**: https://github.com/marcelowelcome/mkt-insta

---

## 2. Stack Tecnologica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui (v3, Radix primitives) |
| Graficos | Recharts |
| Backend | Next.js API Routes (Route Handlers) |
| Banco de dados | Supabase (PostgreSQL + pgvector) |
| Auth | CRON_SECRET via lib/auth.ts (centralizado) |
| Fonte de dados | Meta Graph API v21.0 (Instagram Graph API) |
| Deploy | Vercel |
| Cron Jobs | Supabase pg_cron + pg_net |
| Storage | Supabase Storage (story media) |
| Email Reports | Resend |
| Embeddings | OpenAI text-embedding-3-small (RAG) |
| Geracao IA | Anthropic Claude API (Campaign Studio) |

---

## 3. Fluxo de Dados

### 3.1 Analytics (existente)
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

### 3.2 Campaign Studio (novo)
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
```

---

## 4. Estrutura de Diretorios

### 4.1 Modulo de Analytics (estado atual — implementado)
```
/app
  page.tsx                              <- Redirect para /dashboard/instagram
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
      /competitors/page.tsx             <- Benchmarking de concorrentes (CRUD)
      /calendar/page.tsx                <- Calendario editorial (CRUD mensal + Kanban view)
      /calendar/[id]/page.tsx           <- Editor completo de entrada com preview Instagram
      /messages/page.tsx                <- Inbox de DMs + gestao de auto-reply rules
      /report/page.tsx                  <- Relatorio PDF mensal
```

### 4.2 Campaign Studio (novo)
```
/app
  /dashboard
    /instagram
      /campaigns
        page.tsx                        <- Lista de campanhas com status
        /new
          page.tsx                      <- Briefing form (step 1)
          /generating
            page.tsx                    <- Streaming de geracao (step 2)
        /[id]
          page.tsx                      <- Campaign Editor — revisao e aprovacao (step 3)
          /report
            page.tsx                    <- Relatorio da campanha (parcial ou final)
      /knowledge
        page.tsx                        <- Gestao da Knowledge Base (upload de PDFs, status)
```

### 4.3 API Routes
```
/app/api/instagram
  /sync/route.ts                        <- Cron principal
  /sync-stories/route.ts                <- Cron stories
  /sync-audience/route.ts               <- Cron audiencia semanal
  /posts/route.ts
  /reels/route.ts
  /stories/route.ts
  /insights/route.ts
  /audience/route.ts
  /hashtags/route.ts
  /competitors/route.ts
  /calendar/route.ts                    <- GET/POST/PUT/DELETE (recebe posts do Campaign Studio)
  /calendar/[id]/route.ts              <- GET entrada individual do calendario
  /report/route.ts
  /refresh-token/route.ts
  /export/route.ts                      <- GET exportacao CSV
  /publish/route.ts                     <- POST publica no Instagram via Meta API
  /auto-publish/route.ts               <- POST cron que publica automaticamente posts agendados
  /comments/route.ts                   <- GET lista + POST sync/reply/hide/delete comentarios
  /mentions/route.ts                   <- GET lista + POST sync/save mencoes e tags
  /messages/route.ts                   <- GET conversas + POST enviar DM
  /messages/[conversationId]/route.ts  <- GET mensagens de uma conversa
  /auto-reply/route.ts                <- CRUD regras de auto-reply
  /messages/route.ts                    <- GET conversas / POST enviar resposta via Instagram API
  /messages/[conversationId]/route.ts   <- GET mensagens de uma conversa
  /auto-reply/route.ts                  <- GET/POST/PUT/DELETE regras de auto-reply

/app/api/webhooks
  /instagram/route.ts                   <- GET verify + POST recebe eventos (messages, comments)

/app/api/campaigns                      <- (Campaign Studio)
  /generate/route.ts                    <- Orquestra RAG + Claude API com streaming
  /route.ts                             <- GET lista
  /compare/route.ts                    <- GET compara campanhas por tags
  /[id]/route.ts                        <- GET campanha / PATCH status e tags
  /[id]/posts/route.ts                  <- GET posts da campanha
  /[id]/posts/[postId]/route.ts         <- PATCH edicao de post individual
  /[id]/chat/route.ts                   <- POST chat estrategico com IA sobre a campanha
  /[id]/schedule/route.ts               <- POST envia posts aprovados para o calendario
  /[id]/report/route.ts                <- GET relatorio da campanha (parcial ou final)
  /[id]/media/route.ts                 <- POST/DELETE vincular midias reais a campanha

/app/api/knowledge                      <- (novo — RAG)
  /ingest/route.ts                      <- Upload e ingestao de PDFs
  /scrape/route.ts                      <- Dispara scraping do site (manual ou cron)
  /documents/route.ts                   <- GET lista / PATCH toggle ativo
```

### 4.4 Lib
```
/lib
  meta-client.ts                        <- Wrapper Meta Graph API v21.0 (com retry/backoff)
  supabase.ts                           <- Clientes Supabase (server + browser)
  analytics.ts                          <- Funcoes puras de calculo
  auth.ts                               <- Auth centralizada (validateCronSecret, escapeHtml)
  storage.ts                            <- Persistencia de media no Supabase Storage
  report-generator.ts                   <- Geracao de relatorio HTML mensal
  constants.ts                          <- Constantes (API URL, pesos, cores, formatadores)
  utils.ts                              <- cn() para classes Tailwind
  rag/
    embeddings.ts                       <- (novo) Wrapper OpenAI Embeddings API
    chunker.ts                          <- (novo) Chunking de texto (512 tokens, overlap 64)
    vector-search.ts                    <- (novo) Query ao pgvector via search_knowledge()
    pdf-parser.ts                       <- (novo) Extracao de texto de PDFs
    site-scraper.ts                     <- (novo) Web scraper do site da Welcome Weddings
  campaign/
    prompt-builder.ts                   <- (novo) Monta prompt com 3 camadas de contexto
    campaign-parser.ts                  <- (novo) Parseia e valida JSON gerado pelo Claude
    system-prompt.ts                    <- (novo) System prompt com boas praticas do Instagram
```

### 4.5 Components
```
/components/instagram
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
  EditorialCalendar.tsx                 <- Calendario mensal com publicacao direta
  CalendarKanban.tsx                    <- Visao Kanban do calendario (drag-and-drop)
  ExportButton.tsx
  StoryMetrics.tsx                       <- Metricas de stories
  /campaigns
    BriefingForm.tsx                    <- Formulario de briefing (step 1)
    GeneratingScreen.tsx                <- Tela de streaming com progresso (step 2)
    PostEditor.tsx                      <- Edicao inline de post individual (nao-destrutiva)
    CampaignTimeline.tsx                <- Linha do tempo visual da campanha
    ScheduleButton.tsx                  <- Envia posts aprovados para o calendario editorial
    StrategyChatPanel.tsx               <- Chat com IA para discutir estrategia
  /knowledge                            <- (novo)
    KnowledgeBaseManager.tsx            <- Upload, lista e toggle de documentos indexados

/components/ui                          <- shadcn/ui v3 (Radix primitives)
  badge.tsx, button.tsx, card.tsx, dialog.tsx, select.tsx, separator.tsx,
  skeleton.tsx, table.tsx, tabs.tsx, textarea.tsx

/hooks
  useInstagramMetrics.ts
  usePostPerformance.ts
  useReelPerformance.ts

/types
  instagram.ts                          <- Tipos TypeScript para todas as entidades
                                           (incluindo Campaign Studio — ver secao 6)
```

---

## 5. Banco de Dados (Supabase)

### 5.1 Tabelas existentes

| Tabela | Descricao | Chave unica |
|--------|-----------|-------------|
| `instagram_account_snapshots` | Snapshots diarios da conta | `date` |
| `instagram_posts` | Posts do feed (IMAGE, VIDEO, CAROUSEL_ALBUM) | `media_id` |
| `instagram_reels` | Reels com metricas de video | `media_id` |
| `instagram_stories` | Stories (expiracao 24h) | `media_id` |
| `instagram_audience_snapshots` | Demograficos semanais (JSONB) | `week_start` |
| `instagram_competitors` | Concorrentes monitorados | `username` |
| `instagram_competitor_snapshots` | Snapshots de concorrentes | `(competitor_id, date)` |
| `instagram_editorial_calendar` | Planejamento editorial — recebe posts do Campaign Studio | `id` |
| `app_config` | Configuracao (tokens, etc.) | `key` |

Schema das tabelas existentes: `supabase/migrations/001_initial_schema.sql`

### 5.2 Tabelas novas — Campaign Studio

```sql
-- Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Documentos indexados na Knowledge Base
CREATE TABLE knowledge_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  source_type  TEXT NOT NULL,          -- PDF | WEBSITE | MANUAL
  source_url   TEXT,
  file_name    TEXT,
  description  TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  indexed_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chunks de texto com embeddings vetoriais
CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  content       TEXT NOT NULL,
  token_count   INTEGER,
  embedding     vector(1536),          -- OpenAI text-embedding-3-small
  metadata      JSONB,                 -- { "page": 3, "section": "Tom de Voz" }
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Funcao de busca vetorial (cosine similarity)
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.70,
  match_count     INT DEFAULT 8
)
RETURNS TABLE (
  id UUID, content TEXT, metadata JSONB, document_id UUID, similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT dc.id, dc.content, dc.metadata, dc.document_id,
         1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN knowledge_documents kd ON kd.id = dc.document_id
  WHERE kd.is_active = TRUE
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Campanhas geradas pelo Campaign Studio
CREATE TABLE instagram_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  status           TEXT DEFAULT 'DRAFT',
  -- DRAFT | GENERATING | REVIEW | APPROVED | SCHEDULED | ARCHIVED

  -- Briefing do usuario
  objective        TEXT,
  target_audience  TEXT,
  theme            TEXT,
  tone_notes       TEXT,
  duration_days    INTEGER,
  start_date       DATE,
  preferred_formats TEXT[],

  -- Metadados de geracao
  context_chunks_used INTEGER,
  model_used          TEXT,
  generation_time_ms  INTEGER,
  generated_at        TIMESTAMP WITH TIME ZONE,

  -- Output da IA
  campaign_summary    TEXT,
  strategic_rationale TEXT,

  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts individuais de cada campanha
CREATE TABLE campaign_posts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID REFERENCES instagram_campaigns(id) ON DELETE CASCADE,
  post_order       INTEGER NOT NULL,

  -- Conteudo gerado pela IA
  format           TEXT NOT NULL,      -- REEL | CAROUSEL | IMAGE | STORY
  scheduled_for    TIMESTAMP WITH TIME ZONE,
  caption          TEXT,
  hashtags         TEXT[],
  cta              TEXT,
  visual_brief     TEXT,
  reel_concept     TEXT,
  reel_duration    TEXT,
  audio_suggestion TEXT,
  slides           JSONB,
  strategic_note   TEXT,

  -- Edicoes do analista (preserva original)
  caption_edited   TEXT,
  hashtags_edited  TEXT[],
  visual_notes     TEXT,

  -- Status de revisao
  status           TEXT DEFAULT 'PENDING',
  -- PENDING | APPROVED | REVISION_REQUESTED
  analyst_notes    TEXT,

  -- Vinculo com o calendario editorial apos agendamento
  calendar_entry_id UUID REFERENCES instagram_editorial_calendar(id),

  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5.3 Indices

```sql
-- Existentes
idx_posts_timestamp ON instagram_posts(timestamp DESC)
idx_reels_timestamp ON instagram_reels(timestamp DESC)
idx_stories_timestamp ON instagram_stories(timestamp DESC)
idx_account_snapshots_date ON instagram_account_snapshots(date DESC)
idx_competitor_snapshots_date ON instagram_competitor_snapshots(date DESC)

-- Novos
idx_campaign_posts_campaign ON campaign_posts(campaign_id)
idx_campaigns_status ON instagram_campaigns(status)
```

### 5.4 Migrations

| Arquivo | Descricao |
|---------|-----------|
| `001_initial_schema.sql` | Schema completo (9 tabelas + indices + app_config) |
| `002_pg_cron_setup.sql` | pg_cron + pg_net para 4 cron jobs |
| `003_stories_new_fields.sql` | Campos media_type, media_url, permalink, follows, shares, navigation para stories |
| `004_stories_storage.sql` | Bucket story-media + stored_media_url |
| `005_stories_video_url.sql` | stored_video_url para videos persistidos |
| `006_campaign_studio.sql` | pgvector, knowledge_documents, document_chunks, instagram_campaigns, campaign_posts, search_knowledge() |
| `007_publishing_support.sql` | media_url, carousel_urls, published_at, publish_error no calendario |
| `008_campaign_strategy_fields.sql` | format_strategy, timing_strategy, expected_results nas campanhas |
| `009_publishing_enhancements.sql` | location_id, user_tags, alt_text, collaborators, cover_url, auto_publish |
| `010_campaign_tags_and_grouping.sql` | tags nas campanhas, campaign_id em posts/reels/stories (GIN index) |
| `011_messaging.sql` | conversations, messages, auto_reply_rules, reply_templates, webhook_events |

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
| `dashig-knowledge-scrape` | `0 6 * * 1` (seg 6h BRT) | (novo) Re-indexa o site da Welcome Weddings no pgvector |

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
site-scraper.ts (paginas de destinos, pacotes, sobre, depoimentos)
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
- **Streaming**: obrigatorio — geracao leva 30–90s
- **Chat estrategico**: `/api/campaigns/[id]/chat` para analista discutir estrategia com a IA

### 9.4 Fluxo de agendamento

Ao aprovar todos os posts de uma campanha, o analista clica em "Agendar campanha". O sistema:
1. Para cada `campaign_post` com status `APPROVED`, cria uma entrada em `instagram_editorial_calendar`
2. Campos mapeados: `scheduled_for`, `format` (content_type), `caption_edited ?? caption`, `hashtags_edited ?? hashtags`, `cta`, `visual_brief` + `visual_notes` (como notes)
3. Vincula `campaign_post.calendar_entry_id` ao id criado
4. Atualiza `instagram_campaigns.status` para `SCHEDULED`

O time de social visualiza os posts agendados no calendario editorial existente e executa a publicacao manualmente.

---

## 10. Seguranca

### Auth de cron jobs
- Todas as rotas POST de sync e knowledge usam `lib/auth.ts:validateCronSecret()`
- Header: `Authorization: Bearer {CRON_SECRET}`
- CRON_SECRET deve ser cryptograficamente seguro (min 32 chars em producao)

### Token Meta
- Long-Lived Token (60 dias) salvo na tabela `app_config`
- Fallback para `process.env.META_ACCESS_TOKEN` apenas no setup inicial
- Sync diario verifica expiracao (alerta se < 15 dias)
- Refresh via `POST /api/instagram/refresh-token`

### Supabase
- `SUPABASE_SERVICE_ROLE_KEY` apenas em API Routes via `createServerSupabaseClient()`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` para Client Components via `createBrowserSupabaseClient()`

### XSS
- Report generator usa `escapeHtml()` de `lib/auth.ts` para sanitizar captions no HTML

### API Keys de IA
- `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` sao server-only (sem prefixo NEXT_PUBLIC_)
- Nunca expor no client — embeddings e geracao apenas em API Routes

---

## 11. Variaveis de Ambiente

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

# Site para scraping
WELCOME_WEDDINGS_SITE_URL=https://www.welcomeweddings.com.br
```

---

## 12. Status do Roadmap

### Fases 1–5 — Analytics (CONCLUIDAS)
- [x] Meta App + Long-Lived Token
- [x] 9 tabelas no Supabase + indices
- [x] meta-client.ts com endpoints v21+ corrigidos
- [x] Cron jobs via pg_cron + pg_net
- [x] Overview: KPIs, graficos, top posts, heatmap, scorecard
- [x] Posts, Reels, Stories, Growth, Audience, Hashtags
- [x] Content Scorecard, QEI, Heatmap de horarios
- [x] Benchmarking de concorrentes (CRUD)
- [x] Relatorio mensal (Resend)
- [x] Calendario editorial (CRUD)
- [x] Exportacao CSV
- [x] Supabase Storage (story media)
- [x] Auth centralizada, error boundaries, XSS prevention, batch content scores

### Campaign Studio — Fase A: Fundacao RAG (CONCLUIDA)
- [x] Habilitar pgvector no Supabase
- [x] Migration 006: tabelas + funcao search_knowledge()
- [x] embeddings.ts, chunker.ts, pdf-parser.ts
- [x] /api/knowledge/ingest (upload de PDFs)
- [x] KnowledgeBaseManager.tsx (UI de upload e gestao)
- [x] /api/knowledge/scrape (scraping inline no route handler)
- [x] pg_cron: dashig-knowledge-scrape (seg 6h BRT)
- [x] Busca vetorial testada com queries reais

### Campaign Studio — Fase B: Geracao (CONCLUIDA)
- [x] system-prompt.ts com boas praticas do Instagram 2025/2026
- [x] prompt-builder.ts (3 camadas de contexto)
- [x] /api/campaigns/generate com streaming (Claude Sonnet)
- [x] campaign-parser.ts com validacao de schema
- [x] Persistencia de posts inline no route handler
- [x] BriefingForm.tsx
- [x] GeneratingScreen.tsx com progresso em tempo real
- [x] Teste end-to-end: briefing -> geracao -> save

### Campaign Studio — Fase C: Campaign Editor (CONCLUIDA)
- [x] Lista de campanhas (/campaigns page)
- [x] Campaign Editor inline na pagina /campaigns/[id]
- [x] PostEditor.tsx (edicao inline nao-destrutiva)
- [x] CampaignTimeline.tsx (timeline visual)
- [x] Aprovacao post a post (PENDING -> APPROVED)
- [x] Barra de progresso de aprovacao
- [x] API /campaigns/[id] GET + PATCH
- [x] API /campaigns/[id]/posts/[postId] PATCH

### Campaign Studio — Fase D: Agendamento (CONCLUIDA)
- [x] /api/campaigns/[id]/schedule
- [x] ScheduleButton.tsx
- [x] Mapeamento campaign_posts -> instagram_editorial_calendar
- [x] Vinculo campaign_post.calendar_entry_id
- [x] Atualizacao de status da campanha para SCHEDULED

### Publicacao e Calendario Avancado (CONCLUIDA)
- [x] Publicacao direta no Instagram (IMAGE, CAROUSEL, REEL)
- [x] Auto-publish via cron (publica no horario agendado)
- [x] Editor completo de entrada com preview Instagram ao vivo
- [x] Suporte a localizacao, user tags, alt text, collaborators, cover
- [x] Kanban view para calendario (drag-and-drop entre status)
- [x] Relatorios de campanha (parcial e final)
- [x] Tags de campanha para comparacao
- [x] Vinculacao de midias reais a campanhas
- [x] Chat estrategico com IA por campanha

### Sprint 2: DMs Automatizados + Webhooks (CONCLUIDA)
- [x] Webhook endpoint (GET verify + POST events) para Instagram
- [x] Tabelas: conversations, messages, auto_reply_rules, reply_templates, webhook_events
- [x] Inbox de DMs com chat view e polling (15s)
- [x] Envio de resposta via Instagram Messaging API
- [x] Auto-reply por keyword (contains/exact/starts_with) com prioridade
- [x] UI de gestao de regras de auto-reply

### Sprint 3: Comentarios + Mencoes (CONCLUIDA)
- [x] API de comentarios (sync, reply, hide, delete via Meta API)
- [x] Classificacao de sentimento (positive/neutral/negative/question)
- [x] Pagina de gestao com filtros (todos/sem resposta/perguntas/ocultos)
- [x] Reply inline com feedback instantaneo
- [x] Rastreamento de mencoes e tags da marca
- [x] Pagina de UGC com galeria de midias e save/unsave

### Proximos passos (backlog)

**Sprint 4: Hashtags + Performance**
- [ ] Monitoramento de hashtags via API (30 hashtags/semana)
- [ ] Dashboard de hashtags com trends
- [ ] Dynamic import do Recharts para reduzir bundle

**Sprint 5: Auth, Dark Mode, Polish**
- [ ] Autenticacao de usuario (Supabase Auth)
- [ ] Role-based access (admin vs viewer)
- [ ] Dark mode toggle
- [ ] Accessibility pass (aria labels, keyboard nav)
- [ ] Testes unitarios para analytics.ts e meta-client.ts
- [ ] Integracao com Canva API para geracao de assets (futuro)

---

## 13. Decisoes Tecnicas Importantes

1. **shadcn/ui v3 (Radix)**: Compativel com Tailwind CSS v3. A versao 4 (base-ui) NAO e compativel com Next.js 14.
2. **Meta API v21/v22**: `metric_type=total_value` obrigatorio para insights de conta. `follower_demographics` com `breakdown` substitui `audience_gender_age`. `impressions` removido. Stories usam `navigation`.
3. **Batch content scores**: 4 queries por tier em vez de N queries individuais.
4. **Auth centralizada**: `lib/auth.ts` para `validateCronSecret()` (cron), `validateDashboardRequest()` (dashboard) e `escapeHtml()`.
5. **Error boundaries**: `app/dashboard/instagram/error.tsx`.
6. **QEI no frontend**: Runtime para pesos ajustaveis.
7. **Stories persistidos**: Supabase Storage bucket `story-media` (thumbs/ e videos/).
8. **pg_cron**: Migrado do Vercel (limitacao Hobby). Sem restricao de frequencia.
9. **Audiencia em %**: API retorna absolutos, convertemos para % antes de salvar.
10. **OpenAI apenas para embeddings**: `text-embedding-3-small` (1536 dims). Claude para geracao. Separacao consciente de responsabilidades.
11. **Agendamento via calendario existente**: Campaign Studio nao cria modulo novo — os posts aprovados fluem para `instagram_editorial_calendar`, reutilizando toda a infra existente.
12. **Edicao nao-destrutiva**: `caption_edited`/`hashtags_edited` preservam o output original da IA para comparacao.
13. **Claude Sonnet para geracao**: Usando `claude-sonnet-4-20250514` — melhor relacao custo/velocidade para geracao de campanhas com streaming.

---

## 14. Publicacao Direta no Instagram (IMPLEMENTADA)

### 14.1 Estado atual

O DashIG publica diretamente no Instagram via Meta Graph API. Suporta IMAGE, CAROUSEL e REEL com localizacao, user tags, alt text, collaborators e cover de Reel.

### 14.2 Permissoes (todas granted)

| Permissao | Status |
|---|---|
| `instagram_content_publish` | Granted |
| `instagram_manage_comments` | Granted |
| `instagram_manage_messages` | Granted |
| `instagram_manage_events` | Granted |
| `instagram_manage_contents` | Granted |
| Quota | 100 posts/24h |

### 14.3 Fluxo de publicacao

```
1. POST /{user_id}/media — Cria container (image_url/video_url + caption + params)
2. GET /{container_id}?fields=status_code — Poll ate FINISHED
3. POST /{user_id}/media_publish — Publica o container
```

### 14.4 Parametros suportados

| Parametro | IMAGE | CAROUSEL | REEL |
|---|---|---|---|
| caption | Sim | Sim | Sim |
| location_id | Sim | Sim | Sim |
| user_tags | Sim | Sim (por item) | Nao |
| alt_text | Sim | Sim (por item) | Nao |
| collaborators | Sim | Sim | Sim |
| cover_url | Nao | Nao | Sim |

### 14.5 Auto-publish

Cron `dashig-auto-publish` roda a cada 30 minutos. Publica entradas com:
- `auto_publish = true`
- `status = 'APPROVED'`
- `scheduled_for <= now`
- `media_url` preenchida

### 14.6 Cron jobs ativos

| Job | Schedule | Endpoint |
|---|---|---|
| `dashig-sync-daily` | `0 11 * * *` (8h BRT) | POST /api/instagram/sync |
| `dashig-sync-stories` | `0 14 * * *` (11h BRT) | POST /api/instagram/sync-stories |
| `dashig-sync-audience` | `0 11 * * 1` (seg 8h BRT) | POST /api/instagram/sync-audience |
| `dashig-report-monthly` | `0 8 1 * *` (dia 1, 5h BRT) | POST /api/instagram/report |
| `dashig-knowledge-scrape` | `0 9 * * 1` (seg 6h BRT) | POST /api/knowledge/scrape |
| `dashig-auto-publish` | `*/30 * * * *` (30 em 30 min) | POST /api/instagram/auto-publish |
