import { NextResponse } from 'next/server'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * GET /api/instagram/messages
 * Lista conversas com ultimas mensagens.
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('instagram_conversations')
      .select('*, instagram_messages(content, direction, timestamp, is_auto_reply)')
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // Reshape: pegar ultima mensagem de cada conversa
    const conversations = (data ?? []).map((conv) => {
      const messages = conv.instagram_messages as Array<{
        content: string | null
        direction: string
        timestamp: string
        is_auto_reply: boolean
      }>
      const sorted = messages.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      return {
        ...conv,
        last_message: sorted[0] ?? null,
        instagram_messages: undefined,
      }
    })

    return NextResponse.json(conversations)
  } catch (err) {
    console.error('[Messages GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/instagram/messages
 * Envia uma mensagem de resposta via Instagram API.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { conversation_id, text } = body

    if (!conversation_id || !text) {
      return NextResponse.json(
        { error: 'conversation_id and text are required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Buscar conversa
    const { data: conv } = await supabase
      .from('instagram_conversations')
      .select('ig_user_id')
      .eq('id', conversation_id)
      .single()

    if (!conv) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 })
    }

    // Enviar via Instagram API
    const { getAccessToken } = await import('@/lib/meta-client')
    const token = await getAccessToken()

    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: conv.ig_user_id },
          message: { text },
        }),
      }
    )

    const result = await res.json()

    if (!res.ok) {
      throw new Error(result.error?.message ?? 'Failed to send message')
    }

    // Salvar mensagem enviada
    const { data: msg } = await supabase
      .from('instagram_messages')
      .insert({
        conversation_id,
        ig_message_id: result.message_id ?? null,
        direction: 'OUTGOING',
        content: text,
        is_auto_reply: false,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single()

    // Atualizar conversa
    await supabase
      .from('instagram_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation_id)

    return NextResponse.json(msg)
  } catch (err) {
    console.error('[Messages POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
