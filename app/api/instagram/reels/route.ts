import { createServerSupabaseClient } from '@/lib/supabase'
import { ITEMS_PER_PAGE } from '@/lib/constants'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const accountId = await resolveAccountId(request)
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || ITEMS_PER_PAGE, 100)
  const offset = Number(searchParams.get('offset')) || 0
  const sortBy = searchParams.get('sort_by') || 'timestamp'
  const order = searchParams.get('order') || 'desc'
  const contentScore = searchParams.get('content_score')
  const since = searchParams.get('since')
  const until = searchParams.get('until')

  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('instagram_reels')
    .select('*', { count: 'exact' })

  if (accountId) query = query.eq('account_id', accountId)

  if (contentScore) {
    query = query.eq('content_score', contentScore)
  }
  if (since) query = query.gte('timestamp', `${since}T00:00:00Z`)
  if (until) query = query.lte('timestamp', `${until}T23:59:59Z`)

  const validSortColumns = ['timestamp', 'views', 'reach', 'likes', 'completion_rate', 'saves', 'shares']
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'timestamp'

  query = query
    .order(sortColumn, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  return apiSuccess({ data, total: count }, 200, 3600)
}, 'DashIG Reels')
