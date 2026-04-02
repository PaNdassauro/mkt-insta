import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken } from '@/lib/meta-client'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

const META_API = 'https://graph.facebook.com/v21.0'

/**
 * GET /api/instagram/mentions
 * Lista mencoes/tags da marca.
 */
export async function GET(request: Request) {
  try {
    const accountId = await resolveAccountId(request)
    const { searchParams } = new URL(request.url)
    const saved = searchParams.get('saved')

    const supabase = createServerSupabaseClient()
    let query = supabase
      .from('instagram_mentions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50)

    if (accountId) query = query.eq('account_id', accountId)
    if (saved === 'true') query = query.eq('is_saved', true)

    const { data, error } = await query
    if (error) throw error

    return apiSuccess(data ?? [])
  } catch (err) {
    logger.error('GET error', 'Mentions', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * POST /api/instagram/mentions
 * Sync de mencoes ou acao em uma mencao.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()

    // Acao: salvar como UGC
    if (body.action === 'save') {
      const supabase = createServerSupabaseClient()
      await supabase
        .from('instagram_mentions')
        .update({ is_saved: true, notes: body.notes ?? null })
        .eq('id', body.id)
      return apiSuccess({ success: true })
    }

    // Acao: unsave
    if (body.action === 'unsave') {
      const supabase = createServerSupabaseClient()
      await supabase
        .from('instagram_mentions')
        .update({ is_saved: false })
        .eq('id', body.id)
      return apiSuccess({ success: true })
    }

    // Acao padrao: sync de mencoes
    const accountId = await resolveAccountId(request)
    return handleSync(accountId)
  } catch (err) {
    logger.error('POST error', 'Mentions', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

async function handleSync(accountId: string | null) {
  const supabase = createServerSupabaseClient()
  const token = await getAccessToken()
  const userId = process.env.META_IG_USER_ID!

  // Buscar midias em que fomos tagados
  const res = await fetch(
    `${META_API}/${userId}/tags?fields=id,caption,permalink,media_type,media_url,timestamp,username&limit=50&access_token=${token}`
  )
  const data = await res.json()
  let synced = 0

  for (const item of data.data ?? []) {
    await supabase.from('instagram_mentions').upsert(
      {
        media_id: item.id,
        username: item.username ?? 'unknown',
        caption: item.caption ?? null,
        permalink: item.permalink ?? null,
        media_type: item.media_type ?? null,
        media_url: item.media_url ?? null,
        timestamp: item.timestamp ?? null,
        account_id: accountId,
      },
      { onConflict: 'media_id' }
    )
    synced++
  }

  return apiSuccess({ synced })
}
