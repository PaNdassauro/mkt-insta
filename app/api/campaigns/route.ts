import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * GET /api/campaigns
 * Lista todas as campanhas com contagem de posts.
 */
export const GET = withErrorHandler(async () => {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('instagram_campaigns')
    .select('*, campaign_posts(count)')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch campaigns: ${error.message}`)
  }

  const campaigns = (data ?? []).map((c) => ({
    ...c,
    post_count: c.campaign_posts?.[0]?.count ?? 0,
    campaign_posts: undefined,
  }))

  return apiSuccess(campaigns)
}, 'Campaigns GET')
