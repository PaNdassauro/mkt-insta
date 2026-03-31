import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/rag/embeddings'
import { vectorSearch } from '@/lib/rag/vector-search'
import { buildSystemPrompt } from './system-prompt'
import type { PostFormat } from '@/types/instagram'

export interface CampaignBriefing {
  title: string
  objective: string
  target_audience: string
  theme: string
  tone_notes?: string
  duration_days: number
  start_date: string
  preferred_formats: PostFormat[]
}

interface ContextData {
  knowledgeChunks: string[]
  topPosts: string
  audienceSnapshot: string
  topHashtags: string
  bestSlots: string
  chunksUsed: number
}

/**
 * Monta o prompt completo com 3 camadas de contexto:
 * 1. Knowledge Base (vector search)
 * 2. Metricas de performance do perfil
 * 3. System prompt com boas praticas
 */
export async function buildPrompt(briefing: CampaignBriefing): Promise<{
  systemPrompt: string
  userPrompt: string
  chunksUsed: number
}> {
  const context = await gatherContext(briefing)

  const systemPrompt = buildSystemPrompt()

  const userPrompt = `## Briefing da campanha

**Titulo**: ${briefing.title}
**Objetivo**: ${briefing.objective}
**Publico-alvo**: ${briefing.target_audience}
**Tema**: ${briefing.theme}
${briefing.tone_notes ? `**Notas de tom**: ${briefing.tone_notes}` : ''}
**Duracao**: ${briefing.duration_days} dias
**Data de inicio**: ${briefing.start_date}
**Formatos preferidos**: ${briefing.preferred_formats.join(', ')}

---

## Contexto da marca e negocio (Knowledge Base)

${context.knowledgeChunks.length > 0 ? context.knowledgeChunks.map((c, i) => `### Trecho ${i + 1}\n${c}`).join('\n\n') : 'Nenhum documento indexado na Knowledge Base ainda.'}

---

## Performance real do perfil @welcomeweddings

### Top posts por Content Score
${context.topPosts}

### Audiencia
${context.audienceSnapshot}

### Hashtags mais eficazes
${context.topHashtags}

### Melhores horarios para postar
${context.bestSlots}

---

## Instrucoes

Com base em todo o contexto acima, gere uma campanha de ${briefing.duration_days} dias com posts nos formatos ${briefing.preferred_formats.join(', ')}.

Cada post deve ter data/horario baseado nos melhores horarios identificados, comecando em ${briefing.start_date}.

Retorne APENAS o JSON conforme a estrutura definida no system prompt.`

  return {
    systemPrompt,
    userPrompt,
    chunksUsed: context.chunksUsed,
  }
}

async function gatherContext(briefing: CampaignBriefing): Promise<ContextData> {
  const supabase = createServerSupabaseClient()

  // 1. Vector search na Knowledge Base
  let knowledgeChunks: string[] = []
  let chunksUsed = 0

  try {
    const searchQuery = `${briefing.theme} ${briefing.objective} ${briefing.target_audience}`
    const embedding = await generateEmbedding(searchQuery)
    const results = await vectorSearch(embedding, { threshold: 0.70, limit: 8 })
    knowledgeChunks = results.map((r) => r.content)
    chunksUsed = results.length
  } catch (err) {
    logger.warn('Vector search failed, continuing without', 'PromptBuilder', { error: err as Error })
  }

  // 2. Top posts por content score
  const { data: topPostsData } = await supabase
    .from('instagram_posts')
    .select('caption, likes, comments, saves, shares, reach, engagement_rate, content_score, timestamp')
    .in('content_score', ['VIRAL', 'GOOD'])
    .order('engagement_rate', { ascending: false })
    .limit(10)

  const { data: topReelsData } = await supabase
    .from('instagram_reels')
    .select('caption, views, likes, comments, saves, shares, reach, content_score, timestamp')
    .in('content_score', ['VIRAL', 'GOOD'])
    .order('views', { ascending: false })
    .limit(5)

  const topPosts = formatTopPosts(topPostsData ?? [], topReelsData ?? [])

  // 3. Audiencia
  const { data: audienceData } = await supabase
    .from('instagram_audience_snapshots')
    .select('age_ranges, gender, top_cities, active_hours, active_days')
    .order('week_start', { ascending: false })
    .limit(1)
    .single()

  const audienceSnapshot = formatAudience(audienceData)

  // 4. Top hashtags
  const { data: postsForHashtags } = await supabase
    .from('instagram_posts')
    .select('hashtags, engagement_rate, reach')
    .not('hashtags', 'is', null)
    .order('engagement_rate', { ascending: false })
    .limit(50)

  const topHashtags = formatTopHashtags(postsForHashtags ?? [])

  // 5. Melhores horarios
  const bestSlots = formatBestSlots(audienceData)

  return {
    knowledgeChunks,
    topPosts,
    audienceSnapshot,
    topHashtags,
    bestSlots,
    chunksUsed,
  }
}

function formatTopPosts(
  posts: Record<string, unknown>[],
  reels: Record<string, unknown>[]
): string {
  if (posts.length === 0 && reels.length === 0) {
    return 'Sem dados suficientes de posts ainda.'
  }

  const lines: string[] = []

  if (posts.length > 0) {
    lines.push('**Posts (Feed):**')
    for (const p of posts.slice(0, 5)) {
      const caption = typeof p.caption === 'string' ? p.caption.slice(0, 100) : '(sem caption)'
      lines.push(
        `- [${p.content_score}] Eng: ${Number(p.engagement_rate).toFixed(1)}% | Reach: ${p.reach} | "${caption}..."`
      )
    }
  }

  if (reels.length > 0) {
    lines.push('\n**Reels:**')
    for (const r of reels.slice(0, 5)) {
      const caption = typeof r.caption === 'string' ? r.caption.slice(0, 100) : '(sem caption)'
      lines.push(
        `- [${r.content_score}] Views: ${r.views} | Reach: ${r.reach} | "${caption}..."`
      )
    }
  }

  return lines.join('\n')
}

function formatAudience(data: Record<string, unknown> | null): string {
  if (!data) return 'Sem dados de audiencia disponiveis.'

  const lines: string[] = []

  if (data.gender && typeof data.gender === 'object') {
    const g = data.gender as Record<string, number>
    lines.push(`**Genero**: ${Object.entries(g).map(([k, v]) => `${k}: ${v}%`).join(', ')}`)
  }

  if (data.age_ranges && typeof data.age_ranges === 'object') {
    const ages = data.age_ranges as Record<string, number>
    const sorted = Object.entries(ages).sort(([, a], [, b]) => b - a).slice(0, 5)
    lines.push(`**Faixas etarias principais**: ${sorted.map(([k, v]) => `${k}: ${v}%`).join(', ')}`)
  }

  if (data.top_cities && Array.isArray(data.top_cities)) {
    const cities = data.top_cities as Array<{ city: string; pct: number }>
    lines.push(`**Top cidades**: ${cities.slice(0, 5).map((c) => `${c.city}: ${c.pct}%`).join(', ')}`)
  }

  return lines.length > 0 ? lines.join('\n') : 'Sem dados de audiencia disponiveis.'
}

function formatTopHashtags(
  posts: Array<{ hashtags: string[] | null; engagement_rate: number | null; reach: number | null }>
): string {
  const hashtagStats: Record<string, { totalEng: number; totalReach: number; count: number }> = {}

  for (const post of posts) {
    if (!post.hashtags) continue
    for (const tag of post.hashtags) {
      if (!hashtagStats[tag]) {
        hashtagStats[tag] = { totalEng: 0, totalReach: 0, count: 0 }
      }
      hashtagStats[tag].totalEng += post.engagement_rate ?? 0
      hashtagStats[tag].totalReach += post.reach ?? 0
      hashtagStats[tag].count++
    }
  }

  const sorted = Object.entries(hashtagStats)
    .map(([tag, stats]) => ({
      tag,
      avgEng: stats.totalEng / stats.count,
      avgReach: stats.totalReach / stats.count,
      uses: stats.count,
    }))
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 20)

  if (sorted.length === 0) return 'Sem dados de hashtags ainda.'

  return sorted
    .map((h) => `#${h.tag} — Eng medio: ${h.avgEng.toFixed(1)}% | Reach medio: ${Math.round(h.avgReach)} | ${h.uses}x usado`)
    .join('\n')
}

function formatBestSlots(data: Record<string, unknown> | null): string {
  if (!data) return 'Sem dados de horarios disponiveis.'

  const lines: string[] = []

  if (data.active_hours && typeof data.active_hours === 'object') {
    const hours = data.active_hours as Record<string, number>
    const sorted = Object.entries(hours).sort(([, a], [, b]) => b - a).slice(0, 5)
    lines.push(`**Horarios mais ativos**: ${sorted.map(([h, v]) => `${h}h (${v}%)`).join(', ')}`)
  }

  if (data.active_days && typeof data.active_days === 'object') {
    const days = data.active_days as Record<string, number>
    const sorted = Object.entries(days).sort(([, a], [, b]) => b - a).slice(0, 3)
    lines.push(`**Dias mais ativos**: ${sorted.map(([d, v]) => `${d} (${v}%)`).join(', ')}`)
  }

  return lines.length > 0 ? lines.join('\n') : 'Sem dados de horarios disponiveis.'
}
