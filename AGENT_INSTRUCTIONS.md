# AGENT_INSTRUCTIONS.md — DashIG
> Instrucoes operacionais para agentes de IA que trabalham neste projeto

---

## 1. Contexto rapido

Voce esta desenvolvendo o **DashIG**, um dashboard de analytics, campanhas e engajamento de Instagram para a **Welcome Weddings** (@welcomeweddings). Antes de comecar qualquer tarefa, leia o `ARCHITECTURE.md` (estrutura tecnica) e o `PROMPT_CONTEXT.md` (dominio de negocio).

**Stack**: Next.js 14 · TypeScript · Supabase (PostgreSQL + pgvector + Auth + RLS) · Tailwind CSS v3 · shadcn/ui (v3/Radix) · Recharts · Meta Graph API v21.0 · Vercel · OpenAI Embeddings · Anthropic Claude API · Telegram Bot API · Vitest · Playwright

**Estado atual**: 12 sprints concluidos. Sistema completo com analytics, Campaign Studio, engagement (DMs/comentarios/mencoes), Knowledge Base, calendario editorial com publicacao, roles de usuario, logging estruturado, E2E tests.

**Numeros**: 52 API routes, 29 pages, 21 migrations, 11 unit test files, 5 E2E specs.

---

## 2. Como iniciar uma sessao de desenvolvimento

### 2.1 Checklist de onboarding
- [ ] Leu o `ARCHITECTURE.md`?
- [ ] Leu o `PROMPT_CONTEXT.md`?
- [ ] Qual feature ou bug sera trabalhado?
- [ ] O dev server esta rodando? (`npm run dev -- -p 3001`)
- [ ] Se erro de cache: `rm -rf .next && npm run dev`

### 2.2 Perguntas antes de codar
1. "Este e um Server Component ou Client Component?"
2. "Os dados ja existem no Supabase ou preciso rodar sync?"
3. "Este endpoint e chamado pelo dashboard, pelo cron job ou pelo Campaign Studio?"
4. "Se Campaign Studio: o pgvector esta habilitado e a migration 006 foi executada?"
5. "Qual e o comportamento esperado quando os dados estao vazios?"
6. "Qual role (admin/editor/viewer) pode acessar essa funcionalidade?"

---

## 3. Regras de desenvolvimento (OBRIGATORIAS)

### 3.1 TypeScript
- **Sempre** usar TypeScript. Sem `any` — use `unknown` e type guards.
- Todos os tipos estao em `/types/instagram.ts`. Verificar antes de criar novos.

### 3.2 Supabase
- **Server**: `createServerSupabaseClient()` de `@/lib/supabase`
- **Browser**: `createBrowserSupabaseClient()` de `@/lib/supabase-browser`
- **Nunca** usar `SUPABASE_SERVICE_ROLE_KEY` em componentes client-side.
- **Sempre** upsert com `ON CONFLICT DO UPDATE` — nunca delete + insert.
- **Sempre** verificar `error` antes de usar `data`.

### 3.3 Auth — TODAS as rotas devem ser protegidas
- **Rotas de cron/sync/knowledge**: usar `validateCronSecret(request)` de `lib/auth.ts`
- **Rotas de dashboard (GET/POST/PATCH/DELETE)**: usar `validateDashboardRequest(request)` de `lib/auth.ts`
- **Nunca** criar rota sem auth — toda rota precisa de `validateCronSecret` OU `validateDashboardRequest`.

```typescript
// Exemplo: rota de cron
import { validateCronSecret } from '@/lib/auth'

export async function POST(request: Request) {
  const authError = validateCronSecret(request)
  if (authError) return authError
  // ...
}

// Exemplo: rota de dashboard
import { validateDashboardRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError
  // ...
}
```

### 3.4 Respostas de API — usar helpers padronizados
- **Sempre** usar `apiSuccess`/`apiError`/`getErrorMessage` de `@/lib/api-response.ts`
- **Nunca** usar `NextResponse.json()` diretamente

```typescript
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

export async function GET(request: Request) {
  try {
    const data = await fetchSomething()
    return apiSuccess(data)               // 200
    return apiSuccess(data, 200, 300)     // com cache 300s
  } catch (err) {
    return apiError(getErrorMessage(err))  // 500
  }
}
```

### 3.5 Logging — usar logger estruturado
- **Sempre** usar `logger` de `@/lib/logger.ts`
- **Nunca** usar `console.log`, `console.error`, `console.warn` diretamente

```typescript
import { logger } from '@/lib/logger'

logger.info('Sync concluido', 'Instagram Sync', { posts: 42 })
logger.warn('Token expirando', 'Auth', { days: 5 })
logger.error('Falha no sync', 'Instagram Sync', error)
```

### 3.6 Meta Graph API v21+
- Toda chamada via `meta-client.ts` — nunca fetch direto.
- Rate limits com retry/backoff exponencial (ja implementado).
- Token de `app_config` no Supabase (fallback env apenas setup inicial).
- **Views > Plays**: nos Reels, sempre `views`.
- **follower_demographics com breakdown**: demograficos usam `breakdown=age,gender` etc.
- **metric_type=total_value**: insights de conta usam este formato.
- **impressions removido**: nao usar impressions para conta ou midias individuais.
- **following_count removido**: nao existe na v21+.
- **navigation**: substitui exits/taps_forward/taps_back nos Stories (v22+).

### 3.7 Componentes React
- Graficos (Recharts) sempre em Client Components com `'use client'`.
- Usar dynamic import para Recharts (reduz bundle).
- Sempre implementar: loading (skeleton), erro (mensagem amigavel), vazio (empty state).
- Todos os calculos em `lib/analytics.ts`, nunca inline.
- Usar `ErrorBoundary` de `@/components/ErrorBoundary.tsx` para secoes criticas.
- Usar `useSessionCheck()` de `@/hooks/useSessionCheck` em layouts autenticados.
- Usar `useNotificationBadges()` de `@/hooks/useNotificationBadges` para badges no sidebar.
- Usar `useCurrentAccount()` de `@/hooks/useCurrentAccount` para contexto de conta.

### 3.8 HTML/XSS
- Ao inserir dados do usuario em HTML, usar `escapeHtml()` de `lib/auth.ts`.

### 3.9 Roles de usuario
- Verificar role via `getUserRole()` de `lib/roles.ts` antes de operacoes restritas.
- Admin: acesso total. Editor: CRUD de conteudo. Viewer: somente leitura.

### 3.10 Log de atividades
- Registrar acoes relevantes com `logActivity()` de `lib/activity.ts`.

---

## 4. Regras de desenvolvimento — Campaign Studio (OBRIGATORIAS)

### 4.1 RAG e Embeddings

**Model**: sempre `text-embedding-3-small` da OpenAI (1536 dimensoes).

```typescript
// /lib/rag/embeddings.ts
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  })
  return response.data[0].embedding
}
```

**Chunking**: sempre com overlap para nao perder contexto entre chunks.
- maxTokens: 512, overlap: 64
- Nunca cortar no meio de uma frase — preferir paragrafos ou pontos finais

**Vector search**: sempre via funcao SQL `search_knowledge()` — nunca calculo de distancia no TypeScript.

**Re-indexacao**: deletar o documento pai (CASCADE limpa chunks automaticamente) antes de re-indexar.

**Embeddings sao server-only**: `OPENAI_API_KEY` nunca no client. Embeddings apenas em API Routes.

### 4.2 Geracao com Claude

**Modelo**: `claude-sonnet-4-20250514` — melhor relacao custo/velocidade para geracao de campanhas com streaming.

**Streaming obrigatorio**: geracao leva 30-60s. Sem streaming = tela em branco.

**Parser de JSON**: o Claude pode retornar com whitespace variavel. Sempre extrair e validar via `campaign-parser.ts`.

### 4.3 Edicao nao-destrutiva (CRITICO)

```typescript
// CORRETO — preserva original, salva edicao separada
await supabase.from('campaign_posts')
  .update({ caption_edited: newCaption, updated_at: new Date().toISOString() })
  .eq('id', postId)

// ERRADO — perde o output original da IA
await supabase.from('campaign_posts')
  .update({ caption: newCaption })
  .eq('id', postId)
```

No editor, sempre exibir `caption_edited ?? caption`. Se ha edicao, mostrar badge "Editado".

### 4.4 Agendamento

Ao agendar uma campanha aprovada, mapear `campaign_posts` -> `instagram_editorial_calendar`:
- Filtrar apenas posts com `status === 'APPROVED'`
- Vincular `campaign_post.calendar_entry_id` apos insercao
- Atualizar `instagram_campaigns.status` para `SCHEDULED`

### 4.5 Status de campanha

A campanha so muda para `APPROVED` quando todos os posts tem status `APPROVED`.
Implementar essa verificacao automaticamente ao aprovar o ultimo post.

---

## 5. Padroes de UI

### 5.1 Design system
- **shadcn/ui v3** (Radix primitives) — NAO usar v4 (base-ui, incompativel com Tailwind v3).
- **Tailwind CSS v3** — sem CSS modules, sem styled-components.
- **Dark mode**: suportado via `next-themes` (ThemeProvider + ThemeToggle).
- Cards: `border-0 shadow-sm hover:shadow-md transition-all`
- Paleta Content Score:
  - VIRAL: `text-orange-500` / `bg-orange-50`
  - GOOD: `text-green-600` / `bg-green-50`
  - AVERAGE: `text-yellow-600` / `bg-yellow-50`
  - WEAK: `text-red-500` / `bg-red-50`
- Status de campanha/post:
  - DRAFT / PENDING: `text-gray-500` / `bg-gray-50`
  - GENERATING: `text-blue-500` / `bg-blue-50` (com spinner)
  - REVIEW: `text-purple-600` / `bg-purple-50`
  - APPROVED / GOOD: `text-green-600` / `bg-green-50`
  - SCHEDULED: `text-indigo-600` / `bg-indigo-50`
  - REVISION_REQUESTED: `text-yellow-600` / `bg-yellow-50`

### 5.2 Graficos (Recharts)
- Sempre `ResponsiveContainer width="100%" height="100%"`
- Cores: `#4F46E5` (indigo), `#06B6D4` (cyan)
- Tooltips em portugues com `contentStyle` customizado
- Gradientes via `<defs><linearGradient>`
- Usar dynamic import para otimizar bundle

### 5.3 Tabelas
- Usar `Table` do shadcn/ui com `rounded-lg border overflow-hidden`
- Headers com `bg-muted/30`
- Ordenacao por coluna clicavel

### 5.4 Streaming UX
- Exibir texto sendo gerado em tempo real (nao bloquear tela)
- Mostrar as 3 fontes de contexto carregadas (chunks encontrados, dados do perfil, boas praticas)
- Barra de progresso estimada
- Botao de cancelar disponivel durante a geracao

### 5.5 Toasts
- Usar `toast` do Sonner para feedback instantaneo (sucesso, erro, info)

---

## 6. Modulos e responsabilidades

### 6.1 Analytics

**`/api/instagram/sync` — Cron Principal**
1. Valida CRON_SECRET via `validateCronSecret()`
2. Busca token de `app_config`, verifica expiracao
3. Busca account info + account insights
4. Busca media list (paginacao cursor, limite configuravel via `?limit=`)
5. Para cada midia: busca insights, classifica Reel vs Post
6. Upsert em `instagram_posts` ou `instagram_reels`
7. Recalcula content scores em **batch por tier** (4 queries)

**`/api/instagram/sync-stories` — Cron de Stories**
1. Valida CRON_SECRET
2. Busca stories ativos com `media_type, media_url, thumbnail_url, permalink`
3. Para cada story: busca insights (reach, replies, navigation, follows, shares, etc.)
4. Persiste thumbnail no Supabase Storage (`thumbs/{media_id}.jpg`)
5. Persiste video no Storage (`videos/{media_id}.mp4`) se `media_type === 'VIDEO'`
6. Upsert com `stored_media_url` e `stored_video_url`

**`meta-client.ts`**: wrapper completo da Meta Graph API v21.0 com retry/backoff.

**`analytics.ts`**: funcoes puras — `calcEngagementRate`, `calcQEI`, `calcContentScore`, `calcCompletionRate`, `extractHashtags`, `formatNumber`, `formatPercent`.

### 6.2 Campaign Studio

**`/api/campaigns/generate`**: orquestra RAG + Claude API com streaming.
**`/api/campaigns/[id]/schedule`**: mapeia posts aprovados para calendario editorial.
**`/api/campaigns/[id]/chat`**: chat estrategico com IA sobre a campanha.
**`/api/campaigns/[id]/brief`**: gera brief visual formatado para designer.
**`/api/campaigns/[id]/media`**: vincula midias reais publicadas a campanhas.

**`prompt-builder.ts`**: monta prompt com 3 camadas de contexto (marca, performance, boas praticas).
**`campaign-parser.ts`**: parseia e valida JSON gerado pelo Claude.
**`system-prompt.ts`**: system prompt com boas praticas do Instagram.

### 6.3 Knowledge Base

**`/api/knowledge/ingest`**: upload e ingestao de PDFs (chunking + embeddings).
**`/api/knowledge/scrape`**: scraping do site (manual ou cron semanal).
**`/api/knowledge/documents`**: lista e toggle de documentos.

### 6.4 Engagement

**`/api/instagram/comments`**: sync, reply, hide, delete comentarios.
**`/api/instagram/comments/sentiment`**: distribuicao de sentimento.
**`/api/instagram/mentions`**: sync e save mencoes e tags.
**`/api/instagram/messages`**: conversas e envio de DMs.
**`/api/instagram/auto-reply`**: CRUD de regras de auto-reply.

---

## 7. Como retomar o desenvolvimento

### 7.1 Setup basico
```bash
1. npm install
2. Verificar .env.local (todas as vars — ver ARCHITECTURE.md secao 15)
3. npm run dev -- -p 3001
4. Se erro de cache: rm -rf .next && npm run dev
5. Se banco vazio: curl -X POST http://localhost:3001/api/instagram/sync \
   -H "Authorization: Bearer {CRON_SECRET}"
6. Acessar http://localhost:3001/login
```

### 7.2 Campaign Studio
```bash
1. Verificar pgvector habilitado: CREATE EXTENSION IF NOT EXISTS vector;
2. Verificar migration 006 executada
3. Verificar OPENAI_API_KEY e ANTHROPIC_API_KEY no .env.local
4. Upload de PDFs via /knowledge
5. Testar geracao de campanha completa
```

---

## 8. Erros comuns — evite

| Erro | Como evitar |
|---|---|
| `Cannot find module './682.js'` | `rm -rf .next && npm run dev` |
| shadcn/ui v4 incompativel | Usar apenas componentes v3 (Radix). Nunca `@base-ui/react` |
| `following_count` nao existe | Removido na v21+. Usar apenas `followers_count, media_count` |
| `impressions` erro na API | Removido para conta e midias. Nao usar |
| `audience_gender_age` erro | Usar `follower_demographics` com `breakdown=age,gender` |
| `plays` em vez de `views` | Reels usam `views` desde abr/2025 |
| Token expirado | Verificar `app_config`. Refresh via `/api/instagram/refresh-token` |
| N+1 queries | Batch queries (ver content scores, competitors como exemplo) |
| XSS no report | Usar `escapeHtml()` de `lib/auth.ts` |
| Embeddings no client-side | `OPENAI_API_KEY` e server-only. Embeddings apenas em API Routes |
| `caption` sobrescrito ao editar | Usar `caption_edited` — nunca alterar `caption` original |
| Rota sem auth | Usar `validateCronSecret` ou `validateDashboardRequest` em TODAS as rotas |
| `console.log` no codigo | Usar `logger` de `lib/logger.ts` |
| `NextResponse.json()` direto | Usar `apiSuccess`/`apiError` de `lib/api-response.ts` |
| `createBrowserSupabaseClient` de `lib/supabase` | Client components usam `lib/supabase-browser.ts` |
| Chunks sem overlap | Usar overlap de 64 tokens para nao perder contexto |
| Re-indexar sem limpar chunks antigos | Deletar documento pai (CASCADE limpa chunks) |
| Campanha sem system prompt | System prompt com boas praticas e obrigatorio em toda geracao |
| Streaming sem tratamento de erro | Implementar try/catch e UI de retry na tela de geracao |
| Agendar posts nao aprovados | `/api/campaigns/[id]/schedule` deve filtrar apenas `status === 'APPROVED'` |

---

## 9. Checklist antes de finalizar uma tarefa

**Obrigatorio:**
- [ ] `npx tsc --noEmit` sem erros?
- [ ] `npm test` sem falhas?
- [ ] `npm run build` sem erros?
- [ ] Todos os estados (loading, erro, vazio) implementados?
- [ ] Dados sensiveis apenas server-side?
- [ ] Auth em todas as rotas (`validateCronSecret` ou `validateDashboardRequest`)?
- [ ] Respostas com `apiSuccess`/`apiError` (nao `NextResponse.json` direto)?
- [ ] Logs com `logger` (nao `console.log`)?
- [ ] Calculos em `analytics.ts`, nao inline?
- [ ] Upsert com `ON CONFLICT DO UPDATE`?
- [ ] Graficos com `ResponsiveContainer`?
- [ ] Numeros formatados em pt-BR?
- [ ] HTML sanitizado com `escapeHtml()` (se aplicavel)?

**Campaign Studio (adicional):**
- [ ] Embeddings gerados apenas server-side?
- [ ] Modelo `claude-sonnet-4-20250514` sendo usado?
- [ ] System prompt com boas praticas enviado?
- [ ] Streaming com tratamento de erro implementado?
- [ ] Parser com validacao de schema completa?
- [ ] Edicoes em `caption_edited`, nao em `caption`?
- [ ] Agendamento filtrando apenas posts `APPROVED`?
- [ ] `calendar_entry_id` vinculado apos agendamento?

**Testes (quando aplicavel):**
- [ ] `npm run test:e2e` sem falhas? (Playwright)

---

## 10. Referencias rapidas

- Meta Graph API v21+: https://developers.facebook.com/docs/instagram-api
- Permissoes: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages`
- Supabase JS v2: https://supabase.com/docs/reference/javascript
- Supabase pgvector: https://supabase.com/docs/guides/ai/vector-columns
- Supabase Auth: https://supabase.com/docs/guides/auth
- shadcn/ui v3: https://v0.dev/docs (Radix-based)
- Recharts: https://recharts.org/en-US/api
- Resend: https://resend.com/docs/api-reference
- OpenAI Embeddings: https://platform.openai.com/docs/guides/embeddings
- Anthropic Streaming: https://docs.anthropic.com/en/api/messages-streaming
- Vitest: https://vitest.dev
- Playwright: https://playwright.dev
- text-embedding-3-small: 1536 dims, melhor custo-beneficio para RAG em portugues
