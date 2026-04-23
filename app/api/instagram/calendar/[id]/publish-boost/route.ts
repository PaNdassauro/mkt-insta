import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'
import { boostInstagramPost } from '@/lib/meta-ads-client'
import { validateBoostConfig, type BoostConfigBody } from '@/lib/meta-ads-validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface PublishBoostBody {
  boost?: BoostConfigBody
}

/**
 * POST /api/instagram/calendar/[id]/publish-boost
 *
 * Chama o fluxo de publicação existente (/api/instagram/publish) e, se bem-sucedido,
 * dispara um boost no Meta Ads usando o media_id recém-publicado. Body carrega
 * a configuração completa do boost (mesma shape de /api/instagram/posts/[id]/boost).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { id: calendarEntryId } = await params

    let body: PublishBoostBody
    try {
      body = (await request.json()) as PublishBoostBody
    } catch {
      return apiError('Body JSON invalido', 400)
    }

    const boost = body.boost
    if (!boost) return apiError('boost obrigatorio', 400)

    const validationError = validateBoostConfig(boost)
    if (validationError) return apiError(`boost.${validationError}`, 400)

    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    // Pegar a caption pra nomear a campanha de boost
    const { data: entry } = await supabase
      .from('instagram_editorial_calendar')
      .select('caption_draft, published_media_id')
      .eq('id', calendarEntryId)
      .single()

    if (!entry) return apiError('Entrada nao encontrada', 404)
    if (entry.published_media_id) {
      return apiError('Esta entrada ja foi publicada', 400)
    }

    // 1. Publicar via endpoint interno — preserva 100% da logica existente
    const origin = new URL(request.url).origin
    const authHeader = request.headers.get('authorization') ?? ''
    const cookieHeader = request.headers.get('cookie') ?? ''
    const accountHeader = request.headers.get('x-account-id') ?? ''

    const publishRes = await fetch(`${origin}/api/instagram/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
        ...(cookieHeader && { Cookie: cookieHeader }),
        ...(accountHeader && { 'x-account-id': accountHeader }),
      },
      body: JSON.stringify({ calendarEntryId }),
    })

    const publishJson = await publishRes.json()
    if (!publishRes.ok) {
      return apiError(
        `Falha ao publicar: ${publishJson.error ?? 'erro desconhecido'}`,
        publishRes.status
      )
    }

    const publishedMediaId: string | undefined = publishJson.mediaId
    if (!publishedMediaId) {
      return apiError('Publicacao nao retornou media_id', 500)
    }

    logger.info('Publicacao bem-sucedida, iniciando boost', 'Publish+Boost', {
      calendarEntryId,
      publishedMediaId,
    })

    // 2. Boost com o media_id recém-publicado
    try {
      const boostResult = await boostInstagramPost({
        mediaId: publishedMediaId,
        dailyBudgetBRL: Number(boost.dailyBudgetBRL),
        durationDays: Number(boost.durationDays),
        caption: entry.caption_draft,
        launchImmediately: Boolean(boost.launchImmediately),
        accountId: accountId ?? undefined,
        objective: boost.objective,
        destinationUrl: boost.destinationUrl,
        cta: boost.cta,
        budgetType: boost.budgetType,
        totalBudgetBRL: boost.totalBudgetBRL,
        startDate: boost.startDate,
        urlTags: boost.urlTags,
        audience: boost.audience,
      })

      return apiSuccess({
        publish: { mediaId: publishedMediaId },
        boost: {
          ...boostResult,
          manageUrl: `https://www.facebook.com/adsmanager/manage/ads?act=${boostResult.adAccountId.replace(/^act_/, '')}&selected_ad_ids=${boostResult.adId}`,
        },
      })
    } catch (boostErr) {
      // Publicou mas falhou o boost — retorna parcial pra usuario saber
      logger.error('Publicou mas falhou boost', 'Publish+Boost', {
        error: boostErr as Error,
        publishedMediaId,
      })
      return apiSuccess({
        publish: { mediaId: publishedMediaId },
        boost: null,
        boostError: getErrorMessage(boostErr),
      })
    }
  } catch (err) {
    logger.error('publish-boost failed', 'Publish+Boost', { error: err as Error })
    return apiError(getErrorMessage(err), 500)
  }
}
