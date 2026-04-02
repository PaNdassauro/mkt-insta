import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

/**
 * GET /api/campaigns
 * Lista todas as campanhas com contagem de posts.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const accountId = await resolveAccountId(request)
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('instagram_campaigns')
    .select('*, campaign_posts(count)')
    .order('created_at', { ascending: false })

  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query

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
