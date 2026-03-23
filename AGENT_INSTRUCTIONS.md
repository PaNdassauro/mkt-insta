# AGENT_INSTRUCTIONS.md — DashIG
> Instruções operacionais para agentes de IA que trabalham neste projeto

---

## 1. Contexto rápido

Você está desenvolvendo o **DashIG**, um dashboard de analytics de Instagram para a Welcome Trips. Antes de começar qualquer tarefa, leia o `ARCHITECTURE.md` (estrutura técnica) e o `PROMPT_CONTEXT.md` (domínio de negócio).

**Stack**: Next.js 14 · TypeScript · Supabase · Tailwind CSS · shadcn/ui · Recharts · Meta Graph API · Vercel

---

## 2. Como iniciar uma sessão de desenvolvimento

### 2.1 Checklist de onboarding
Ao iniciar uma nova sessão, confirme:

- [ ] Você leu o `ARCHITECTURE.md`?
- [ ] Você leu o `PROMPT_CONTEXT.md`?
- [ ] Qual fase do roadmap está sendo desenvolvida?
- [ ] Qual módulo/componente específico será trabalhado nesta sessão?

### 2.2 Perguntas para fazer antes de codar
Se a tarefa for ambígua, pergunte:
1. "Este é um Server Component ou Client Component?"
2. "Os dados já existem no Supabase ou preciso criar o cron de sync primeiro?"
3. "Este endpoint é chamado pelo dashboard ou pelo cron job?"
4. "Qual é o comportamento esperado quando os dados estão vazios?"

---

## 3. Regras de desenvolvimento (OBRIGATÓRIAS)

### 3.1 TypeScript
- **Sempre** usar TypeScript. Sem `any` explícito — use `unknown` e faça type guards.
- Todos os tipos de entidades do Instagram estão (ou devem estar) em `/types/instagram.ts`.
- Antes de criar um novo tipo, verificar se já existe em `instagram.ts`.

### 3.2 Supabase
- **Nunca** usar `SUPABASE_SERVICE_ROLE_KEY` em componentes client-side.
- Usar o cliente server em API Routes: `createServerClient()` de `@/lib/supabase`.
- Usar o cliente browser em Client Components: `createBrowserClient()`.
- **Sempre** fazer upsert com `ON CONFLICT DO UPDATE` — nunca delete + insert.
- Sempre verificar o campo `error` antes de usar `data`.

```typescript
// ✅ Correto
const { data, error } = await supabase.from('instagram_posts').select('*')
if (error) throw new Error(error.message)

// ❌ Errado
const { data } = await supabase.from('instagram_posts').select('*')
console.log(data) // pode ser null
```

### 3.3 Meta Graph API
- Toda chamada à API do Meta deve passar pelo `meta-client.ts` — nunca chamar diretamente com fetch espalhado pelo código.
- Sempre tratar rate limits (código 400/429) com retry com backoff exponencial.
- O token de acesso vem sempre da tabela `app_config` no Supabase, nunca de variável de ambiente diretamente (exceto no setup inicial).
- **Views > Plays**: nos Reels, usar sempre a métrica `views`. A métrica `plays` foi descontinuada em abril/2025.

### 3.4 Componentes React
- Separar claramente Server Components (busca de dados) de Client Components (interatividade).
- Gráficos (Recharts) sempre em Client Components com diretiva `'use client'`.
- Sempre implementar:
  - Estado de **loading** (skeleton ou spinner)
  - Estado de **erro** com mensagem amigável
  - Estado **vazio** (empty state com instrução ao usuário)

```typescript
// Padrão de componente com os três estados
if (isLoading) return <SkeletonCard />
if (error) return <ErrorMessage message={error} />
if (!data || data.length === 0) return <EmptyState message="Nenhum dado disponível ainda." />
return <ComponenteReal data={data} />
```

### 3.5 Cálculos de métricas
- **Nunca** calcular `engagement_rate`, `QEI` ou `content_score` inline nos componentes.
- Todos os cálculos ficam em `/lib/analytics.ts`.
- Funções puras, testáveis, sem efeitos colaterais.

```typescript
// /lib/analytics.ts
export function calcEngagementRate(likes: number, comments: number, saves: number, shares: number, reach: number): number {
  if (reach === 0) return 0
  return ((likes + comments + saves + shares) / reach) * 100
}

export function calcQEI(likes: number, comments: number, saves: number, shares: number, reach: number): number {
  if (reach === 0) return 0
  return ((likes * 1) + (comments * 2) + (saves * 4) + (shares * 5)) / reach * 100
}

export function calcContentScore(engagementRate: number, mean: number, stdDev: number): ContentScore {
  if (engagementRate >= mean + stdDev) return 'VIRAL'
  if (engagementRate >= mean) return 'GOOD'
  if (engagementRate >= mean - stdDev) return 'AVERAGE'
  return 'WEAK'
}
```

---

## 4. Padrões de UI

### 4.1 Design system
- Usar **shadcn/ui** para todos os componentes base (Card, Table, Badge, Button, Select, etc.)
- Usar **Tailwind CSS** para estilização — sem CSS modules, sem styled-components.
- Paleta de cores para Content Score:
  - 🔥 VIRAL: `text-orange-500` / `bg-orange-50`
  - ✅ GOOD: `text-green-600` / `bg-green-50`
  - ⚠️ AVERAGE: `text-yellow-600` / `bg-yellow-50`
  - ❌ WEAK: `text-red-500` / `bg-red-50`

### 4.2 Gráficos (Recharts)
- Sempre usar `ResponsiveContainer` com `width="100%"`.
- Cores primárias do projeto: `#4F46E5` (indigo) e `#06B6D4` (cyan).
- Tooltips sempre em português.
- Eixo Y: sempre formatar números grandes com `Intl.NumberFormat('pt-BR')`.

### 4.3 Tabelas
- Usar `Table` do shadcn/ui.
- Sempre permitir ordenação por coluna nos posts/reels.
- Paginação a partir de 20 itens.

---

## 5. Módulos e responsabilidades

### 5.1 `/api/instagram/sync` — Cron Job Principal
**O que faz:**
1. Busca token de acesso no Supabase (`app_config`)
2. Verifica expiração do token (alerta se < 15 dias)
3. Chama `meta-client.ts` para buscar posts, reels e métricas da conta
4. Normaliza os dados
5. Faz upsert no Supabase
6. Calcula e atualiza `content_score` de todos os posts

**Não faz:** não busca stories (job separado), não busca audiência (job semanal separado).

### 5.2 `/api/instagram/sync-stories` — Cron Job de Stories
**O que faz:**
1. Busca stories ativos na conta
2. Para cada story ativo, busca insights individuais
3. Upsert em `instagram_stories`

**Atenção:** Stories expiram em 24h. Este job roda a cada 6h. Registrar `expires_at` para filtrar no frontend.

### 5.3 `meta-client.ts` — Wrapper da Graph API
Deve expor funções específicas, nunca URLs raw:

```typescript
export async function getAccountInfo(token: string): Promise<AccountInfo>
export async function getMediaList(token: string, userId: string): Promise<MediaItem[]>
export async function getMediaInsights(token: string, mediaId: string, mediaType: MediaType): Promise<MediaInsights>
export async function getAccountInsights(token: string, userId: string): Promise<AccountInsights>
export async function getAudienceInsights(token: string, userId: string): Promise<AudienceInsights>
export async function getActiveStories(token: string, userId: string): Promise<StoryItem[]>
export async function refreshLongLivedToken(token: string): Promise<string>
```

### 5.4 `HeatmapPostingTime.tsx` — Melhor Hora para Postar
- Recebe dados de `audience_snapshots` (active_hours, active_days) e histórico de posts
- Cruza audiência ativa com performance histórica por slot de hora/dia
- Renderiza uma grade 7×24 (dias × horas) com intensidade de cor
- Destaca os 3 melhores slots com recomendação explícita

### 5.5 `HashtagTable.tsx` — Hashtag Intelligence
- Lê os arrays `hashtags` de todos os posts
- Agrega: frequência de uso, média de reach, média de engagement_rate por hashtag
- Calcula trend das últimas 4 semanas (crescimento/queda)
- Ordena por "impacto estimado" = avg_reach × avg_engagement_rate

---

## 6. Sequência recomendada para o MVP

Se você está começando do zero, siga esta ordem:

```
1. Setup do projeto Next.js 14 + configuração do Supabase
2. Criação das tabelas no Supabase (scripts em ARCHITECTURE.md §5)
3. Implementar meta-client.ts (funções básicas: account info + media list + insights)
4. Implementar /api/instagram/sync (cron job)
5. Testar sync manualmente via POST request
6. Implementar Overview page com KPIs básicos
7. Implementar Posts page com grid e métricas
8. Implementar Growth chart (histórico de seguidores)
9. Deploy no Vercel + configurar cron job
10. Implementar sync de stories
```

---

## 7. Erros comuns — evite

| Erro | Como evitar |
|---|---|
| Usar `plays` como métrica de Reel | Usar sempre `views` — plays foi descontinuado em abr/2025 |
| Token expirado em produção | Salvar token no Supabase + verificar expiração no sync |
| Delete + insert em vez de upsert | Sempre usar `upsert` com `onConflict: 'media_id'` |
| Cálculo de engajamento sem verificar reach = 0 | Sempre guardar com `if (reach === 0) return 0` |
| Chamar Graph API diretamente nos componentes | Toda chamada à API passa por `meta-client.ts` |
| Service role key no client component | `SUPABASE_SERVICE_ROLE_KEY` apenas em Route Handlers |
| Stories sem paginação | Stories podem passar de 30/dia — sempre tratar paginação da API |

---

## 8. Checklist antes de finalizar uma tarefa

- [ ] O código compila sem erros TypeScript?
- [ ] Todos os estados (loading, erro, vazio) estão implementados?
- [ ] Dados sensíveis (token, service key) estão apenas server-side?
- [ ] A função de cálculo de métricas está em `analytics.ts`, não inline?
- [ ] O upsert usa `ON CONFLICT DO UPDATE`, não delete + insert?
- [ ] Os gráficos usam `ResponsiveContainer`?
- [ ] Os números grandes estão formatados em pt-BR?
- [ ] A documentação (`ARCHITECTURE.md`) precisa ser atualizada com algo novo?

---

## 9. Referências rápidas

- Docs Meta Graph API: https://developers.facebook.com/docs/instagram-api
- Permissões necessárias: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`
- Supabase JS v2: https://supabase.com/docs/reference/javascript
- shadcn/ui components: https://ui.shadcn.com/docs/components
- Recharts: https://recharts.org/en-US/api
- Resend (email): https://resend.com/docs/api-reference/introduction
- Vercel Cron: https://vercel.com/docs/cron-jobs/manage-cron-jobs
