import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'

export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const days = Math.min(Number(searchParams.get('days')) || 30, 365)

  const supabase = createServerSupabaseClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('instagram_account_snapshots')
    .select('*')
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (error) throw error

  return apiSuccess({ data }, 200, 3600)
}, 'DashIG Insights')
