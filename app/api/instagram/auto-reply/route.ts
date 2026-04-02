import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

export const dynamic = "force-dynamic"

/**
 * GET /api/instagram/auto-reply
 * Lista regras de auto-reply.
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('auto_reply_rules')
      .select('*')
      .order('priority', { ascending: false })

    if (error) throw error
    return apiSuccess(data ?? [])
  } catch (err) {
    return apiError(getErrorMessage(err))
  }
}

/**
 * POST /api/instagram/auto-reply
 * Cria uma nova regra de auto-reply.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { name, keywords, match_type, reply_text, priority } = body

    if (!name || !keywords?.length || !reply_text) {
      return apiError('name, keywords and reply_text are required', 400)
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('auto_reply_rules')
      .insert({
        name,
        keywords,
        match_type: match_type ?? 'contains',
        reply_text,
        priority: priority ?? 0,
      })
      .select()
      .single()

    if (error) throw error
    return apiSuccess(data)
  } catch (err) {
    return apiError(getErrorMessage(err))
  }
}

/**
 * PUT /api/instagram/auto-reply
 * Atualiza uma regra existente.
 */
export async function PUT(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return apiError('id is required', 400)
    }

    const allowedFields = ['name', 'keywords', 'match_type', 'reply_text', 'is_active', 'priority']
    const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (updates[field] !== undefined) safeUpdates[field] = updates[field]
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('auto_reply_rules')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return apiSuccess(data)
  } catch (err) {
    return apiError(getErrorMessage(err))
  }
}

/**
 * DELETE /api/instagram/auto-reply
 */
export async function DELETE(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return apiError('id is required', 400)

    const supabase = createServerSupabaseClient()
    await supabase.from('auto_reply_rules').delete().eq('id', id)
    return apiSuccess({ success: true })
  } catch (err) {
    return apiError(getErrorMessage(err))
  }
}
