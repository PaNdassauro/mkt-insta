import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

/**
 * GET /api/campaigns/templates
 * Lista templates de campanha filtrados por account_id.
 */
export async function GET(request: Request) {
  try {
    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('campaign_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (accountId) query = query.eq('account_id', accountId)

    const { data, error } = await query
    if (error) throw error

    return apiSuccess({ data })
  } catch (err) {
    logger.error('GET error', 'Campaign Templates', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * POST /api/campaigns/templates
 * Cria template a partir de uma campanha existente ou do zero.
 * Body: { campaign_id?: string, title?: string, description?: string, briefing?: object }
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    let title: string
    const description: string | null = body.description || null
    let briefing: Record<string, unknown>
    let sourceCampaignId: string | null = null

    if (body.campaign_id) {
      // Criar a partir de campanha existente
      const { data: campaign, error: campError } = await supabase
        .from('instagram_campaigns')
        .select('*')
        .eq('id', body.campaign_id)
        .single()

      if (campError || !campaign) {
        return apiError('Campanha nao encontrada', 404)
      }

      sourceCampaignId = campaign.id
      title = body.title || `Template: ${campaign.title}`
      briefing = {
        objective: campaign.objective,
        theme: campaign.theme,
        audience: campaign.target_audience,
        duration_days: campaign.duration_days,
        formats: campaign.preferred_formats,
        tone: campaign.tone_notes,
      }
    } else {
      // Criar do zero
      if (!body.title || !body.briefing) {
        return apiError('title e briefing sao obrigatorios ao criar template do zero', 400)
      }
      title = body.title
      briefing = body.briefing
    }

    const { data, error } = await supabase
      .from('campaign_templates')
      .insert({
        title,
        description,
        source_campaign_id: sourceCampaignId,
        briefing,
        account_id: accountId,
      })
      .select()
      .single()

    if (error) throw error

    return apiSuccess({ data })
  } catch (err) {
    logger.error('POST error', 'Campaign Templates', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * DELETE /api/campaigns/templates?id=...
 * Remove um template.
 */
export async function DELETE(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return apiError('id e obrigatorio', 400)

    const supabase = createServerSupabaseClient()
    const { error } = await supabase
      .from('campaign_templates')
      .delete()
      .eq('id', id)

    if (error) throw error

    return apiSuccess({ success: true })
  } catch (err) {
    logger.error('DELETE error', 'Campaign Templates', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
