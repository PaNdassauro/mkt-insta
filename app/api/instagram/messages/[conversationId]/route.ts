import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

/**
 * GET /api/instagram/messages/[conversationId]
 * Lista mensagens de uma conversa.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
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
    console.error('[Messages Thread GET]', err)
    return apiError(getErrorMessage(err))
  }
}
