import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'

export const GET = withErrorHandler(async () => {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('instagram_audience_snapshots')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  return apiSuccess({ data: data ?? null }, 200, 3600)
}, 'DashIG Audience')
