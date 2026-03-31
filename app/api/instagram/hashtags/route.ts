import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'

export const GET = withErrorHandler(async () => {
  const supabase = createServerSupabaseClient()

  // Buscar posts e reels com hashtags
  const [postsRes, reelsRes] = await Promise.all([
    supabase
      .from('instagram_posts')
      .select('hashtags, reach, engagement_rate, timestamp')
      .not('hashtags', 'is', null),
    supabase
      .from('instagram_reels')
      .select('hashtags, reach, likes, comments, saves, shares, timestamp')
      .not('hashtags', 'is', null),
  ])

  if (postsRes.error) throw postsRes.error
  if (reelsRes.error) throw reelsRes.error

  // Agregar por hashtag
  const hashtagMap = new Map<string, {
    count: number
    totalReach: number
    totalEngagement: number
    recentTimestamps: string[]
  }>()

  for (const post of postsRes.data ?? []) {
    if (!post.hashtags) continue
    for (const tag of post.hashtags) {
      const existing = hashtagMap.get(tag) ?? { count: 0, totalReach: 0, totalEngagement: 0, recentTimestamps: [] }
      existing.count++
      existing.totalReach += post.reach ?? 0
      existing.totalEngagement += post.engagement_rate ?? 0
      if (post.timestamp) existing.recentTimestamps.push(post.timestamp)
      hashtagMap.set(tag, existing)
    }
  }

  for (const reel of reelsRes.data ?? []) {
    if (!reel.hashtags) continue
    const engRate = reel.reach > 0
      ? ((reel.likes + reel.comments + reel.saves + reel.shares) / reel.reach) * 100
      : 0
    for (const tag of reel.hashtags) {
      const existing = hashtagMap.get(tag) ?? { count: 0, totalReach: 0, totalEngagement: 0, recentTimestamps: [] }
      existing.count++
      existing.totalReach += reel.reach ?? 0
      existing.totalEngagement += engRate
      if (reel.timestamp) existing.recentTimestamps.push(reel.timestamp)
      hashtagMap.set(tag, existing)
    }
  }

  // Calcular metricas e trend
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const hashtags = Array.from(hashtagMap.entries()).map(([tag, data]) => {
    const avgReach = data.count > 0 ? Math.round(data.totalReach / data.count) : 0
    const avgEngagement = data.count > 0 ? data.totalEngagement / data.count : 0
    const recentCount = data.recentTimestamps.filter(
      (t) => new Date(t) >= fourWeeksAgo
    ).length
    const olderCount = data.count - recentCount
    const trend = olderCount > 0 ? ((recentCount - olderCount) / olderCount) * 100 : recentCount > 0 ? 100 : 0
    const impact = avgReach * (avgEngagement / 100)

    return {
      hashtag: tag,
      count: data.count,
      avg_reach: avgReach,
      avg_engagement: Number(avgEngagement.toFixed(2)),
      trend: Number(trend.toFixed(1)),
      impact: Number(impact.toFixed(0)),
    }
  })

  hashtags.sort((a, b) => b.impact - a.impact)

  return apiSuccess({ data: hashtags }, 200, 3600)
}, 'DashIG Hashtags')
