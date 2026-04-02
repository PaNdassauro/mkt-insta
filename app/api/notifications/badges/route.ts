import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { checkTokenExpiration } from '@/lib/meta-client'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

/**
 * GET /api/notifications/badges
 * Returns badge counts for sidebar navigation items.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    // Build queries with optional account filtering
    let commentsQuery = supabase
      .from('instagram_comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_replied', false)
      .eq('is_hidden', false)
    if (accountId) commentsQuery = commentsQuery.eq('account_id', accountId)

    let campaignsQuery = supabase
      .from('instagram_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'REVIEW')
    if (accountId) campaignsQuery = campaignsQuery.eq('account_id', accountId)

    let conversationsQuery = supabase
      .from('instagram_conversations')
      .select('unread_count')
    if (accountId) conversationsQuery = conversationsQuery.eq('account_id', accountId)

    // Run all queries in parallel
    const [commentsResult, campaignsResult, conversationsResult, tokenResult] =
      await Promise.all([
        commentsQuery,
        campaignsQuery,
        conversationsQuery,
        checkTokenExpiration(),
      ])

    if (commentsResult.error) {
      logger.warn('Failed to fetch comments count', 'NotificationBadges', {
        error: commentsResult.error.message,
      } as Record<string, unknown>)
    }

    if (campaignsResult.error) {
      logger.warn('Failed to fetch campaigns count', 'NotificationBadges', {
        error: campaignsResult.error.message,
      } as Record<string, unknown>)
    }

    if (conversationsResult.error) {
      logger.warn('Failed to fetch conversations', 'NotificationBadges', {
        error: conversationsResult.error.message,
      } as Record<string, unknown>)
    }

    const messagesUnread = (conversationsResult.data ?? []).reduce(
      (sum: number, row: { unread_count: number | null }) =>
        sum + (row.unread_count ?? 0),
      0
    )

    const data = {
      comments_unreplied: commentsResult.count ?? 0,
      campaigns_review: campaignsResult.count ?? 0,
      messages_unread: messagesUnread,
      token_expiring: tokenResult.isExpiring,
    }

    // Cache for 5 minutes — badge data doesn't change frequently
    return apiSuccess(data, 200, 300)
  } catch (err) {
    logger.error('GET error', 'NotificationBadges', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
