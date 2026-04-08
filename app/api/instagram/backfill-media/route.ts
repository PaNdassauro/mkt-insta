/**
 * Backfill de thumbnails de posts e reels.
 *
 * Re-busca a lista atual de midias da Instagram Graph API, baixa cada
 * thumbnail e salva no Supabase Storage. Atualiza stored_thumbnail_url
 * em instagram_posts e instagram_reels.
 *
 * Limitacoes:
 * - Apenas midias ainda presentes no perfil podem ser recuperadas (a Graph
 *   API nao retorna midias deletadas).
 * - URLs do CDN do Instagram que ja expiraram nao podem ser recuperadas;
 *   esta rotina busca URLs frescas via Graph API e persiste enquanto sao
 *   validas.
 *
 * Auth: requer CRON_SECRET (via Authorization header). Pode ser disparado
 * manualmente uma vez ou via endpoint admin.
 */
import { createServerSupabaseClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import { getAccessToken, getMediaList } from '@/lib/meta-client'
import { persistPostMedia } from '@/lib/storage'

export const dynamic = 'force-dynamic'

interface BackfillAccount {
  id: string
  ig_user_id: string
}

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 500)
  const singleAccountId = request.headers.get('x-account-id')

  // Buscar contas ativas (mesma logica do sync)
  let accountQuery = supabase
    .from('instagram_accounts')
    .select('id, ig_user_id, access_token')
    .eq('is_active', true)

  if (singleAccountId) {
    accountQuery = accountQuery.eq('id', singleAccountId)
  }

  const { data: activeAccounts } = await accountQuery

  const validAccounts = (activeAccounts ?? []).filter(
    (a) => a.access_token && a.access_token !== 'pending_manual_update'
  )

  const accounts: BackfillAccount[] = []
  if (validAccounts.length > 0) {
    accounts.push(...validAccounts.map((a) => ({ id: a.id, ig_user_id: a.ig_user_id })))
  } else {
    const envUserId = process.env.META_IG_USER_ID
    if (!envUserId) {
      return apiError('No active accounts and META_IG_USER_ID not configured', 500)
    }
    accounts.push({ id: '', ig_user_id: envUserId })
  }

  const useMultiAccount = accounts.length > 0 && accounts[0].id !== ''

  const report = {
    accounts_processed: 0,
    fetched: 0,
    posts_updated: 0,
    reels_updated: 0,
    skipped_no_thumbnail: 0,
    upload_failures: 0,
  }

  for (const account of accounts) {
    const accountLabel = useMultiAccount ? ` [${account.ig_user_id}]` : ''

    let token: string
    try {
      token = useMultiAccount
        ? await getAccessToken(account.id)
        : await getAccessToken()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Backfill: token fetch failed${accountLabel}: ${message}`, 'DashIG Backfill')
      continue
    }

    let mediaItems
    try {
      mediaItems = await getMediaList(token, account.ig_user_id, limit)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Backfill: media list fetch failed${accountLabel}: ${message}`, 'DashIG Backfill')
      continue
    }

    report.fetched += mediaItems.length

    // Processa em batches paralelos pequenos para nao saturar o Storage
    const BATCH_SIZE = 5
    for (let i = 0; i < mediaItems.length; i += BATCH_SIZE) {
      const batch = mediaItems.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (item) => {
          if (!item.thumbnail_url) {
            report.skipped_no_thumbnail++
            return
          }

          const storedUrl = await persistPostMedia(item.thumbnail_url, item.id)
          if (!storedUrl) {
            report.upload_failures++
            return
          }

          const isReel = item.media_product_type === 'REELS'
          const table = isReel ? 'instagram_reels' : 'instagram_posts'

          const { error, count } = await supabase
            .from(table)
            .update({
              thumbnail_url: item.thumbnail_url,
              stored_thumbnail_url: storedUrl,
            }, { count: 'exact' })
            .eq('media_id', item.id)

          if (error) {
            logger.warn(
              `Backfill: ${table} update error for ${item.id}${accountLabel}: ${error.message}`,
              'DashIG Backfill'
            )
            return
          }

          if ((count ?? 0) > 0) {
            if (isReel) report.reels_updated++
            else report.posts_updated++
          }
        })
      )
    }

    report.accounts_processed++
  }

  logger.info(
    `Backfill complete: ${report.posts_updated} posts + ${report.reels_updated} reels updated (${report.upload_failures} failures)`,
    'DashIG Backfill'
  )

  return apiSuccess({ success: true, report })
}, 'DashIG Backfill')
