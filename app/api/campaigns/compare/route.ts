import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = "force-dynamic"

/**
 * GET /api/campaigns/compare?tags=tag1,tag2
 * Compara campanhas que possuem as mesmas tags.
 * Retorna metricas agregadas por campanha para comparacao.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const tagsParam = searchParams.get('tags')

  if (!tagsParam) {
    return apiError('tags parameter is required', 400)
  }

  const tags = tagsParam.split(',').map((t) => t.trim()).filter(Boolean)
  const supabase = createServerSupabaseClient()

  // Buscar campanhas que contenham qualquer uma das tags
  const { data: campaigns, error } = await supabase
    .from('instagram_campaigns')
    .select('id, title, status, tags, start_date, duration_days, created_at')
    .overlaps('tags', tags)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Para cada campanha, buscar metricas das midias vinculadas
  const results = await Promise.all(
    (campaigns ?? []).map(async (campaign) => {
      const [{ data: posts }, { data: reels }] = await Promise.all([
        supabase
          .from('instagram_posts')
          .select('likes, comments, saves, shares, reach, engagement_rate, content_score')
          .eq('campaign_id', campaign.id),
        supabase
          .from('instagram_reels')
          .select('views, likes, comments, saves, shares, reach, content_score')
          .eq('campaign_id', campaign.id),
      ])

      const allMedia = [
        ...(posts ?? []).map((p) => ({ ...p, views: 0 })),
        ...(reels ?? []),
      ]

      const totalReach = allMedia.reduce((s, m) => s + (m.reach ?? 0), 0)
      const totalLikes = allMedia.reduce((s, m) => s + (m.likes ?? 0), 0)
      const totalComments = allMedia.reduce((s, m) => s + (m.comments ?? 0), 0)
      const totalSaves = allMedia.reduce((s, m) => s + (m.saves ?? 0), 0)
      const totalShares = allMedia.reduce((s, m) => s + (m.shares ?? 0), 0)

      const engRates = (posts ?? [])
        .filter((p) => p.engagement_rate != null)
        .map((p) => p.engagement_rate as number)
      const avgEng = engRates.length > 0
        ? engRates.reduce((s, v) => s + v, 0) / engRates.length
        : 0

      return {
        ...campaign,
        metrics: {
          total_media: allMedia.length,
          posts_count: (posts ?? []).length,
          reels_count: (reels ?? []).length,
          reach: totalReach,
          likes: totalLikes,
          comments: totalComments,
          saves: totalSaves,
          shares: totalShares,
          engagement_rate_avg: avgEng,
        },
      }
    })
  )

  return apiSuccess({ tags, campaigns: results })
}, 'Campaign Compare')
