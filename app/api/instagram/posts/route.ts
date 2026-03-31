import { createServerSupabaseClient } from '@/lib/supabase'
import { ITEMS_PER_PAGE } from '@/lib/constants'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const GET = withErrorHandler(async (request: Request) => {
  const accountId = await resolveAccountId(request)
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || ITEMS_PER_PAGE, 100)
  const offset = Number(searchParams.get('offset')) || 0
  const sortBy = searchParams.get('sort_by') || 'timestamp'
  const order = searchParams.get('order') || 'desc'
  const mediaType = searchParams.get('media_type')
  const contentScore = searchParams.get('content_score')

  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('instagram_posts')
    .select('*', { count: 'exact' })

  if (accountId) query = query.eq('account_id', accountId)

  if (mediaType) {
    query = query.eq('media_type', mediaType)
  }
  if (contentScore) {
    query = query.eq('content_score', contentScore)
  }

  const validSortColumns = ['timestamp', 'engagement_rate', 'reach', 'likes', 'comments', 'saves', 'shares']
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'timestamp'

  query = query
    .order(sortColumn, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  return apiSuccess({ data, total: count }, 200, 3600)
}, 'DashIG Posts')
