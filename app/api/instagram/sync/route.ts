import { createServerSupabaseClient } from '@/lib/supabase'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import { alertTokenExpiring, alertSyncCompleted } from '@/lib/telegram'
import {
  getAccessToken,
  checkTokenExpiration,
  getAccountInfo,
  getAccountInsights,
  getMediaList,
  getMediaInsights,
} from '@/lib/meta-client'
import {
  calcEngagementRate,
  calcContentScore,
  calcMeanAndStdDev,
  extractHashtags,
  calcCompletionRate,
} from '@/lib/analytics'

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()
  const userId = process.env.META_IG_USER_ID
  if (!userId) {
    return apiError('META_IG_USER_ID not configured', 500)
  }

  // Buscar token e verificar expiracao
  const token = await getAccessToken()
  const { isExpiring, daysLeft } = await checkTokenExpiration()
  if (isExpiring) {
    console.warn(`[DashIG] Token expira em ${daysLeft} dias! Renovar urgente.`)
    await alertTokenExpiring(daysLeft)
  }

  // 1. Snapshot da conta
  const accountInfo = await getAccountInfo(token)
  const accountInsights = await getAccountInsights(token, userId)
  const today = new Date().toISOString().split('T')[0]

  const { error: snapshotError } = await supabase
    .from('instagram_account_snapshots')
    .upsert(
      {
        date: today,
        followers_count: accountInfo.followers_count,
        following_count: accountInfo.following_count,
        media_count: accountInfo.media_count,
        reach_7d: accountInsights.reach,
        impressions_7d: accountInsights.impressions,
        profile_views: accountInsights.profile_views,
        website_clicks: accountInsights.website_clicks,
      },
      { onConflict: 'date' }
    )
  if (snapshotError) throw new Error(`Snapshot error: ${snapshotError.message}`)

  // 2. Media list (limit via query param, default 50)
  const { searchParams } = new URL(request.url)
  const mediaLimit = Math.min(Number(searchParams.get('limit')) || 50, 500)
  const mediaItems = await getMediaList(token, userId, mediaLimit)
  let postsCount = 0
  let reelsCount = 0

  // Processar em batches paralelos de 5 para evitar rate limits
  const BATCH_SIZE = 5
  for (let i = 0; i < mediaItems.length; i += BATCH_SIZE) {
    const batch = mediaItems.slice(i, i + BATCH_SIZE)

    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const isReel = item.media_product_type === 'REELS'
          const insights = await getMediaInsights(
            token,
            item.id,
            isReel ? 'REEL' : item.media_type
          )
          const hashtags = extractHashtags(item.caption ?? null)

          if (isReel) {
            const completionRate = calcCompletionRate(
              insights.avg_watch_time ?? null,
              null
            )

            const { error } = await supabase.from('instagram_reels').upsert(
              {
                media_id: item.id,
                caption: item.caption ?? null,
                permalink: item.permalink ?? null,
                thumbnail_url: item.thumbnail_url ?? null,
                timestamp: item.timestamp,
                views: insights.views ?? 0,
                likes: insights.likes,
                comments: insights.comments,
                saves: insights.saved,
                shares: insights.shares,
                reach: insights.reach,
                completion_rate: completionRate,
                avg_watch_time_sec: insights.avg_watch_time ?? null,
                hashtags: hashtags.length > 0 ? hashtags : null,
                synced_at: new Date().toISOString(),
              },
              { onConflict: 'media_id' }
            )
            if (error) console.error(`Reel upsert error (${item.id}):`, error.message)
            reelsCount++
          } else {
            const engagementRate = calcEngagementRate(
              insights.likes,
              insights.comments,
              insights.saved,
              insights.shares,
              insights.reach
            )

            const { error } = await supabase.from('instagram_posts').upsert(
              {
                media_id: item.id,
                media_type: item.media_type,
                caption: item.caption ?? null,
                permalink: item.permalink ?? null,
                thumbnail_url: item.thumbnail_url ?? null,
                timestamp: item.timestamp,
                likes: insights.likes,
                comments: insights.comments,
                saves: insights.saved,
                shares: insights.shares,
                reach: insights.reach,
                impressions: insights.impressions,
                engagement_rate: engagementRate,
                hashtags: hashtags.length > 0 ? hashtags : null,
                synced_at: new Date().toISOString(),
              },
              { onConflict: 'media_id' }
            )
            if (error) console.error(`Post upsert error (${item.id}):`, error.message)
            postsCount++
          }
        } catch (err) {
          console.error(`Media sync error (${item.id}):`, err)
        }
      })
    )
  }

  // 3. Recalcular content_score de todos os posts
  await recalculateContentScores(supabase)

  // 4. Notificar via Telegram
  await alertSyncCompleted(postsCount, reelsCount)

  return apiSuccess({
    success: true,
    synced: { posts: postsCount, reels: reelsCount },
    tokenExpiring: isExpiring,
    daysLeft,
  })
}, 'DashIG Sync')

async function recalculateContentScores(
  supabase: ReturnType<typeof createServerSupabaseClient>
) {
  // Posts — batch por tier para minimizar queries
  const { data: posts } = await supabase
    .from('instagram_posts')
    .select('id, engagement_rate')

  if (posts && posts.length > 0) {
    const rates = posts
      .map((p) => p.engagement_rate)
      .filter((r): r is number => r !== null)
    const { mean, stdDev } = calcMeanAndStdDev(rates)

    // Agrupar IDs por score
    const scoreGroups: Record<string, string[]> = { VIRAL: [], GOOD: [], AVERAGE: [], WEAK: [] }
    for (const post of posts) {
      if (post.engagement_rate === null) continue
      const score = calcContentScore(post.engagement_rate, mean, stdDev)
      scoreGroups[score].push(post.id)
    }

    // Batch update por tier (4 queries em vez de N)
    for (const [score, ids] of Object.entries(scoreGroups)) {
      if (ids.length === 0) continue
      await supabase
        .from('instagram_posts')
        .update({ content_score: score })
        .in('id', ids)
    }
  }

  // Reels — mesmo batch approach
  const { data: reels } = await supabase
    .from('instagram_reels')
    .select('id, likes, comments, saves, shares, reach')

  if (reels && reels.length > 0) {
    const rates = reels.map((r) =>
      calcEngagementRate(r.likes, r.comments, r.saves, r.shares, r.reach)
    )
    const { mean, stdDev } = calcMeanAndStdDev(rates)

    const scoreGroups: Record<string, string[]> = { VIRAL: [], GOOD: [], AVERAGE: [], WEAK: [] }
    for (let i = 0; i < reels.length; i++) {
      const score = calcContentScore(rates[i], mean, stdDev)
      scoreGroups[score].push(reels[i].id)
    }

    for (const [score, ids] of Object.entries(scoreGroups)) {
      if (ids.length === 0) continue
      await supabase
        .from('instagram_reels')
        .update({ content_score: score })
        .in('id', ids)
    }
  }
}
