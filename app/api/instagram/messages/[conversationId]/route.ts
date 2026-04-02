import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'

export const dynamic = "force-dynamic"

/**
 * GET /api/instagram/messages/[conversationId]
 * Lista mensagens de uma conversa.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { conversationId } = await params
    const supabase = createServerSupabaseClient()

    const { data: messages, error } = await supabase
      .from('instagram_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true })
      .limit(100)

    if (error) throw error

    // Marcar como lido
    await supabase
      .from('instagram_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)

    return apiSuccess(messages ?? [])
  } catch (err) {
    logger.error('GET error', 'Messages Thread', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
