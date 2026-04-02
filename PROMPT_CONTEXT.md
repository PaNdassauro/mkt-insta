# PROMPT_CONTEXT.md — DashIG
> Contexto de negocio e produto para sessoes de desenvolvimento com agentes de IA

---

## 1. Quem e o cliente deste projeto

**Welcome Weddings** faz parte do Welcome Group, com sede em Curitiba (PR). O grupo inclui a Welcome Trips (viagens B2C) e a Welcome Weddings (casamentos no exterior / destination weddings).

O Instagram da Welcome Weddings (@welcomeweddings) e um canal estrategico de geracao de leads e construcao de marca. A equipe de marketing precisa de visibilidade real sobre o que funciona e de uma ferramenta que acelere a producao de campanhas com qualidade e embasamento nos dados reais do perfil.

**Conta monitorada**: `@welcomeweddings` (Welcome Weddings | Destination Weddings)
**IG User ID**: `17841402369678583`
**Seguidores**: ~34.700 (marco/2026)
**URL producao**: https://mkt-insta.vercel.app
**Repositorio**: https://github.com/marcelowelcome/mkt-insta

---

## 2. O que e o DashIG

DashIG e um dashboard interno completo para gestao de Instagram, com os seguintes modulos:

### 2.1 Analytics (Sprints 1-5)
Resolve tres problemas concretos:
1. **Historico limitado**: Instagram nativo guarda 90 dias. DashIG guarda indefinidamente via Supabase.
2. **Falta de inteligencia**: Insights nativo nao calcula scores, nao sugere horarios, nao classifica conteudo.
3. **Sem visao comparativa**: Sem benchmarking de concorrentes nem comparativo entre formatos.

### 2.2 Campaign Studio (Sprints 1-5 + 6-9)
Resolve o problema de producao de campanhas:
- Time gasta horas planejando campanhas manualmente, sem acesso facil ao historico de performance
- Output e generico — nao reflete o que realmente funciona no perfil da Welcome Weddings
- Campaign Studio entrega uma campanha estruturada e embasada em dados em minutos
- O analista foca em revisar e refinar, nao em criar do zero

### 2.3 Engagement (Sprints 2-3)
Gestao unificada de interacoes:
- **Comentarios**: sync, reply, hide, delete, classificacao de sentimento
- **Mensagens (DMs)**: inbox com chat view, envio de respostas, auto-reply por keyword
- **Mencoes**: rastreamento de tags da marca, galeria UGC

### 2.4 Funcionalidades adicionais (Sprints 6-16)
- **Knowledge Base**: documentos indexados (PDFs + site) para RAG
- **Calendario Editorial**: 3 visoes (mensal, Kanban, tabela com bulk actions) com publicacao direta e entradas recorrentes
- **Motor de Recomendacoes**: sugestoes acionaveis baseadas em dados historicos
- **Monitoramento de Concorrentes**: sync automatico semanal via Meta Graph API + relatorio competitivo + alertas de crescimento
- **Hashtag Monitor**: monitoramento de hashtags (top/recent media)
- **Roles de Usuario**: admin/editor/viewer com controle de acesso
- **Log de Atividades**: registro de acoes do sistema
- **Saude do Sistema**: dashboard com status do token, syncs, DB stats, storage
- **Notification Badges**: badges em tempo real para comentarios, campanhas, mensagens
- **Designer Brief**: endpoint para gerar brief visual de campanha
- **Multi-account**: suporte completo a multiplas contas Instagram (OAuth, filtro por conta, crons multi-conta)
- **Alertas Telegram**: notificacoes configuradas via Telegram Bot API
- **Logging Estruturado**: JSON em producao (Vercel Log Drain), ANSI em dev
- **Filtro de Periodo**: seletor global de periodo (7d, 30d, 90d, 365d, all) com persistencia
- **Templates de Campanha**: salvar e reutilizar briefings de campanhas anteriores
- **Auto-categorizacao**: classificacao automatica de conteudo por keywords
- **Webhook Slack/Teams**: notificacoes via webhook generico para Slack ou Teams
- **Canva Connect API**: integracao completa (OAuth PKCE, listagem de templates, autofill, export)

---

## 3. Usuarios do sistema

O sistema possui tres papeis com controle de acesso (tabela `user_roles`):

| Role | Permissoes |
|---|---|
| **admin** | Acesso total. Gerencia usuarios, configura sistema, exporta dados, gerencia contas |
| **editor** | Cria e edita campanhas, agenda posts, gerencia calendario, comentarios e mensagens |
| **viewer** | Acesso somente leitura a dashboards e relatorios |

| Perfil | Role | Necessidade |
|---|---|---|
| Gestor de Marketing (Marcelo) | admin | Visao executiva de performance mensal, tendencias, benchmarks, aprovacao de campanhas e gestao de usuarios |
| Social Media / Analista | editor | Operacional: posts que performaram, melhores horarios, hashtags, revisao e edicao de campanhas |
| Designer | viewer | Recebe briefs de imagem dos posts aprovados para producao de assets |
| Diretoria | viewer | Relatorio mensal consolidado (PDF automatico por email) |

---

## 4. Conceitos de dominio — Analytics

### 4.1 Metricas principais

| Termo | Definicao |
|---|---|
| **Reach** | Numero unico de contas que viram o conteudo |
| **Engagement Rate** | (likes + comments + saves + shares) / reach x 100 |
| **QEI** | Qualitative Engagement Index: saves (x4) e shares (x5) valem mais que likes (x1) |
| **Completion Rate** | % do Reel assistido ate o fim (avg_watch_time / duration) |
| **Views** | Metrica base de Reels desde abril/2025 — substitui Plays |
| **Navigation** | Acoes em Stories (substitui taps_forward/taps_back/exits na v22+) |
| **Content Score** | Tier calculado (VIRAL / GOOD / AVERAGE / WEAK) baseado em desvio padrao do engagement |
| **Sends per Reach** | Compartilhamentos via DM / reach — sinal mais forte do algoritmo em 2025/2026 |

### 4.2 Metricas descontinuadas (NAO usar)

| Metrica antiga | Substituicao |
|---|---|
| `plays` | `views` (Reels) |
| `impressions` | Removido para conta e midias (v22+) |
| `following_count` | Removido (v21+) |
| `audience_gender_age` | `follower_demographics` com `breakdown=age,gender` |
| `audience_city` | `follower_demographics` com `breakdown=city` |
| `exits`, `taps_forward`, `taps_back` | `navigation` (Stories v22+) |

### 4.3 Tipos de conteudo

| Tipo | Media Type na API | Particularidades |
|---|---|---|
| Foto | `IMAGE` | Metricas padrao |
| Carrossel | `CAROUSEL_ALBUM` | Reach alto por swipes, otimo para saves |
| Video feed | `VIDEO` | Pouco usado, substituido por Reels |
| Reel | `VIDEO` (media_product_type=REELS) | Views e completion rate sao as metricas chave |
| Story | Endpoint separado | Expira em 24h. Thumbnails e videos persistidos no Supabase Storage |

---

## 5. Conceitos de dominio — Campaign Studio

### 5.1 O que e uma campanha

Uma campanha no DashIG e um conjunto estruturado de posts para o Instagram, gerado pela IA com base em tres camadas de contexto e revisado pelo time de marketing antes de ser agendado.

Cada campanha contem:
- Sumario estrategico e racional de por que aquela estrutura faz sentido
- Posts individuais com caption, hashtags, CTA, brief de imagem e nota estrategica
- Datas e horarios sugeridos com base no historico de performance do perfil
- Formato escolhido com base nos dados (Reel, Carrossel, Imagem, Story)

### 5.2 Fontes de contexto da IA

| Camada | Fonte | Conteudo |
|---|---|---|
| **Marca e negocio** | PDFs indexados + site scraping | Playbook comercial, tom de voz, destinos, pacotes, depoimentos, diferenciais |
| **Performance do perfil** | Supabase (dados reais) | Top posts por score, melhores horarios, hashtags mais eficazes, demograficos da audiencia |
| **Boas praticas** | System prompt (atualizado periodicamente) | Algoritmo do Instagram 2025/2026, estrutura de copy, timing, frequencia |

### 5.3 Documentos indexados na Knowledge Base

| Documento | O que a IA extrai |
|---|---|
| Playbook comercial | Argumentos de venda, objecoes, diferenciais, perfil de cliente ideal |
| Roteiro de vendas / SDR | Tom de abordagem, linguagem com o cliente |
| Materiais de marca | Tom de voz, valores, o que a marca e e nao e, exemplos de copy aprovado |
| Identidade visual | Referencias de estilo para os briefs de imagem |
| Site welcomeweddings.com.br | Destinos, pacotes, historia, depoimentos, diferenciais (re-indexado semanalmente) |

### 5.4 Fluxo de revisao e agendamento

```
1. Gestor preenche briefing (tema, objetivo, publico, duracao)
      |
2. IA gera campanha com streaming (30-60s)
      |
3. Analista revisa no Campaign Editor
   - Edita captions, hashtags, CTAs
   - Valida e ajusta briefs de imagem
   - Aprova ou solicita revisao post a post
      |
4. Posts aprovados -> Designer recebe briefs de imagem
      |
5. Com assets em maos, analista agenda a campanha
      |
6. Posts fluem para o Calendario Editorial existente
      |
7. Publicacao manual pelo calendario OU automatica via auto-publish (opt-in)
```

**Importante**: a IA gera um ponto de partida qualificado — o analista tem controle total. A publicacao pode ser manual (seguindo o calendario) ou automatica via opt-in: entradas com `auto_publish = true`, status `APPROVED`, `scheduled_for <= now` e `media_url` preenchida sao publicadas automaticamente por um cron que roda a cada 30 minutos.

### 5.5 Terminologia do Campaign Studio

| Termo | Definicao |
|---|---|
| **Knowledge Base** | Conjunto de documentos indexados que alimentam o RAG |
| **Chunk** | Fragmento de texto de ~512 tokens extraido de um documento |
| **Embedding** | Representacao vetorial de um chunk para busca por similaridade |
| **RAG** | Retrieval-Augmented Generation — enriquece o prompt com contexto recuperado |
| **Vector Search** | Busca os chunks mais relevantes para o tema da campanha |
| **Brief de imagem** | Descricao textual detalhada do conceito visual para orientar o designer |
| **Edicao nao-destrutiva** | Editar `caption_edited` sem sobrescrever `caption` (output original preservado) |
| **Campaign Editor** | Interface de revisao e edicao da campanha gerada |
| **Agendamento** | Envio dos posts aprovados para o Calendario Editorial do DashIG |
| **Designer Brief** | Endpoint dedicado para extrair briefs visuais formatados de uma campanha |

### 5.6 Funcionalidades do Campaign Studio

| Funcionalidade | Descricao |
|---|---|
| **Strategy Chat Panel** | Chat com IA (Claude) integrado na pagina da campanha para discutir estrategia, ajustar abordagem e tirar duvidas sobre a campanha gerada |
| **Comparacao de campanhas** | Pagina dedicada para comparar campanhas lado a lado por tags, com metricas agregadas e radar chart (Recharts) |
| **Agendamento no calendario** | Posts aprovados de uma campanha sao enviados diretamente para o calendario editorial via `/api/campaigns/[id]/schedule` |
| **Activity logging** | Eventos de campanha (criacao, aprovacao, agendamento) sao registrados na tabela `activity_log` |
| **Designer Brief** | Endpoint `/api/campaigns/[id]/brief` gera brief visual formatado para o designer |
| **Vinculacao de midias** | Endpoint `/api/campaigns/[id]/media` permite vincular midias reais publicadas a campanhas |
| **Relatorio de campanha** | Pagina `/campaigns/[id]/report` exibe relatorio parcial ou final da campanha |

---

## 6. Infraestrutura

### 6.1 Servicos

| Componente | Servico |
|---|---|
| Frontend + API | Vercel (https://mkt-insta.vercel.app) |
| Banco de dados | Supabase PostgreSQL + pgvector |
| Cron jobs | Supabase pg_cron + pg_net (chama endpoints do Vercel) |
| Storage | Supabase Storage (bucket `story-media`) |
| Email | Resend |
| Embeddings | OpenAI text-embedding-3-small (server-only) |
| Geracao de campanhas | Anthropic Claude claude-sonnet-4-20250514 (server-only) |
| Notificacoes | Telegram Bot API + Webhook (Slack/Teams) |
| Assets visuais | Canva Connect API (OAuth PKCE) |

### 6.2 Cron jobs (pg_cron) — 7 jobs

| Job | Schedule | Endpoint |
|---|---|---|
| `dashig-sync-daily` | `0 11 * * *` (8h BRT) | POST /api/instagram/sync |
| `dashig-sync-stories` | `0 14 * * *` (11h BRT) | POST /api/instagram/sync-stories |
| `dashig-sync-audience` | `0 11 * * 1` (seg 8h BRT) | POST /api/instagram/sync-audience |
| `dashig-report-monthly` | `0 8 1 * *` (dia 1, 5h BRT) | POST /api/instagram/report |
| `dashig-knowledge-scrape` | `0 6 * * 1` (seg 6h BRT) | POST /api/knowledge/scrape |
| `dashig-auto-publish` | `*/30 * * * *` (30 em 30 min) | POST /api/instagram/auto-publish |
| `dashig-sync-competitors` | `0 11 * * 1` (seg 8h BRT) | POST /api/instagram/sync-competitors |

### 6.3 Numeros do projeto (abril/2026)

| Metrica | Valor |
|---|---|
| Migrations | 25 (001 a 025) |
| API routes (route.ts) | 63 |
| Pages (page.tsx) | 29 |
| Hooks | 7 |
| Unit tests (vitest) | 11 arquivos |
| E2E tests (Playwright) | 5 specs |

---

## 7. Regras de negocio criticas

1. **Nunca deletar dados historicos** — apenas upsert (ON CONFLICT DO UPDATE).
2. **Stories persistidos** — thumbnails e videos salvos no Supabase Storage (bucket `story-media`). Sobrevivem a expiracao de 24h.
3. **Concorrentes = dados publicos apenas** — CRUD manual + sync automatico semanal via Meta Graph API para concorrentes com `ig_user_id` cadastrado.
4. **Views > Plays nos Reels** — desde abril/2025.
5. **QEI calculado no frontend** — runtime para ajuste de pesos.
6. **Content Score em batch** — 4 queries por tier no sync, nunca N queries individuais.
7. **Auth centralizada** — `validateCronSecret()` para cron jobs, `validateDashboardRequest()` para rotas do dashboard, ambos de `lib/auth.ts`.
8. **Audiencia em %** — API retorna absolutos, convertemos para % antes de salvar.
9. **IA gera e agenda, nao publica diretamente** — a IA gera campanhas e agenda no calendario. A publicacao e manual ou via auto-publish (opt-in por entrada, cron a cada 30 min).
10. **Edicao nao-destrutiva** — `caption_edited`/`hashtags_edited` preservam o output original da IA.
11. **Documentos inativos nao alimentam a IA** — `is_active = FALSE` desativa sem deletar.
12. **API Keys de IA sao server-only** — `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` nunca expostos no client.
13. **Logging estruturado** — usar `logger` de `lib/logger.ts`, nunca `console.log` direto.
14. **Respostas de API padronizadas** — usar `apiSuccess`/`apiError` de `lib/api-response.ts`.
15. **Canva tokens no banco** — tokens OAuth do Canva salvos em `canva_tokens`, nunca em variaveis de ambiente. Refresh automatico via `lib/canva-client.ts`.
16. **Webhook silencioso** — `sendWebhookNotification()` retorna silenciosamente se `WEBHOOK_URL` nao estiver configurado. Nao quebra o fluxo.
17. **Classificacao de conteudo** — executada durante o sync, baseada em keywords na caption. Campo `category` em posts e reels.

---

## 8. O que NAO esta no escopo

- Analytics de Instagram Ads (Meta Ads API — escopo futuro)
- App mobile
- Integracao com outras redes sociais (TikTok, LinkedIn — escopo futuro)
- Aprovacao em multiplos niveis hierarquicos (workflow complexo — escopo futuro)

---

## 9. Sprints concluidos (1-16)

### Sprints 1-5: Analytics + Campaign Studio base
- Meta App + Long-Lived Token + 9 tabelas iniciais
- Overview, Posts, Reels, Stories, Growth, Audience, Hashtags
- Concorrentes (CRUD), Relatorio mensal (Resend), Calendario Editorial
- Campaign Studio: RAG (pgvector), Geracao (Claude streaming), Editor, Agendamento
- Publicacao direta no Instagram (IMAGE, CAROUSEL, REEL) + auto-publish
- Kanban view, editor de entrada com preview, tags e comparacao de campanhas
- DMs + Webhooks: inbox, envio, auto-reply por keyword
- Comentarios (sync, reply, hide, delete, sentimento) + Mencoes (tags, UGC)
- Hashtag monitoring (top/recent media)
- Supabase Auth (login, sessao, middleware) + Dark mode + Unit tests (vitest)

### Sprint 6: Sentimento, Hashtag Suggest, Telegram
- Grafico de distribuicao de sentimento (comentarios, ultimos 90 dias)
- Sugestao inteligente de hashtags por caption
- Integracao Telegram (alertas via bot)
- Logging estruturado (`lib/logger.ts`)

### Sprint 7: Roles, Activity Log, RLS
- Tabela `user_roles` (admin/editor/viewer) + funcao SQL `get_user_role()`
- `lib/roles.ts` + API `/api/settings/users` (CRUD, admin only)
- Tabela `activity_log` + `lib/activity.ts` + pagina de consulta
- RLS policies em todas as tabelas (migration 014)

### Sprint 8: Recomendacoes, Competidores, Saude
- Motor de recomendacoes (`/api/instagram/recommendations`)
- Sync automatico de concorrentes via cron semanal
- Dashboard de saude do sistema (`/settings/system`)

### Sprint 9: Exportacao, Multi-account Prep, Polish
- Exportacao administrativa completa (`/api/admin/export-all`)
- Tabela `instagram_accounts` (preparacao multi-conta)
- API `/api/settings/accounts` (CRUD contas)
- Auth em todas as rotas restantes

### Sprints 10-12: Notification Badges, Designer Brief, E2E Tests, Polish
- Notification badges (`/api/notifications/badges` + `useNotificationBadges`)
- Designer brief endpoint (`/api/campaigns/[id]/brief`)
- Session check hook (`useSessionCheck`)
- Current account hook (`useCurrentAccount`)
- ErrorBoundary component
- Messages enrich endpoint (`/api/instagram/messages/enrich`)
- E2E tests (Playwright): auth, calendar, campaigns, dashboard, settings
- Canva client stub (`lib/canva-client.ts`)

### Sprint 13: Multi-account completo
- Instagram OAuth flow para conectar contas (`/api/auth/instagram`, `/api/auth/instagram/callback`)
- Migration 022: `account_id` em todas as tabelas de dados
- Filtro de dados por conta ativa no frontend (header `x-account-id`)
- `lib/account-context.ts` e `lib/fetch-with-account.ts` para contexto de conta
- Cron jobs adaptados para iterar sobre todas as contas ativas

### Sprint 14: Relatorio competitivo, alertas de concorrentes, filtro de periodo
- Relatorio competitivo em PDF (`/api/instagram/competitors/insights`)
- Alertas de crescimento de concorrentes (integrado ao sync)
- Widget de inspiracao de conteudo (`CompetitorInsights`)
- Filtro de periodo global (`PeriodSelector` + hook `usePeriodFilter`)
- Melhorias nos cron jobs multi-conta

### Sprint 15: Templates de campanha, calendario recorrente, classificacao de conteudo, webhook
- Templates de campanha: salvar e reutilizar briefings (`campaign_templates` + `/api/campaigns/templates`)
- Entradas recorrentes no calendario (`recurrence`, `recurrence_end` em `instagram_editorial_calendar`)
- Auto-categorizacao de conteudo por keywords (`lib/content-classifier.ts`, migration 024)
- Webhook generico para Slack/Teams (`lib/webhook-notifier.ts` + `/api/settings/webhook-test`)
- Acoes em lote no calendario (`CalendarTable` com bulk actions)

### Sprint 16: Canva Connect API
- OAuth com PKCE para Canva (`/api/auth/canva`, `/api/auth/canva/callback`, `/api/auth/canva/status`)
- Listagem de templates Canva (`/api/canva/templates`)
- Autofill de templates com dados da campanha (`/api/canva/generate`)
- Exportacao de designs finalizados (`/api/canva/export`)
- Componente `CanvaAssetGenerator` integrado ao Campaign Editor
- Migration 025: tabela `canva_tokens` para gestao de tokens OAuth
- `lib/canva-client.ts` com client completo (token management, templates, autofill, export)
