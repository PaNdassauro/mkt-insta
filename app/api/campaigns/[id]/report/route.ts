import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * GET /api/campaigns/[id]/report
 * Gera relatorio da campanha com metricas agregadas.
 * Inclui posts gerados (campaign_posts) e midias vinculadas (posts/reels com campaign_id).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    // Buscar campanha
    const { data: campaign, error: campErr } = await supabase
      .from('instagram_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (campErr || !campaign) {
      return apiError('Campanha nao encontrada', 404)
    }

    // Buscar posts da campanha (gerados pela IA)
    const { data: campaignPosts } = await supabase
      .from('campaign_posts')
      .select('*')
      .eq('campaign_id', id)
      .order('post_order')

    // Buscar midias vinculadas (posts reais do Instagram associados a esta campanha)
    const [{ data: linkedPosts }, { data: linkedReels }] = await Promise.all([
      supabase
        .from('instagram_posts')
        .select('media_id, caption, likes, comments, saves, shares, reach, engagement_rate, content_score, timestamp, permalink')
        .eq('campaign_id', id)
        .order('timestamp', { ascending: false }),
      supabase
        .from('instagram_reels')
        .select('media_id, caption, views, likes, comments, saves, shares, reach, content_score, timestamp, permalink')
        .eq('campaign_id', id)
        .order('timestamp', { ascending: false }),
    ])

    const posts = linkedPosts ?? []
    const reels = linkedReels ?? []

    // Calcular totais
    const allMedia = [
      ...posts.map((p) => ({ ...p, views: 0 })),
      ...reels,
    ]

    const totalReach = allMedia.reduce((sum, m) => sum + (m.reach ?? 0), 0)
    const totalLikes = allMedia.reduce((sum, m) => sum + (m.likes ?? 0), 0)
    const totalComments = allMedia.reduce((sum, m) => sum + (m.comments ?? 0), 0)
    const totalSaves = allMedia.reduce((sum, m) => sum + (m.saves ?? 0), 0)
    const totalShares = allMedia.reduce((sum, m) => sum + (m.shares ?? 0), 0)
    const totalViews = reels.reduce((sum, r) => sum + (r.views ?? 0), 0)

    const engRates = posts
      .filter((p) => p.engagement_rate != null)
      .map((p) => p.engagement_rate as number)
    const avgEngRate =
      engRates.length > 0
        ? engRates.reduce((s, v) => s + v, 0) / engRates.length
        : 0

    // Content score distribution
    const scoreDistribution: Record<string, number> = { VIRAL: 0, GOOD: 0, AVERAGE: 0, WEAK: 0 }
    allMedia.forEach((m) => {
      if (m.content_score && scoreDistribution[m.content_score] !== undefined) {
        scoreDistribution[m.content_score]++
      }
    })

    // Status dos posts da campanha
    const postStatusCount: Record<string, number> = {}
    ;(campaignPosts ?? []).forEach((p) => {
      postStatusCount[p.status] = (postStatusCount[p.status] ?? 0) + 1
    })

    const isComplete = campaign.status === 'SCHEDULED' || campaign.status === 'ARCHIVED'

    return apiSuccess({
      campaign,
      campaign_posts: campaignPosts ?? [],
      linked_media: { posts, reels },
      totals: {
        reach: totalReach,
        likes: totalLikes,
        comments: totalComments,
        saves: totalSaves,
        shares: totalShares,
        views: totalViews,
        engagement_rate_avg: avgEngRate,
        posts_count: posts.length,
        reels_count: reels.length,
        total_media: allMedia.length,
      },
      score_distribution: scoreDistribution,
      post_status: postStatusCount,
      report_type: isComplete ? 'FINAL' : 'PARTIAL',
    })
  } catch (err) {
    console.error('[Campaign Report]', err)
    return apiError(getErrorMessage(err))
  }
}
