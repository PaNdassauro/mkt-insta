import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('instagram_competitor_snapshots')
      .select('competitor_id, date, followers_count')
      .not('followers_count', 'is', null)
      .order('date', { ascending: true })

    if (error) throw error

    return apiSuccess({ data: data ?? [] })
  } catch (err) {
    logger.error('GET error', 'DashIG Competitor Snapshots', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
