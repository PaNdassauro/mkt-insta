import { createServerSupabaseClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import { alertTokenExpiring, alertSyncCompleted, alertEngagementAnomaly } from '@/lib/telegram'
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
import { classifyContent } from '@/lib/content-classifier'

interface SyncAccount {
  id: string
  ig_user_id: string
}

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()

  // Multi-account: buscar todas as contas ativas
  // Se X-Account-Id presente, sincronizar apenas essa conta
  const singleAccountId = request.headers.get('x-account-id')

  let accountQuery = supabase
    .from('instagram_accounts')
    .select('id, ig_user_id')
    .eq('is_active', true)

  if (singleAccountId) {
    accountQuery = accountQuery.eq('id', singleAccountId)
  }

  const { data: activeAccounts } = await accountQuery

  // Montar lista de contas para sincronizar
  const accounts: SyncAccount[] = []
  if (activeAccounts && activeAccounts.length > 0) {
    accounts.push(...activeAccounts)
  } else {
    // Fallback legado: usar env vars (backward compatibility)
    const envUserId = process.env.META_IG_USER_ID
    if (!envUserId) {
      return apiError('No active accounts and META_IG_USER_ID not configured', 500)
    }
    accounts.push({ id: '', ig_user_id: envUserId })
  }

  const useMultiAccount = accounts.length > 0 && accounts[0].id !== ''

  const report = {
    accounts_synced: 0,
    snapshot: { success: false, error: null as string | null },
    media: { posts: 0, reels: 0, errors: 0 },
    contentScores: { success: false, error: null as string | null },
    anomalies: { checked: false },
    telegram: { sent: false },
  }

  let tokenExpiring = false
  let tokenDaysLeft = 0

  for (const account of accounts) {
    const accountLabel = useMultiAccount ? ` [${account.ig_user_id}]` : ''

    // Buscar token e verificar expiracao
    const token = useMultiAccount
      ? await getAccessToken(account.id)
      : await getAccessToken()
    const { isExpiring, daysLeft } = useMultiAccount
      ? await checkTokenExpiration(account.id)
      : await checkTokenExpiration()

    if (isExpiring) {
      tokenExpiring = true
      tokenDaysLeft = daysLeft
      logger.warn(`Token expira em ${daysLeft} dias!${accountLabel} Renovar urgente.`, 'DashIG Sync')
      await alertTokenExpiring(daysLeft)
    }

    // 1. Snapshot da conta
    try {
      const accountInfo = await getAccountInfo(token, account.ig_user_id)
      const accountInsights = await getAccountInsights(token, account.ig_user_id)
      const today = new Date().toISOString().split('T')[0]

      const snapshotPayload: Record<string, unknown> = {
        date: today,
        followers_count: accountInfo.followers_count,
        following_count: accountInfo.following_count,
        media_count: accountInfo.media_count,
        reach_7d: accountInsights.reach,
        impressions_7d: accountInsights.impressions,
        profile_views: accountInsights.profile_views,
        website_clicks: accountInsights.website_clicks,
      }
      if (useMultiAccount) {
        snapshotPayload.account_id = account.id
      }

      const { error: snapshotError } = await supabase
        .from('instagram_account_snapshots')
        .upsert(snapshotPayload, { onConflict: 'date' })
      if (snapshotError) {
        throw new Error(`Snapshot upsert: ${snapshotError.message}`)
      }
      report.snapshot.success = true
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      report.snapshot.error = message
      logger.error(`Account snapshot failed${accountLabel}: ${message}`, 'DashIG Sync')
    }

    // 2. Media list (limit via query param, default 50)
    let mediaSyncFailed = false
    try {
      const { searchParams } = new URL(request.url)
      const mediaLimit = Math.min(Number(searchParams.get('limit')) || 50, 500)
      const mediaItems = await getMediaList(token, account.ig_user_id, mediaLimit)

      // Processar em batches paralelos de 5 para evitar rate limits
      const BATCH_SIZE = 5
      for (let i = 0; i < mediaItems.length; i += BATCH_SIZE) {
        const batch = mediaItems.slice(i, i + BATCH_SIZE)

        const results = await Promise.allSettled(
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

                const category = classifyContent(item.caption ?? null, hashtags.length > 0 ? hashtags : null)

                const reelPayload: Record<string, unknown> = {
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
                  category,
                  synced_at: new Date().toISOString(),
                }
                if (useMultiAccount) {
                  reelPayload.account_id = account.id
                }

                const { error } = await supabase.from('instagram_reels').upsert(
                  reelPayload,
                  { onConflict: 'media_id' }
                )
                if (error) logger.warn(`Reel upsert error (${item.id})${accountLabel}: ${error.message}`, 'DashIG Sync')
                report.media.reels++
              } else {
                const engagementRate = calcEngagementRate(
                  insights.likes,
                  insights.comments,
                  insights.saved,
                  insights.shares,
                  insights.reach
                )

                const category = classifyContent(item.caption ?? null, hashtags.length > 0 ? hashtags : null)

                const postPayload: Record<string, unknown> = {
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
                  category,
                  synced_at: new Date().toISOString(),
                }
                if (useMultiAccount) {
                  postPayload.account_id = account.id
                }

                const { error } = await supabase.from('instagram_posts').upsert(
                  postPayload,
                  { onConflict: 'media_id' }
                )
                if (error) logger.warn(`Post upsert error (${item.id})${accountLabel}: ${error.message}`, 'DashIG Sync')
                report.media.posts++
              }
            } catch (err) {
              logger.warn(`Media sync error (${item.id})${accountLabel}`, 'DashIG Sync', { error: err as Error })
              throw err
            }
          })
        )

        for (const result of results) {
          if (result.status === 'rejected') {
            report.media.errors++
          }
        }
      }
    } catch (err) {
      mediaSyncFailed = true
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Media sync failed entirely${accountLabel}: ${message}`, 'DashIG Sync')
    }

    // If both snapshot AND media sync failed for this account, log but continue with next
    if (!report.snapshot.success && mediaSyncFailed) {
      logger.error(`Sync failed completely for account${accountLabel}`, 'DashIG Sync')
      continue
    }

    report.accounts_synced++
  }

  // If no accounts synced at all, return 500
  if (report.accounts_synced === 0) {
    return apiError('Sync failed: no accounts synced successfully', 500)
  }

  // 3. Recalcular content_score de todos os posts
  try {
    await recalculateContentScores(supabase)
    report.contentScores.success = true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    report.contentScores.error = message
    logger.warn(`Content score recalculation failed: ${message}`, 'DashIG Sync')
  }

  // 4. Detectar anomalias
  await detectAnomalies(supabase)
  report.anomalies.checked = true

  // 5. Notificar via Telegram
  try {
    await alertSyncCompleted(report.media.posts, report.media.reels)
    report.telegram.sent = true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn(`Telegram notification failed: ${message}`, 'DashIG Sync')
  }

  return apiSuccess({
    success: true,
    report,
    tokenExpiring,
    daysLeft: tokenDaysLeft,
  })
}, 'DashIG Sync')

async function detectAnomalies(
  supabase: ReturnType<typeof createServerSupabaseClient>
) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

    // --- 1. Follower drop ---
    const { data: snapshots } = await supabase
      .from('instagram_account_snapshots')
      .select('date, followers_count')
      .in('date', [today, yesterday])
      .order('date', { ascending: false })

    if (snapshots && snapshots.length >= 2) {
      const todaySnap = snapshots.find((s) => s.date === today)
      const yesterdaySnap = snapshots.find((s) => s.date === yesterday)

      if (todaySnap && yesterdaySnap && yesterdaySnap.followers_count > 0) {
        const dropPct =
          (yesterdaySnap.followers_count - todaySnap.followers_count) /
          yesterdaySnap.followers_count
        if (dropPct > 0.02) {
          logger.warn(
            `Follower drop detected: ${todaySnap.followers_count} vs ${yesterdaySnap.followers_count} (${(dropPct * 100).toFixed(1)}%)`,
            'DashIG Anomaly'
          )
          await alertEngagementAnomaly(
            'drop',
            'Seguidores',
            todaySnap.followers_count,
            yesterdaySnap.followers_count
          )
        }
      }
    }

    // --- 2. Viral post (engagement_rate > 3x average) ---
    const { data: allPosts } = await supabase
      .from('instagram_posts')
      .select('engagement_rate, synced_at')

    if (allPosts && allPosts.length > 0) {
      const rates = allPosts
        .map((p) => p.engagement_rate)
        .filter((r): r is number => r !== null)

      if (rates.length > 0) {
        const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length
        const todayStart = `${today}T00:00:00`

        const syncedToday = allPosts.filter(
          (p) =>
            p.synced_at &&
            p.synced_at >= todayStart &&
            p.engagement_rate !== null
        )

        for (const post of syncedToday) {
          if (post.engagement_rate! > avgRate * 3) {
            logger.info(
              `Viral post detected: engagement_rate ${post.engagement_rate!.toFixed(2)}% vs avg ${avgRate.toFixed(2)}%`,
              'DashIG Anomaly'
            )
            await alertEngagementAnomaly(
              'spike',
              'Engagement',
              post.engagement_rate!,
              avgRate
            )
            break // alert once to avoid spam
          }
        }
      }
    }

    // --- 3. Engagement trend (last 7d vs previous 7d) ---
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()

    const { data: recentPosts } = await supabase
      .from('instagram_posts')
      .select('engagement_rate, timestamp')
      .gte('timestamp', sevenDaysAgo)

    const { data: previousPosts } = await supabase
      .from('instagram_posts')
      .select('engagement_rate, timestamp')
      .gte('timestamp', fourteenDaysAgo)
      .lt('timestamp', sevenDaysAgo)

    if (recentPosts && previousPosts) {
      const recentRates = recentPosts
        .map((p) => p.engagement_rate)
        .filter((r): r is number => r !== null)
      const previousRates = previousPosts
        .map((p) => p.engagement_rate)
        .filter((r): r is number => r !== null)

      if (recentRates.length > 0 && previousRates.length > 0) {
        const recentAvg =
          recentRates.reduce((s, r) => s + r, 0) / recentRates.length
        const previousAvg =
          previousRates.reduce((s, r) => s + r, 0) / previousRates.length

        if (previousAvg > 0) {
          const dropPct = (previousAvg - recentAvg) / previousAvg
          if (dropPct > 0.3) {
            logger.warn(
              `Engagement trend drop: ${recentAvg.toFixed(2)}% vs ${previousAvg.toFixed(2)}% (${(dropPct * 100).toFixed(1)}% drop)`,
              'DashIG Anomaly'
            )
            await alertEngagementAnomaly(
              'drop',
              'Engagement (7d)',
              recentAvg,
              previousAvg
            )
          }
        }
      }
    }
  } catch (err) {
    logger.error('Anomaly detection failed (non-blocking)', 'DashIG Anomaly', {
      error: err as Error,
    })
  }
}

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
