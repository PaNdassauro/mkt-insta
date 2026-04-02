import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const accountId = await resolveAccountId(request)
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('instagram_audience_snapshots')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(1)

  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query.single()

  if (error && error.code !== 'PGRST116') throw error

  return apiSuccess({ data: data ?? null }, 200, 3600)
}, 'DashIG Audience')
