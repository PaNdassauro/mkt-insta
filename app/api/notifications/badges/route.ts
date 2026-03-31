import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { checkTokenExpiration } from '@/lib/meta-client'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

/**
 * GET /api/notifications/badges
 * Returns badge counts for sidebar navigation items.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()

    // Run all queries in parallel
    const [commentsResult, campaignsResult, conversationsResult, tokenResult] =
      await Promise.all([
        // Unreplied, non-hidden comments
        supabase
          .from('instagram_comments')
          .select('*', { count: 'exact', head: true })
          .eq('is_replied', false)
          .eq('is_hidden', false),

        // Campaigns pending review
        supabase
          .from('instagram_campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'REVIEW'),

        // Unread messages (sum of unread_count)
        supabase
          .from('instagram_conversations')
          .select('unread_count'),

        // Token expiration check
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
