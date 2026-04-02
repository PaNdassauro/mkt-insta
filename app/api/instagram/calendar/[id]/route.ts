import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'

export const dynamic = "force-dynamic"

/**
 * GET /api/instagram/calendar/[id]
 * Retorna uma entrada do calendario editorial.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('instagram_editorial_calendar')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return apiError('Entrada nao encontrada', 404)
    }

    return apiSuccess(data)
  } catch (err) {
    logger.error('GET error', 'Calendar Entry', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
