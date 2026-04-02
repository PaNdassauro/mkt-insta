import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken } from '@/lib/meta-client'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

const META_API = 'https://graph.facebook.com/v21.0'

/**
 * GET /api/instagram/comments
 * Lista comentarios sincronizados, com filtros.
 */
export async function GET(request: Request) {
  try {
    const accountId = await resolveAccountId(request)
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // all | unreplied | questions | hidden
    const mediaId = searchParams.get('media_id')

    const supabase = createServerSupabaseClient()
    let query = supabase
      .from('instagram_comments')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100)

    if (accountId) query = query.eq('account_id', accountId)
    if (filter === 'unreplied') query = query.eq('is_replied', false).eq('is_hidden', false)
    if (filter === 'questions') query = query.eq('sentiment', 'QUESTION')
    if (filter === 'hidden') query = query.eq('is_hidden', true)
    if (mediaId) query = query.eq('media_id', mediaId)

    const { data, error } = await query
    if (error) throw error

    return apiSuccess(data ?? [])
  } catch (err) {
    logger.error('GET error', 'Comments', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * POST /api/instagram/comments
 * Sync de comentarios de midias recentes OU responder a um comentario.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()

    // Acao: responder a um comentario
    if (body.action === 'reply') {
      return handleReply(body.comment_id, body.text)
    }

    // Acao: ocultar/mostrar
    if (body.action === 'hide') {
      return handleHide(body.comment_id, body.hide ?? true)
    }

    // Acao: deletar
    if (body.action === 'delete') {
      return handleDelete(body.comment_id)
    }

    // Acao padrao: sync de comentarios das midias recentes
    const accountId = await resolveAccountId(request)
    return handleSync(accountId)
  } catch (err) {
    logger.error('POST error', 'Comments', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

async function handleSync(accountId: string | null) {
  const supabase = createServerSupabaseClient()
  const token = await getAccessToken()
  const userId = process.env.META_IG_USER_ID!

  // Buscar midias recentes para pegar comentarios
  const mediaRes = await fetch(
    `${META_API}/${userId}/media?fields=id&limit=25&access_token=${token}`
  )
  const mediaData = await mediaRes.json()
  const mediaIds: string[] = (mediaData.data ?? []).map((m: { id: string }) => m.id)

  let synced = 0

  for (const mid of mediaIds) {
    const commentsRes = await fetch(
      `${META_API}/${mid}/comments?fields=id,from,text,timestamp,like_count,hidden,parent_id&limit=50&access_token=${token}`
    )
    const commentsData = await commentsRes.json()

    for (const c of commentsData.data ?? []) {
      const sentiment = classifySentiment(c.text)

      await supabase.from('instagram_comments').upsert(
        {
          comment_id: c.id,
          media_id: mid,
          parent_id: c.parent_id ?? null,
          username: c.from?.username ?? 'unknown',
          text: c.text,
          timestamp: c.timestamp,
          like_count: c.like_count ?? 0,
          is_hidden: c.hidden ?? false,
          sentiment,
          account_id: accountId,
        },
        { onConflict: 'comment_id' }
      )
      synced++
    }
  }

  return apiSuccess({ synced, media_checked: mediaIds.length })
}

async function handleReply(commentId: string, text: string) {
  if (!commentId || !text) {
    return apiError('comment_id and text required', 400)
  }

  const token = await getAccessToken()
  const supabase = createServerSupabaseClient()

  const res = await fetch(`${META_API}/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: text, access_token: token }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message ?? 'Failed to reply')
  }

  await supabase
    .from('instagram_comments')
    .update({ is_replied: true, reply_text: text, replied_at: new Date().toISOString() })
    .eq('comment_id', commentId)

  return apiSuccess({ success: true })
}

async function handleHide(commentId: string, hide: boolean) {
  const token = await getAccessToken()
  const supabase = createServerSupabaseClient()

  await fetch(`${META_API}/${commentId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ hide: String(hide), access_token: token }),
  })

  await supabase
    .from('instagram_comments')
    .update({ is_hidden: hide })
    .eq('comment_id', commentId)

  return apiSuccess({ success: true, hidden: hide })
}

async function handleDelete(commentId: string) {
  const token = await getAccessToken()
  const supabase = createServerSupabaseClient()

  await fetch(`${META_API}/${commentId}?access_token=${token}`, { method: 'DELETE' })

  await supabase.from('instagram_comments').delete().eq('comment_id', commentId)

  return apiSuccess({ success: true })
}

function classifySentiment(text: string): 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'QUESTION' {
  const lower = text.toLowerCase()
  const questionWords = ['?', 'como', 'quanto', 'onde', 'qual', 'quando', 'quero', 'pode', 'tem', 'faz', 'aceita']
  const positiveWords = ['lindo', 'maravilh', 'perfeito', 'incrivel', 'amei', 'parabens', 'sonho', 'top', '❤', '😍', '🔥', '👏']
  const negativeWords = ['ruim', 'horrivel', 'pessimo', 'nao gost', 'caro demais', 'decepcion']

  if (questionWords.some((w) => lower.includes(w))) return 'QUESTION'
  if (negativeWords.some((w) => lower.includes(w))) return 'NEGATIVE'
  if (positiveWords.some((w) => lower.includes(w))) return 'POSITIVE'
  return 'NEUTRAL'
}
