import { logger } from '@/lib/logger'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { checkTokenExpiration, getAccessToken } from '@/lib/meta-client'
import { debugToken } from '@/lib/meta-ads-client'
import { createServerSupabaseClient } from '@/lib/supabase'
import { META_API_BASE_URL } from '@/lib/constants'

const TOKEN_WARNING_DAYS = 60

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()

    // --- Token status ---
    // Authoritative source: Meta /debug_token on the current env token (.env is
    // env-first, so this reflects META_ACCESS_TOKEN). Falls back to cached
    // checkTokenExpiration() if debug_token is unreachable.
    let tokenInfo: {
      status: string
      daysLeft: number
      expiresAt: number | null
      warning: boolean
      warningThresholdDays: number
    } = {
      status: 'unknown',
      daysLeft: 0,
      expiresAt: null,
      warning: false,
      warningThresholdDays: TOKEN_WARNING_DAYS,
    }
    try {
      const token = await getAccessToken()
      const info = await debugToken(token)
      const daysLeft = info.expiresAt
        ? Math.floor((info.expiresAt * 1000 - Date.now()) / 86_400_000)
        : 0
      tokenInfo = {
        status: !info.isValid ? 'expired' : daysLeft <= 0 ? 'expired' : 'valid',
        daysLeft: Math.max(daysLeft, 0),
        expiresAt: info.expiresAt,
        warning: info.isValid && daysLeft > 0 && daysLeft < TOKEN_WARNING_DAYS,
        warningThresholdDays: TOKEN_WARNING_DAYS,
      }
    } catch (err) {
      logger.warn('debug_token failed, falling back to cached expiry', 'SystemHealth', { error: err as Error })
      try {
        const tokenCheck = await checkTokenExpiration()
        tokenInfo = {
          status: tokenCheck.isExpiring ? 'expiring' : 'valid',
          daysLeft: tokenCheck.daysLeft,
          expiresAt: null,
          warning: tokenCheck.daysLeft > 0 && tokenCheck.daysLeft < TOKEN_WARNING_DAYS,
          warningThresholdDays: TOKEN_WARNING_DAYS,
        }
      } catch (err2) {
        logger.warn('Failed to check token expiration', 'SystemHealth', { error: err2 as Error })
      }
    }

    // --- Instagram account info (live from Meta) ---
    const igUserId = process.env.META_IG_USER_ID ?? null
    const adAccountId = process.env.META_AD_ACCOUNT_ID ?? null
    const pageId = process.env.META_PAGE_ID ?? null

    let instagramAccount: {
      igUserId: string | null
      adAccountId: string | null
      pageId: string | null
      username: string | null
      name: string | null
      profilePictureUrl: string | null
      followersCount: number | null
      mediaCount: number | null
    } = {
      igUserId,
      adAccountId,
      pageId,
      username: null,
      name: null,
      profilePictureUrl: null,
      followersCount: null,
      mediaCount: null,
    }

    if (igUserId) {
      try {
        const token = await getAccessToken()
        const fields = 'username,name,profile_picture_url,followers_count,media_count'
        const url = `${META_API_BASE_URL}/${igUserId}?fields=${fields}&access_token=${encodeURIComponent(token)}`
        const res = await fetch(url)
        if (res.ok) {
          const data = (await res.json()) as {
            username?: string
            name?: string
            profile_picture_url?: string
            followers_count?: number
            media_count?: number
          }
          instagramAccount = {
            igUserId,
            adAccountId,
            pageId,
            username: data.username ?? null,
            name: data.name ?? null,
            profilePictureUrl: data.profile_picture_url ?? null,
            followersCount: data.followers_count ?? null,
            mediaCount: data.media_count ?? null,
          }
        } else {
          logger.warn('Failed to fetch IG account profile', 'SystemHealth', { status: res.status })
        }
      } catch (err) {
        logger.warn('IG account fetch threw', 'SystemHealth', { error: err as Error })
      }
    }

    // --- Last sync timestamps ---
    const [snapshotSync, storiesSync, audienceSync] = await Promise.all([
      supabase
        .from('instagram_account_snapshots')
        .select('date, created_at')
        .order('date', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('instagram_stories')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('instagram_audience_snapshots')
        .select('week_start, created_at')
        .order('week_start', { ascending: false })
        .limit(1)
        .single(),
    ])

    const lastSyncs = [
      {
        tipo: 'Posts / Metricas',
        ultimaExecucao: snapshotSync.data?.created_at ?? null,
        status: snapshotSync.data ? 'ok' : 'sem dados',
      },
      {
        tipo: 'Stories',
        ultimaExecucao: storiesSync.data?.synced_at ?? null,
        status: storiesSync.data ? 'ok' : 'sem dados',
      },
      {
        tipo: 'Audiencia',
        ultimaExecucao: audienceSync.data?.created_at ?? null,
        status: audienceSync.data ? 'ok' : 'sem dados',
      },
    ]

    // --- Cron jobs (static list) ---
    const cronJobs = [
      { nome: 'dashig-sync-daily', schedule: '0 11 * * *', descricao: 'Diario as 08:00 BRT (11:00 UTC)', frequencia: 'Diario' },
      { nome: 'dashig-sync-stories', schedule: '0 14 * * *', descricao: 'Diario as 11:00 BRT (14:00 UTC)', frequencia: 'Diario' },
      { nome: 'dashig-sync-audience', schedule: '0 11 * * 1', descricao: 'Segunda as 08:00 BRT (11:00 UTC)', frequencia: 'Semanal' },
      { nome: 'dashig-report-monthly', schedule: '0 8 1 * *', descricao: 'Dia 1 as 05:00 BRT (08:00 UTC)', frequencia: 'Mensal' },
      { nome: 'dashig-knowledge-scrape', schedule: '0 9 * * 1', descricao: 'Segunda as 06:00 BRT (09:00 UTC)', frequencia: 'Semanal' },
      { nome: 'dashig-auto-publish', schedule: '*/30 * * * *', descricao: 'A cada 30 minutos', frequencia: 'Contínuo' },
    ]

    // --- Telegram + webhook config ---
    const telegramConfigured = Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
    )
    const webhookConfigured = Boolean(process.env.WEBHOOK_URL)

    // --- Database stats ---
    const [postsCount, reelsCount, storiesCount, campaignsCount, commentsCount] = await Promise.all([
      supabase.from('instagram_posts').select('id', { count: 'exact', head: true }),
      supabase.from('instagram_reels').select('id', { count: 'exact', head: true }),
      supabase.from('instagram_stories').select('id', { count: 'exact', head: true }),
      supabase.from('instagram_campaigns').select('id', { count: 'exact', head: true }),
      supabase.from('instagram_comments').select('id', { count: 'exact', head: true }),
    ])

    const dbStats = {
      posts: postsCount.count ?? 0,
      reels: reelsCount.count ?? 0,
      stories: storiesCount.count ?? 0,
      campaigns: campaignsCount.count ?? 0,
      comments: commentsCount.count ?? 0,
    }

    // --- Storage info: story media files ---
    const { count: mediaFilesCount } = await supabase
      .from('instagram_stories')
      .select('id', { count: 'exact', head: true })
      .or('thumbnail_url.neq.null,video_url.neq.null')

    const storageInfo = {
      storyMediaFiles: mediaFilesCount ?? 0,
    }

    // --- Performance: sync history (last 7 snapshots) ---
    const { data: syncHistoryData } = await supabase
      .from('instagram_account_snapshots')
      .select('date, created_at')
      .order('date', { ascending: false })
      .limit(7)

    const syncHistory = (syncHistoryData ?? []).map((s) => ({
      date: s.date,
      createdAt: s.created_at,
      success: true,
    }))

    // --- Performance: storage usage ---
    const [docsCount, chunksCount] = await Promise.all([
      supabase.from('knowledge_documents').select('id', { count: 'exact', head: true }),
      supabase.from('document_chunks').select('id', { count: 'exact', head: true }),
    ])

    const storageUsage = {
      storyMediaFiles: mediaFilesCount ?? 0,
      totalCampaigns: dbStats.campaigns,
      totalDocuments: docsCount.count ?? 0,
      totalChunks: chunksCount.count ?? 0,
    }

    // --- Performance: API response times (placeholder) ---
    const apiResponseTimes: Array<{ endpoint: string; avgMs: number | null }> = [
      { endpoint: '/api/instagram/sync', avgMs: null },
      { endpoint: '/api/instagram/posts', avgMs: null },
      { endpoint: '/api/instagram/reels', avgMs: null },
      { endpoint: '/api/instagram/stories', avgMs: null },
    ]

    // --- Performance: Meta API quota (placeholder) ---
    const metaApiQuota = {
      note: 'A Meta Graph API possui limite de 200 chamadas por hora por usuario. O DashIG faz aproximadamente 5-10 chamadas por sync. Monitore em https://developers.facebook.com/tools/explorer/',
      monitorUrl: 'https://developers.facebook.com/tools/explorer/',
      estimatedCallsPerSync: 10,
      hourlyLimit: 200,
    }

    const performance = {
      apiResponseTimes,
      syncHistory,
      storageUsage,
      metaApiQuota,
    }

    // --- Report info ---
    const reportEmailTo = process.env.REPORT_EMAIL_TO || process.env.REPORT_RECIPIENT_EMAIL || null
    const reportEmailConfigured = Boolean(reportEmailTo && process.env.RESEND_API_KEY)

    // Find last snapshot on day 1 of any month (approximation for last report date)
    const { data: lastReportSnap } = await supabase
      .from('instagram_account_snapshots')
      .select('date')
      .like('date', '%-01')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    const report = {
      lastReportDate: lastReportSnap?.date ?? null,
      emailConfigured: reportEmailConfigured,
      emailTo: reportEmailTo,
    }

    logger.info('System health data fetched', 'SystemHealth')

    return apiSuccess({
      token: tokenInfo,
      instagramAccount,
      lastSyncs,
      cronJobs,
      telegram: { configured: telegramConfigured },
      webhook: { configured: webhookConfigured },
      dbStats,
      storageInfo,
      performance,
      report,
    })
  } catch (err) {
    logger.error('System health error', 'SystemHealth', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
