import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

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

    return NextResponse.json(messages ?? [])
  } catch (err) {
    console.error('[Messages Thread GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
