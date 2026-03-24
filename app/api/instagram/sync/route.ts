import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
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

export async function POST(request: Request) {
  try {
    // Validar CRON_SECRET
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const userId = process.env.META_IG_USER_ID
    if (!userId) {
      return NextResponse.json({ error: 'META_IG_USER_ID not configured' }, { status: 500 })
    }

    // Buscar token e verificar expiracao
    const token = await getAccessToken()
    const { isExpiring, daysLeft } = await checkTokenExpiration()
    if (isExpiring) {
      console.warn(`[DashIG] Token expira em ${daysLeft} dias! Renovar urgente.`)
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

    for (const item of mediaItems) {
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
          null // duration sera atualizado depois se disponivel
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
    }

    // 3. Recalcular content_score de todos os posts
    await recalculateContentScores(supabase)

    return NextResponse.json({
      success: true,
      synced: { posts: postsCount, reels: reelsCount },
      tokenExpiring: isExpiring,
      daysLeft,
    })
  } catch (err) {
    console.error('[DashIG Sync] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

async function recalculateContentScores(
  supabase: ReturnType<typeof createServerSupabaseClient>
) {
  // Posts
  const { data: posts } = await supabase
    .from('instagram_posts')
    .select('id, engagement_rate')

  if (posts && posts.length > 0) {
    const rates = posts
      .map((p) => p.engagement_rate)
      .filter((r): r is number => r !== null)
    const { mean, stdDev } = calcMeanAndStdDev(rates)

    for (const post of posts) {
      if (post.engagement_rate === null) continue
      const score = calcContentScore(post.engagement_rate, mean, stdDev)
      await supabase
        .from('instagram_posts')
        .update({ content_score: score })
        .eq('id', post.id)
    }
  }

  // Reels — calcula baseado em engagement com reach
  const { data: reels } = await supabase
    .from('instagram_reels')
    .select('id, likes, comments, saves, shares, reach')

  if (reels && reels.length > 0) {
    const rates = reels.map((r) =>
      calcEngagementRate(r.likes, r.comments, r.saves, r.shares, r.reach)
    )
    const { mean, stdDev } = calcMeanAndStdDev(rates)

    for (let i = 0; i < reels.length; i++) {
      const score = calcContentScore(rates[i], mean, stdDev)
      await supabase
        .from('instagram_reels')
        .update({ content_score: score })
        .eq('id', reels[i].id)
    }
  }
}
