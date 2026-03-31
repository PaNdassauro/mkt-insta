import { createServerSupabaseClient } from '@/lib/supabase'
import { ITEMS_PER_PAGE } from '@/lib/constants'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'

export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || ITEMS_PER_PAGE, 100)
  const offset = Number(searchParams.get('offset')) || 0
  const activeOnly = searchParams.get('active') === 'true'

  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('instagram_stories')
    .select('*', { count: 'exact' })

  if (activeOnly) {
    query = query.gte('expires_at', new Date().toISOString())
  }

  query = query
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  return apiSuccess({ data, total: count })
}, 'DashIG Stories')
