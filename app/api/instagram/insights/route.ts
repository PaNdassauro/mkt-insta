import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const GET = withErrorHandler(async (request: Request) => {
  const accountId = await resolveAccountId(request)
  const { searchParams } = new URL(request.url)
  const days = Math.min(Number(searchParams.get('days')) || 30, 365)

  const supabase = createServerSupabaseClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  let query = supabase
    .from('instagram_account_snapshots')
    .select('*')
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query

  if (error) throw error

  return apiSuccess({ data }, 200, 3600)
}, 'DashIG Insights')
