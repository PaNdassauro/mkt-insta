import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateDashboardRequest } from '@/lib/auth'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

/**
 * POST /api/instagram/messages/enrich
 * Busca usernames via Meta Graph API para conversas que nao tem username.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()
    const token = process.env.META_ACCESS_TOKEN

    if (!token) {
      return apiError('META_ACCESS_TOKEN nao configurado', 500)
    }

    // Buscar conversas sem username
    const { data: conversations } = await supabase
      .from('instagram_conversations')
      .select('id, ig_user_id')
      .is('username', null)

    if (!conversations || conversations.length === 0) {
      return apiSuccess({ enriched: 0, message: 'Todas as conversas ja tem username' })
    }

    let enriched = 0

    for (const conv of conversations) {
      try {
        const res = await fetch(
          `https://graph.instagram.com/v21.0/${conv.ig_user_id}?fields=username&access_token=${token}`
        )
        if (res.ok) {
          const profile = await res.json()
          if (profile.username) {
            await supabase
              .from('instagram_conversations')
              .update({ username: profile.username })
              .eq('id', conv.id)
            enriched++
          }
        }
        // Rate limit: small delay between requests
        await new Promise((r) => setTimeout(r, 200))
      } catch {
        logger.warn(`Failed to enrich conversation ${conv.ig_user_id}`, 'Messages Enrich')
      }
    }

    return apiSuccess({ enriched, total: conversations.length })
  } catch (err) {
    logger.error('Enrich error', 'Messages Enrich', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
