import { logger } from '@/lib/logger'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { logActivity } from '@/lib/activity'

/**
 * POST /api/campaigns/[id]/schedule
 * Agenda posts aprovados no calendario editorial.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    // Buscar campanha
    const { data: campaign, error: campErr } = await supabase
      .from('instagram_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (campErr || !campaign) {
      return apiError('Campanha nao encontrada', 404)
    }

    if (campaign.status !== 'APPROVED') {
      return apiError('Campanha precisa estar aprovada para agendar', 400)
    }

    // Buscar posts aprovados
    const { data: posts, error: postsErr } = await supabase
      .from('campaign_posts')
      .select('*')
      .eq('campaign_id', id)
      .eq('status', 'APPROVED')
      .order('post_order')

    if (postsErr || !posts || posts.length === 0) {
      return apiError('Nenhum post aprovado encontrado', 400)
    }

    let scheduled = 0

    for (const post of posts) {
      // Criar entrada no calendario editorial
      const { data: calEntry, error: calErr } = await supabase
        .from('instagram_editorial_calendar')
        .insert({
          scheduled_for: post.scheduled_for,
          content_type: post.format,
          caption_draft: post.caption_edited ?? post.caption,
          hashtags_plan: Array.isArray(post.hashtags_edited ?? post.hashtags)
            ? (post.hashtags_edited ?? post.hashtags).map((h: string) => `#${h}`)
            : null,
          topic: [post.cta, post.visual_brief, post.visual_notes]
            .filter(Boolean)
            .join(' | '),
          status: 'APPROVED',
        })
        .select()
        .single()

      if (calErr) {
        logger.error(`Error creating calendar entry for post ${post.id}`, 'Schedule', { error: calErr })
        continue
      }

      // Vincular post ao calendario
      await supabase
        .from('campaign_posts')
        .update({ calendar_entry_id: calEntry.id })
        .eq('id', post.id)

      scheduled++
    }

    // Atualizar status da campanha
    await supabase
      .from('instagram_campaigns')
      .update({ status: 'SCHEDULED', updated_at: new Date().toISOString() })
      .eq('id', id)

    // Registrar atividade de agendamento
    await logActivity({
      action: 'campaign.scheduled',
      entityType: 'campaign',
      entityId: id,
      details: {
        title: campaign.title,
        count: scheduled,
        total: posts.length,
      },
    })

    return apiSuccess({ scheduled, total: posts.length })
  } catch (err) {
    logger.error('Schedule error', 'Campaign Schedule', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
