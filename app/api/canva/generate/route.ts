import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'
import { createServerSupabaseClient } from '@/lib/supabase'
import { createDesignFromTemplate } from '@/lib/canva-client'
import { logger } from '@/lib/logger'

export const dynamic = "force-dynamic"

/**
 * POST /api/canva/generate
 * Gera um design no Canva a partir de um template usando autofill com dados do post.
 *
 * Body: { template_id: string, post_id: string, campaign_id: string }
 */
export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const accountId = await resolveAccountId(request)
  const body = await request.json()
  const { template_id, post_id, campaign_id } = body

  if (!template_id || !post_id || !campaign_id) {
    return apiError('Campos obrigatorios: template_id, post_id, campaign_id', 400)
  }

  const supabase = createServerSupabaseClient()

  // Fetch post data
  let query = supabase
    .from('campaign_posts')
    .select('*, instagram_campaigns!inner(title, theme)')
    .eq('id', post_id)
    .eq('campaign_id', campaign_id)

  if (accountId) {
    query = query.eq('instagram_campaigns.account_id', accountId)
  }

  const { data: post, error: postError } = await query.maybeSingle()

  if (postError || !post) {
    return apiError('Post nao encontrado', 404)
  }

  const caption = post.caption_edited || post.caption || ''
  const visualBrief = post.visual_brief || ''
  const title = post.instagram_campaigns?.title || ''

  logger.info('Generating Canva design from template', 'CanvaGenerate', {
    template_id,
    post_id,
    campaign_id,
  })

  try {
    const design = await createDesignFromTemplate(template_id, {
      title,
      caption,
      visualBrief,
    })

    return apiSuccess(design)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    logger.error('Canva design generation failed', 'CanvaGenerate', { error: message })
    return apiError(`Erro ao gerar design no Canva: ${message}`)
  }
}, 'Canva Generate POST')
