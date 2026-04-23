import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'
import {
  boostInstagramPost,
  type BoostObjective,
  type BoostGender,
  type BoostPlacement,
  type BoostCta,
} from '@/lib/meta-ads-client'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface PublishBoostBody {
  boost?: {
    dailyBudgetBRL?: number
    durationDays?: number
    launchImmediately?: boolean
    objective?: BoostObjective
    destinationUrl?: string
    cta?: BoostCta
    audience?: {
      countries?: string[]
      ageMin?: number
      ageMax?: number
      gender?: BoostGender
      placements?: BoostPlacement[]
    }
  }
}

const OBJECTIVES: BoostObjective[] = ['AWARENESS', 'TRAFFIC', 'ENGAGEMENT']
const GENDERS: BoostGender[] = ['ALL', 'MALE', 'FEMALE']
const PLACEMENTS: BoostPlacement[] = ['stream', 'story', 'explore', 'reels']
const CTAS: BoostCta[] = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'CONTACT_US',
  'BOOK_TRAVEL',
  'GET_OFFER',
  'SEND_MESSAGE',
  'APPLY_NOW',
]

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

    const dailyBudgetBRL = Number(boost.dailyBudgetBRL)
    const durationDays = Number(boost.durationDays)

    if (!Number.isFinite(dailyBudgetBRL) || dailyBudgetBRL < 6) {
      return apiError('boost.dailyBudgetBRL deve ser >= 6', 400)
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
      return apiError('boost.durationDays deve ser inteiro entre 1 e 30', 400)
    }

    const objective: BoostObjective | undefined = boost.objective
    if (objective !== undefined && !OBJECTIVES.includes(objective)) {
      return apiError(`boost.objective deve ser um de: ${OBJECTIVES.join(', ')}`, 400)
    }
    const cta: BoostCta | undefined = boost.cta
    if (cta !== undefined && !CTAS.includes(cta)) {
      return apiError(`boost.cta deve ser um de: ${CTAS.join(', ')}`, 400)
    }

    const audience = boost.audience
    if (audience) {
      if (audience.gender !== undefined && !GENDERS.includes(audience.gender)) {
        return apiError(`boost.audience.gender deve ser um de: ${GENDERS.join(', ')}`, 400)
      }
      if (audience.placements !== undefined) {
        if (!Array.isArray(audience.placements) || audience.placements.length === 0) {
          return apiError('boost.audience.placements deve ter ao menos 1 posicionamento', 400)
        }
        for (const p of audience.placements) {
          if (!PLACEMENTS.includes(p)) {
            return apiError(`posicionamento invalido: ${p}`, 400)
          }
        }
      }
      if (audience.countries !== undefined) {
        if (!Array.isArray(audience.countries) || audience.countries.length === 0) {
          return apiError('boost.audience.countries deve ter ao menos 1 pais', 400)
        }
        for (const c of audience.countries) {
          if (typeof c !== 'string' || !/^[A-Z]{2}$/.test(c)) {
            return apiError(`pais invalido: ${c} (use ISO-2, ex: BR, US)`, 400)
          }
        }
      }
      if (audience.ageMin !== undefined || audience.ageMax !== undefined) {
        const min = audience.ageMin ?? 18
        const max = audience.ageMax ?? 65
        if (!Number.isInteger(min) || !Number.isInteger(max) || min < 13 || max > 65 || min > max) {
          return apiError('boost.audience.ageMin/ageMax invalidos (13-65, min <= max)', 400)
        }
      }
    }

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
        dailyBudgetBRL,
        durationDays,
        caption: entry.caption_draft,
        launchImmediately: Boolean(boost.launchImmediately),
        accountId: accountId ?? undefined,
        objective,
        destinationUrl: boost.destinationUrl,
        cta,
        audience,
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
