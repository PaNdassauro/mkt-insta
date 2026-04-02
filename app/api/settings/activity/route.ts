import { logger } from '@/lib/logger'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = "force-dynamic"

/**
 * GET /api/settings/activity
 * Retorna entradas do log de atividades com filtros opcionais.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)

    const limitParam = parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = Math.min(Math.max(1, limitParam), 200)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)
    const entityType = searchParams.get('entity_type')
    const userId = searchParams.get('user_id')
    const since = searchParams.get('since')

    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (entityType) {
      query = query.eq('entity_type', entityType)
    }

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (since) {
      query = query.gte('created_at', since)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Falha ao buscar log de atividades: ${error.message}`)
    }

    return apiSuccess({ items: data ?? [], total: count ?? 0, limit, offset })
  } catch (err) {
    logger.error('Erro no log de atividades', 'ActivityLog', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
