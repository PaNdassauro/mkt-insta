import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * GET /api/campaigns/[id]/posts
 * Lista todos os posts de uma campanha.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('campaign_posts')
      .select('*')
      .eq('campaign_id', id)
      .order('post_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`)
    }

    return apiSuccess(data ?? [])
  } catch (err) {
    console.error('[Campaign Posts GET]', err)
    return apiError(getErrorMessage(err))
  }
}
