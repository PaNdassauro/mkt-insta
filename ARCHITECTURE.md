# ARCHITECTURE.md — DashIG
> Instagram Analytics Dashboard · Welcome Trips
> Stack: Next.js 14 · Supabase · Vercel · Meta Graph API

---

## 1. Visão Geral do Projeto

DashIG é um dashboard interno de analytics para acompanhar a performance do perfil do Instagram da Welcome Trips. O sistema coleta dados via Meta Graph API, armazena histórico no Supabase (já que a API do Meta não mantém histórico longo), e exibe os dados em uma interface React com gráficos interativos.

O projeto segue os mesmos padrões arquiteturais do DashWT (dashboard de vendas da Welcome Trips): modular, documentado para agentes de IA, e deployado no Vercel.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Gráficos | Recharts |
| Backend | Next.js API Routes (Route Handlers) |
| Banco de dados | Supabase (PostgreSQL) |
| Auth | Supabase Auth (acesso interno) |
| Fonte de dados | Meta Graph API (Instagram Graph API) |
| Deploy | Vercel |
| Cron Jobs | Vercel Cron |
| Email Reports | Resend |

---

## 3. Fluxo de Dados

```
Meta Graph API
      ↓
/api/instagram/sync (Vercel Cron — diário às 8h BRT)
      ↓
Normalização e upsert no Supabase
      ↓
/api/instagram/[endpoint] (Route Handlers internos)
      ↓
Componentes React (Server Components + Client Components)
      ↓
Dashboard renderizado no browser
```

---

## 4. Estrutura de Diretórios

```
/app
  /dashboard
    /instagram
      page.tsx                    ← Visão Geral (Overview)
      layout.tsx                  ← Layout com sidebar e nav do módulo
      /reels
        page.tsx                  ← Reels Analytics
      /posts
        page.tsx                  ← Feed de posts com métricas
      /stories
        page.tsx                  ← Stories tracker
      /growth
        page.tsx                  ← Crescimento de seguidores
      /audience
        page.tsx                  ← Dados demográficos de audiência
      /hashtags
        page.tsx                  ← Hashtag Intelligence
      /competitors
        page.tsx                  ← Benchmarking de concorrentes
      /calendar
        page.tsx                  ← Calendário editorial
      /report
        page.tsx                  ← Geração de relatório mensal

/app/api
  /instagram
    /sync
      route.ts                    ← Cron job principal (coleta + salva)
    /posts
      route.ts                    ← Endpoint interno: lista de posts
    /insights
      route.ts                    ← Métricas da conta (seguidores, alcance)
    /stories
      route.ts                    ← Stories ativos e histórico
    /reels
      route.ts                    ← Dados específicos de Reels
    /audience
      route.ts                    ← Demographics da conta
    /report
      route.ts                    ← Geração e envio do relatório PDF

/lib
  meta-client.ts                  ← Wrapper da Meta Graph API
  supabase.ts                     ← Cliente Supabase (server + client)
  analytics.ts                    ← Funções de cálculo (engagement rate, scores)
  report-generator.ts             ← Geração de PDF com métricas mensais
  constants.ts                    ← Constantes (endpoints, limites, pesos)

/components
  /instagram
    OverviewKPIs.tsx              ← Cards de KPIs principais
    PostCard.tsx                  ← Card individual de post com métricas
    PostGrid.tsx                  ← Grid de posts ordenáveis
    ReelCard.tsx                  ← Card de Reel com completion rate
    StoryMetrics.tsx              ← Métricas de story individual
    GrowthChart.tsx               ← Gráfico de crescimento de seguidores
    EngagementChart.tsx           ← Gráfico de engajamento por período
    HeatmapPostingTime.tsx        ← Heatmap: melhor hora/dia para postar
    ContentScorecard.tsx          ← Tabela de score de conteúdo por tier
    HashtagTable.tsx              ← Tabela de performance por hashtag
    AudienceDemographics.tsx      ← Gráficos demográficos (idade, país, sexo)
    CompetitorTable.tsx           ← Tabela de benchmarking de concorrentes
    EditorialCalendar.tsx         ← Calendário de planejamento editorial
    QualitativeEngagement.tsx     ← Índice de engajamento qualitativo (saves+shares)

/hooks
  useInstagramMetrics.ts
  usePostPerformance.ts
  useAudienceData.ts

/types
  instagram.ts                    ← Tipos TypeScript para toda a entidade IG
```

---

## 5. Banco de Dados (Supabase)

### 5.1 Tabelas

```sql
-- Snapshots diários da conta
CREATE TABLE instagram_account_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  followers_count INTEGER,
  following_count INTEGER,
  media_count     INTEGER,
  reach_7d        INTEGER,
  impressions_7d  INTEGER,
  profile_views   INTEGER,
  website_clicks  INTEGER,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posts do feed (imagem, vídeo, carrossel)
CREATE TABLE instagram_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id        TEXT NOT NULL UNIQUE,
  media_type      TEXT NOT NULL,  -- IMAGE | VIDEO | CAROUSEL_ALBUM
  caption         TEXT,
  permalink       TEXT,
  thumbnail_url   TEXT,
  timestamp       TIMESTAMP WITH TIME ZONE,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),   -- calculado: (likes+comments+saves+shares)/reach*100
  content_score   TEXT,           -- VIRAL | GOOD | AVERAGE | WEAK
  hashtags        TEXT[],         -- array de hashtags extraídas da caption
  synced_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reels (métricas específicas)
CREATE TABLE instagram_reels (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id            TEXT NOT NULL UNIQUE,
  caption             TEXT,
  permalink           TEXT,
  thumbnail_url       TEXT,
  timestamp           TIMESTAMP WITH TIME ZONE,
  views               INTEGER DEFAULT 0,  -- substitui plays a partir de abr/2025
  likes               INTEGER DEFAULT 0,
  comments            INTEGER DEFAULT 0,
  saves               INTEGER DEFAULT 0,
  shares              INTEGER DEFAULT 0,
  reach               INTEGER DEFAULT 0,
  completion_rate     NUMERIC(5,2),       -- estimado via avg_watch_time/duration
  avg_watch_time_sec  INTEGER,
  duration_sec        INTEGER,
  content_score       TEXT,
  hashtags            TEXT[],
  synced_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stories (janela curta — coletar a cada 6h enquanto ativo)
CREATE TABLE instagram_stories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id     TEXT NOT NULL UNIQUE,
  timestamp    TIMESTAMP WITH TIME ZONE,
  expires_at   TIMESTAMP WITH TIME ZONE,
  reach        INTEGER DEFAULT 0,
  impressions  INTEGER DEFAULT 0,
  exits        INTEGER DEFAULT 0,
  replies      INTEGER DEFAULT 0,
  taps_forward INTEGER DEFAULT 0,
  taps_back    INTEGER DEFAULT 0,
  synced_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dados demográficos (snapshot semanal)
CREATE TABLE instagram_audience_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   DATE NOT NULL,
  age_ranges   JSONB,  -- { "18-24": 15, "25-34": 42, ... }
  gender       JSONB,  -- { "M": 38, "F": 62 }
  top_cities   JSONB,  -- [{ "city": "São Paulo", "pct": 28 }, ...]
  top_countries JSONB,
  active_hours JSONB,  -- { "0": 120, "1": 90, ... "23": 200 }
  active_days  JSONB,  -- { "MON": 1800, ... "SUN": 2200 }
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Concorrentes monitorados (dados públicos)
CREATE TABLE instagram_competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  added_at        DATE DEFAULT CURRENT_DATE
);

CREATE TABLE instagram_competitor_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id       UUID REFERENCES instagram_competitors(id),
  date                DATE NOT NULL,
  followers_count     INTEGER,
  posts_last_30d      INTEGER,
  reels_last_30d      INTEGER,
  avg_likes_last_10   INTEGER,
  avg_comments_last_10 INTEGER,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(competitor_id, date)
);

-- Planejamento editorial
CREATE TABLE instagram_editorial_calendar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  content_type  TEXT,   -- REEL | CAROUSEL | IMAGE | STORY
  topic         TEXT,
  caption_draft TEXT,
  hashtags_plan TEXT[],
  status        TEXT DEFAULT 'DRAFT',  -- DRAFT | APPROVED | PUBLISHED | CANCELLED
  published_media_id TEXT,             -- vincula ao post real após publicação
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5.2 Índices importantes

```sql
CREATE INDEX idx_posts_timestamp ON instagram_posts(timestamp DESC);
CREATE INDEX idx_reels_timestamp ON instagram_reels(timestamp DESC);
CREATE INDEX idx_stories_timestamp ON instagram_stories(timestamp DESC);
CREATE INDEX idx_account_snapshots_date ON instagram_account_snapshots(date DESC);
CREATE INDEX idx_competitor_snapshots_date ON instagram_competitor_snapshots(date DESC);
```

---

## 6. Meta Graph API — Endpoints Utilizados

| Dado | Endpoint | Notas |
|---|---|---|
| Info da conta | `GET /me?fields=followers_count,following_count,media_count` | |
| Lista de posts | `GET /me/media?fields=id,media_type,caption,permalink,thumbnail_url,timestamp` | |
| Insights de post | `GET /{media_id}/insights?metric=reach,impressions,saved,shares` | |
| Métricas de post | `GET /{media_id}?fields=like_count,comments_count` | |
| Insights de Reel | `GET /{media_id}/insights?metric=reach,views,saved,shares,avg_watch_time` | Views substitui plays desde abr/2025 |
| Stories ativos | `GET /me/stories?fields=id,timestamp` | Apenas enquanto story está ativo |
| Insights de story | `GET /{media_id}/insights?metric=reach,impressions,exits,replies,taps_forward,taps_back` | |
| Insights da conta | `GET /me/insights?metric=reach,impressions,profile_views,website_clicks&period=week` | |
| Audiência (idade/sexo) | `GET /me/insights?metric=audience_gender_age&period=lifetime` | Requer conta Business |
| Audiência (localização) | `GET /me/insights?metric=audience_city,audience_country&period=lifetime` | |
| Audiência (horários) | `GET /me/insights?metric=online_followers&period=lifetime` | |

---

## 7. Cron Jobs (Vercel Cron)

```json
// vercel.json
{
  "crons": [
    { "path": "/api/instagram/sync", "schedule": "0 11 * * *" },
    { "path": "/api/instagram/sync-stories", "schedule": "0 */6 * * *" },
    { "path": "/api/instagram/sync-audience", "schedule": "0 11 * * 1" },
    { "path": "/api/instagram/report", "schedule": "0 8 1 * *" }
  ]
}
```

| Job | Frequência | O que faz |
|---|---|---|
| `sync` | Diário às 8h BRT (11h UTC) | Posts, Reels, insights da conta, snapshot de seguidores |
| `sync-stories` | A cada 6h | Stories ativos (expiram em 24h) |
| `sync-audience` | Semanal (segunda) | Snapshot demográfico da audiência |
| `report` | Mensal (dia 1) | Gera e envia relatório PDF por email |

---

## 8. Cálculos e Lógica de Negócio

### 8.1 Engagement Rate
```
engagement_rate = (likes + comments + saves + shares) / reach × 100
```

### 8.2 Qualitative Engagement Index (QEI)
Ponderado: saves e shares valem mais que likes (sinalizam intenção real).
```
QEI = (likes × 1) + (comments × 2) + (saves × 4) + (shares × 5)
QEI_rate = QEI / reach × 100
```

### 8.3 Content Score (Tier)
Baseado no engagement_rate normalizado vs. média histórica do perfil:
```
> média + 1 desvio padrão  → 🔥 VIRAL
> média                    → ✅ GOOD
> média - 1 desvio padrão  → ⚠️ AVERAGE
abaixo                     → ❌ WEAK
```

### 8.4 Heatmap de Melhor Hora para Postar
Cruza `active_hours`/`active_days` da audiência com o `engagement_rate` histórico dos posts por hora/dia, gerando uma recomendação ponderada.

### 8.5 Hashtag Intelligence
Para cada hashtag extraída dos posts, agrega:
- Média de reach dos posts que a utilizaram
- Média de engagement_rate
- Frequência de uso
- Trend (crescimento/queda nas últimas 4 semanas)

---

## 9. Autenticação e Tokens

- Usar **Long-Lived Access Token** (válido por 60 dias)
- Salvar token e data de expiração no Supabase (tabela `app_config`)
- O sync diário verifica se o token expira em menos de 15 dias e dispara alerta por email
- Refresh do token via endpoint `/api/instagram/refresh-token`

```sql
CREATE TABLE app_config (
  key   TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Inserir: key='ig_access_token', key='ig_token_expires_at'
```

---

## 10. Variáveis de Ambiente

```env
# Meta
META_ACCESS_TOKEN=
META_IG_USER_ID=
META_APP_ID=
META_APP_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email (Resend)
RESEND_API_KEY=
REPORT_RECIPIENT_EMAIL=

# Segurança
CRON_SECRET=
```

---

## 11. Módulos por Fase (Roadmap)

### Fase 1 — MVP (Fundação)
- [ ] Setup Meta App + Long-Lived Token
- [ ] Tabelas no Supabase
- [ ] `meta-client.ts` com todos os endpoints
- [ ] Cron jobs de sync (posts, stories, conta)
- [ ] Overview: KPIs principais (seguidores, alcance, engajamento)
- [ ] Posts: grid com métricas inline
- [ ] Growth: gráfico histórico de seguidores

### Fase 2 — Analytics Avançado
- [ ] Reels Analytics (completion rate, views, comparativo vs outros formatos)
- [ ] Content Scorecard (tier automático por post)
- [ ] Heatmap de melhor horário para postar
- [ ] QEI — Qualitative Engagement Index

### Fase 3 — Inteligência de Conteúdo
- [ ] Hashtag Intelligence
- [ ] Audiência Demográfica (idade, gênero, localização, horários)
- [ ] Stories Analytics histórico

### Fase 4 — Estratégico
- [ ] Benchmarking de Concorrentes
- [ ] Relatório PDF automático mensal (Resend)
- [ ] Alertas de anomalia (queda brusca de alcance, post viral)

### Fase 5 — Operacional
- [ ] Calendário Editorial integrado
- [ ] Engajamento Qualitativo detalhado (DM shares)
- [ ] Exportação de dados (CSV)
