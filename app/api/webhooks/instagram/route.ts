import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError } from '@/lib/api-response'

const VERIFY_TOKEN = process.env.CRON_SECRET ?? 'dashig-webhook-verify'

/**
 * GET /api/webhooks/instagram
 * Webhook verification (Meta challenge).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verified successfully')
    return new Response(challenge, { status: 200 })
  }

  return apiError('Forbidden', 403)
}

/**
 * POST /api/webhooks/instagram
 * Receives webhook events from Meta (messages, comments, mentions).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServerSupabaseClient()

    // Log raw event
    await supabase.from('webhook_events').insert({
      event_type: body.object ?? 'unknown',
      payload: body,
    })

    // Process entries
    if (body.object === 'instagram' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        // Process messaging events
        if (Array.isArray(entry.messaging)) {
          for (const event of entry.messaging) {
            await processMessageEvent(supabase, event)
          }
        }
      }
    }

    // Always return 200 quickly (Meta requires < 5s response)
    return apiSuccess({ status: 'ok' })
  } catch (err) {
    console.error('[Webhook] Error:', err)
    // Still return 200 to prevent Meta from retrying
    return apiSuccess({ status: 'error' })
  }
}

async function processMessageEvent(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  event: Record<string, unknown>
) {
  const sender = event.sender as { id: string } | undefined
  const message = event.message as {
    mid: string
    text?: string
    attachments?: Array<{ type: string; payload: { url: string } }>
  } | undefined

  if (!sender || !message) return

  const igUserId = sender.id
  const isIncoming = igUserId !== process.env.META_IG_USER_ID

  if (!isIncoming) return // Skip echoes of our own messages

  // 1. Upsert conversation
  const { data: conversation } = await supabase
    .from('instagram_conversations')
    .upsert(
      {
        ig_user_id: igUserId,
        last_message_at: new Date().toISOString(),
        unread_count: 1, // Will be incremented
      },
      { onConflict: 'ig_user_id' }
    )
    .select()
    .single()

  if (!conversation) return

  // Increment unread
  await supabase
    .from('instagram_conversations')
    .update({ unread_count: (conversation.unread_count ?? 0) + 1 })
    .eq('id', conversation.id)

  // 2. Insert message
  const mediaAttachment = message.attachments?.[0]

  await supabase.from('instagram_messages').insert({
    conversation_id: conversation.id,
    ig_message_id: message.mid,
    direction: 'INCOMING',
    content: message.text ?? null,
    media_url: mediaAttachment?.payload?.url ?? null,
    media_type: mediaAttachment?.type ?? null,
    timestamp: new Date().toISOString(),
  })

  // 3. Check auto-reply rules
  if (message.text) {
    await checkAndSendAutoReply(supabase, conversation.id, igUserId, message.text)
  }
}

async function checkAndSendAutoReply(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  conversationId: string,
  recipientIgId: string,
  messageText: string
) {
  const { data: rules } = await supabase
    .from('auto_reply_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (!rules || rules.length === 0) return

  const lowerText = messageText.toLowerCase()
  const matchedRule = rules.find((rule) => {
    return rule.keywords.some((keyword: string) => {
      const lowerKeyword = keyword.toLowerCase()
      switch (rule.match_type) {
        case 'exact':
          return lowerText === lowerKeyword
        case 'starts_with':
          return lowerText.startsWith(lowerKeyword)
        case 'contains':
        default:
          return lowerText.includes(lowerKeyword)
      }
    })
  })

  if (!matchedRule) return

  // Send auto-reply via Instagram Messaging API
  try {
    const { getAccessToken } = await import('@/lib/meta-client')
    const token = await getAccessToken()

    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/messages?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientIgId },
          message: { text: matchedRule.reply_text },
        }),
      }
    )

    const result = await res.json()

    if (res.ok) {
      // Save outgoing auto-reply
      await supabase.from('instagram_messages').insert({
        conversation_id: conversationId,
        ig_message_id: result.message_id ?? null,
        direction: 'OUTGOING',
        content: matchedRule.reply_text,
        is_auto_reply: true,
        timestamp: new Date().toISOString(),
      })

      // Increment usage count
      await supabase
        .from('auto_reply_rules')
        .update({ usage_count: matchedRule.usage_count + 1 })
        .eq('id', matchedRule.id)
    }
  } catch (err) {
    console.error('[AutoReply] Send failed:', err)
  }
}
