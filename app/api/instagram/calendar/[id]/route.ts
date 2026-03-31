import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

/**
 * GET /api/instagram/calendar/[id]
 * Retorna uma entrada do calendario editorial.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    console.error('[Calendar Entry GET]', err)
    return apiError(getErrorMessage(err))
  }
}
