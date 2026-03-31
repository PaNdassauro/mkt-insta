import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * POST /api/campaigns/[id]/media
 * Vincula posts/reels existentes a uma campanha.
 * Body: { media_ids: string[], media_type: 'post' | 'reel' | 'story' }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const { media_ids, media_type } = body as {
      media_ids: string[]
      media_type: 'post' | 'reel' | 'story'
    }

    if (!media_ids?.length || !media_type) {
      return apiError('media_ids and media_type are required', 400)
    }

    const supabase = createServerSupabaseClient()

    const table =
      media_type === 'reel'
        ? 'instagram_reels'
        : media_type === 'story'
          ? 'instagram_stories'
          : 'instagram_posts'

    const { error } = await supabase
      .from(table)
      .update({ campaign_id: id })
      .in('media_id', media_ids)

    if (error) {
      throw new Error(`Failed to link media: ${error.message}`)
    }

    return apiSuccess({ linked: media_ids.length, media_type })
  } catch (err) {
    console.error('[Campaign Media Link]', err)
    return apiError(getErrorMessage(err))
  }
}

/**
 * DELETE /api/campaigns/[id]/media
 * Remove vinculo de midias com a campanha.
 * Body: { media_ids: string[], media_type: 'post' | 'reel' | 'story' }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = validateDashboardRequest(request)
  if (authErr) return authErr

  try {
    const { id } = await params
    const body = await request.json()
    const { media_ids, media_type } = body as {
      media_ids: string[]
      media_type: 'post' | 'reel' | 'story'
    }

    const supabase = createServerSupabaseClient()

    const table =
      media_type === 'reel'
        ? 'instagram_reels'
        : media_type === 'story'
          ? 'instagram_stories'
          : 'instagram_posts'

    await supabase
      .from(table)
      .update({ campaign_id: null })
      .in('media_id', media_ids)
      .eq('campaign_id', id)

    return apiSuccess({ unlinked: media_ids.length })
  } catch (err) {
    console.error('[Campaign Media Unlink]', err)
    return apiError(getErrorMessage(err))
  }
}
