# PROMPT_CONTEXT.md — DashIG
> Contexto de negócio e produto para sessões de desenvolvimento com agentes de IA

---

## 1. Quem é o cliente deste projeto

**Welcome Trips** é uma agência de viagens brasileira com 20+ anos de mercado, com sede em Curitiba (PR). Faz parte do Welcome Group, que também inclui a Welcome Weddings (casamentos no exterior) e outras divisões.

O Instagram é um canal estratégico de geração de leads e construção de marca para a Welcome Trips. A equipe de marketing precisa de visibilidade real sobre o que funciona — quais formatos, horários, hashtags e tipos de conteúdo geram mais alcance e engajamento — para tomar decisões baseadas em dados.

---

## 2. O que é o DashIG

DashIG é um dashboard interno de analytics de Instagram, construído em Next.js 14 + Supabase. Ele substitui a leitura manual do Instagram Insights (nativo) e resolve três problemas concretos:

1. **Histórico limitado**: o Instagram nativo guarda apenas 90 dias. O DashIG guarda indefinidamente via Supabase.
2. **Falta de inteligência**: o Insights nativo não calcula scores, não sugere horários ideais, não classifica conteúdo por performance.
3. **Sem visão comparativa**: não há benchmarking de concorrentes nem comparativo entre formatos (Reel vs Carrossel vs Foto).

---

## 3. Usuários do sistema

| Perfil | Necessidade |
|---|---|
| Gestor de Marketing (Marcelo) | Visão executiva de performance mensal, tendências e benchmarks |
| Social Media / Analista | Operacional: quais posts performaram, melhores horários, hashtags |
| Diretoria | Relatório mensal consolidado (PDF automático por email) |

---

## 4. Conceitos de domínio importantes

### 4.1 Métricas principais

| Termo | Definição |
|---|---|
| **Reach** | Número único de contas que viram o conteúdo |
| **Impressions** | Total de vezes que o conteúdo foi exibido (inclui múltiplas vistas do mesmo usuário) |
| **Engagement Rate** | (likes + comments + saves + shares) / reach × 100 |
| **QEI** | Qualitative Engagement Index — ponderação que valoriza saves (×4) e shares (×5) mais que likes (×1) |
| **Completion Rate** | % do Reel assistido até o fim (estimado via avg_watch_time / duration) |
| **Views** | Métrica base de Reels desde abril/2025 — substitui Plays e Impressions nos Reels |
| **Sends per Reach** | Compartilhamentos via DM dividido pelo alcance — métrica priorizada pelo algoritmo do Instagram em 2025/2026 |
| **Content Score** | Tier calculado (VIRAL / GOOD / AVERAGE / WEAK) com base no engajamento relativo à média histórica |

### 4.2 Tipos de conteúdo

| Tipo | Media Type na API | Particularidades |
|---|---|---|
| Foto | `IMAGE` | Métricas padrão |
| Carrossel | `CAROUSEL_ALBUM` | Reach tende a ser alto por swipes |
| Vídeo feed | `VIDEO` | Pouco usado, substituído por Reels |
| Reel | `VIDEO` (com flag de reel) | Completion rate é a métrica mais importante |
| Story | Endpoint separado | Expira em 24h, coletar a cada 6h |

### 4.3 Lógica de Content Score

Cada post recebe um tier automático baseado no desvio do engagement_rate em relação à média histórica do perfil:
- 🔥 **VIRAL**: acima de média + 1 desvio padrão
- ✅ **GOOD**: acima da média
- ⚠️ **AVERAGE**: abaixo da média mas acima de média - 1 desvio padrão
- ❌ **WEAK**: abaixo de média - 1 desvio padrão

### 4.4 Token de acesso (Meta Graph API)

- O token padrão expira em 1h. Usar **Long-Lived Token** (60 dias).
- O token é salvo na tabela `app_config` no Supabase.
- O sync diário verifica expiração e envia alerta quando faltam menos de 15 dias.
- Refresh manual via `/api/instagram/refresh-token`.

---

## 5. Regras de negócio críticas

1. **Nunca deletar dados históricos** — apenas fazer upsert (ON CONFLICT DO UPDATE).
2. **Stories têm janela de 24h** — o cron de stories roda a cada 6h para capturar todos antes da expiração.
3. **Concorrentes = dados públicos apenas** — o monitoramento de concorrentes usa exclusivamente dados públicos via API ou scraping ético. Nenhum dado privado.
4. **Views > Plays nos Reels** — desde abril/2025, a Meta descontinuou as métricas `plays` e `impressions` para Reels. Usar `views` como baseline.
5. **QEI sempre calculado no frontend** — o `engagement_rate` base é calculado e salvo no banco. O QEI (ponderado) é calculado em runtime para permitir ajuste de pesos futuramente.
6. **Content Score recalculado semanalmente** — a média e desvio padrão histórico são recalculados a cada sync semanal, atualizando os tiers de todos os posts.

---

## 6. Integrações externas

| Serviço | Uso | Docs |
|---|---|---|
| Meta Graph API | Fonte primária de todos os dados de Instagram | https://developers.facebook.com/docs/instagram-api |
| Supabase | Banco de dados e auth | https://supabase.com/docs |
| Vercel Cron | Agendamento dos jobs de sync | https://vercel.com/docs/cron-jobs |
| Resend | Envio do relatório mensal por email | https://resend.com/docs |

---

## 7. Padrões de desenvolvimento do projeto

### 7.1 Nomenclatura
- Arquivos: `kebab-case.tsx`
- Componentes: `PascalCase`
- Funções e variáveis: `camelCase`
- Tabelas Supabase: `snake_case`
- Constantes: `UPPER_SNAKE_CASE`

### 7.2 Estrutura de um Route Handler
```typescript
// /app/api/instagram/posts/route.ts
import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('instagram_posts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

### 7.3 Padrão de componente de gráfico
```typescript
// Sempre usar Recharts
// Sempre receber dados como prop (não buscar dentro do componente)
// Sempre ter estado de loading e empty state
interface GrowthChartProps {
  data: AccountSnapshot[]
  isLoading?: boolean
}
```

### 7.4 Variáveis de ambiente
- Nunca hardcodar tokens ou URLs
- Prefixo `NEXT_PUBLIC_` apenas para variáveis expostas ao browser
- `SUPABASE_SERVICE_ROLE_KEY` apenas em API Routes (nunca no client)

---

## 8. O que NÃO está no escopo (desta versão)

- Publicação de conteúdo via API (requer permissões extras e aprovação Meta)
- Analytics de Instagram Ads (requer integração com Meta Ads API — escopo futuro)
- Multi-conta (apenas Welcome Trips por ora)
- App mobile
- Integração com outras redes sociais (TikTok, LinkedIn — escopo futuro)
