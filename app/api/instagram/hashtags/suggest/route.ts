import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { extractHashtags } from '@/lib/analytics'

/**
 * GET /api/instagram/hashtags/suggest?caption=...
 * Sugere hashtags com base na caption e performance historica.
 * Retorna top 15 hashtags rankeadas por impacto (reach x engagement).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const caption = searchParams.get('caption') ?? ''

    const supabase = createServerSupabaseClient()

    // 1. Buscar todos os posts com hashtags e metricas nos ultimos 6 meses
    const since = new Date()
    since.setMonth(since.getMonth() - 6)

    const [postsRes, reelsRes] = await Promise.all([
      supabase
        .from('instagram_posts')
        .select('hashtags, reach, likes, comments, saves, shares')
        .not('hashtags', 'is', null)
        .gte('timestamp', since.toISOString()),
      supabase
        .from('instagram_reels')
        .select('hashtags, reach, likes, comments, saves, shares')
        .not('hashtags', 'is', null)
        .gte('timestamp', since.toISOString()),
    ])

    const allMedia = [...(postsRes.data ?? []), ...(reelsRes.data ?? [])]

    // 2. Agregar metricas por hashtag
    const hashtagStats = new Map<string, { count: number; totalReach: number; totalEngagement: number }>()

    for (const media of allMedia) {
      const tags = media.hashtags as string[]
      const reach = media.reach ?? 0
      const engagement = (media.likes ?? 0) + (media.comments ?? 0) + (media.saves ?? 0) + (media.shares ?? 0)

      for (const tag of tags) {
        const key = tag.toLowerCase()
        const existing = hashtagStats.get(key) ?? { count: 0, totalReach: 0, totalEngagement: 0 }
        existing.count++
        existing.totalReach += reach
        existing.totalEngagement += engagement
        hashtagStats.set(key, existing)
      }
    }

    // 3. Extrair hashtags da caption para dar boost a tags relacionadas
    const captionTags = new Set(extractHashtags(caption).map((t) => t.toLowerCase()))

    // 4. Rankear por impacto + boost de relevancia
    const ranked = Array.from(hashtagStats.entries())
      .filter(([, stats]) => stats.count >= 2) // minimo 2 usos
      .map(([tag, stats]) => {
        const avgReach = stats.totalReach / stats.count
        const avgEngagement = stats.totalEngagement / stats.count
        const impact = avgReach * (avgEngagement / Math.max(avgReach, 1))
        // Boost 2x para hashtags ja mencionadas na caption
        const boost = captionTags.has(tag) ? 2 : 1

        return {
          hashtag: tag,
          count: stats.count,
          avg_reach: Math.round(avgReach),
          avg_engagement: Math.round(avgEngagement),
          impact: Math.round(impact * boost),
          in_caption: captionTags.has(tag),
        }
      })
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 15)

    return apiSuccess({ suggestions: ranked })
  } catch (err) {
    console.error('[Hashtag Suggest]', err)
    return apiError(getErrorMessage(err))
  }
}
