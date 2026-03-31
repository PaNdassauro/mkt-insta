import { logger } from '@/lib/logger'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { checkTokenExpiration } from '@/lib/meta-client'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()

    // --- Token status ---
    let tokenInfo: { status: string; daysLeft: number } = { status: 'unknown', daysLeft: 0 }
    try {
      const tokenCheck = await checkTokenExpiration()
      tokenInfo = {
        status: tokenCheck.isExpiring ? 'expiring' : 'valid',
        daysLeft: tokenCheck.daysLeft,
      }
    } catch (err) {
      logger.warn('Failed to check token expiration', 'SystemHealth', { error: err as Error })
    }

    // --- Last sync timestamps ---
    const [snapshotSync, storiesSync, audienceSync] = await Promise.all([
      supabase
        .from('instagram_account_snapshots')
        .select('captured_at')
        .order('captured_at', { ascending: false })
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
        .select('captured_at')
        .order('captured_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    const lastSyncs = [
      {
        tipo: 'Posts / Metricas',
        ultimaExecucao: snapshotSync.data?.captured_at ?? null,
        status: snapshotSync.data ? 'ok' : 'sem dados',
      },
      {
        tipo: 'Stories',
        ultimaExecucao: storiesSync.data?.synced_at ?? null,
        status: storiesSync.data ? 'ok' : 'sem dados',
      },
      {
        tipo: 'Audiencia',
        ultimaExecucao: audienceSync.data?.captured_at ?? null,
        status: audienceSync.data ? 'ok' : 'sem dados',
      },
    ]

    // --- Cron jobs (static list) ---
    const cronJobs = [
      { nome: 'Sync de midias e metricas', schedule: '0 6 * * *', descricao: 'Diario as 06:00 UTC', frequencia: 'Diario' },
      { nome: 'Sync de stories', schedule: '0 */4 * * *', descricao: 'A cada 4 horas', frequencia: '6x/dia' },
      { nome: 'Sync de audiencia', schedule: '0 7 * * 1', descricao: 'Semanal (segunda 07:00 UTC)', frequencia: 'Semanal' },
      { nome: 'Relatorio semanal', schedule: '0 8 * * 1', descricao: 'Semanal (segunda 08:00 UTC)', frequencia: 'Semanal' },
      { nome: 'Refresh de token', schedule: '0 3 */7 * *', descricao: 'A cada 7 dias as 03:00 UTC', frequencia: 'A cada 7 dias' },
    ]

    // --- Telegram config ---
    const telegramConfigured = Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
    )

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

    logger.info('System health data fetched', 'SystemHealth')

    return apiSuccess({
      token: tokenInfo,
      lastSyncs,
      cronJobs,
      telegram: { configured: telegramConfigured },
      dbStats,
      storageInfo,
    })
  } catch (err) {
    logger.error('System health error', 'SystemHealth', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
