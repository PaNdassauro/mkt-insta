import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
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

interface BoostBody {
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
 * POST /api/instagram/posts/[id]/boost
 * Body: { dailyBudgetBRL: number, durationDays: number }
 *
 * Cria uma campanha no Meta Ads que impulsiona o post com o ID interno [id]
 * (UUID da tabela instagram_posts OU instagram_reels). Resolve o media_id
 * do Instagram a partir do registro e encadeia campaign -> adset -> creative -> ad.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { id } = await params

    let body: BoostBody
    try {
      body = (await request.json()) as BoostBody
    } catch {
      return apiError('Body JSON invalido', 400)
    }

    const dailyBudgetBRL = Number(body.dailyBudgetBRL)
    const durationDays = Number(body.durationDays)

    if (!Number.isFinite(dailyBudgetBRL) || dailyBudgetBRL < 6) {
      return apiError('Orcamento diario deve ser >= R$ 6,00', 400)
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
      return apiError('Duracao deve ser um inteiro entre 1 e 30 dias', 400)
    }

    const objective: BoostObjective | undefined = body.objective
    if (objective !== undefined && !OBJECTIVES.includes(objective)) {
      return apiError(`objective deve ser um de: ${OBJECTIVES.join(', ')}`, 400)
    }
    const cta: BoostCta | undefined = body.cta
    if (cta !== undefined && !CTAS.includes(cta)) {
      return apiError(`cta deve ser um de: ${CTAS.join(', ')}`, 400)
    }

    const audience = body.audience
    if (audience) {
      if (audience.gender !== undefined && !GENDERS.includes(audience.gender)) {
        return apiError(`gender deve ser um de: ${GENDERS.join(', ')}`, 400)
      }
      if (audience.placements !== undefined) {
        if (!Array.isArray(audience.placements) || audience.placements.length === 0) {
          return apiError('placements deve ter ao menos 1 posicionamento', 400)
        }
        for (const p of audience.placements) {
          if (!PLACEMENTS.includes(p)) {
            return apiError(`placement invalido: ${p}`, 400)
          }
        }
      }
      if (audience.countries !== undefined) {
        if (!Array.isArray(audience.countries) || audience.countries.length === 0) {
          return apiError('countries deve ter ao menos 1 pais', 400)
        }
        for (const c of audience.countries) {
          if (typeof c !== 'string' || !/^[A-Z]{2}$/.test(c)) {
            return apiError(`country invalido: ${c} (use ISO-2, ex: BR, US)`, 400)
          }
        }
      }
      if (audience.ageMin !== undefined || audience.ageMax !== undefined) {
        const min = audience.ageMin ?? 18
        const max = audience.ageMax ?? 65
        if (!Number.isInteger(min) || !Number.isInteger(max) || min < 13 || max > 65 || min > max) {
          return apiError('ageMin/ageMax invalidos (13-65, min <= max)', 400)
        }
      }
    }

    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    // Look up post or reel by internal UUID to get the Meta media_id
    const [postRes, reelRes] = await Promise.all([
      supabase.from('instagram_posts').select('media_id, permalink, caption').eq('id', id).maybeSingle(),
      supabase.from('instagram_reels').select('media_id, permalink, caption').eq('id', id).maybeSingle(),
    ])

    type Row = { media_id: string; permalink: string | null; caption: string | null }
    const row = (postRes.data as Row | null) ?? (reelRes.data as Row | null)

    if (!row?.media_id) {
      return apiError('Post nao encontrado', 404)
    }

    const result = await boostInstagramPost({
      mediaId: row.media_id,
      dailyBudgetBRL,
      durationDays,
      caption: row.caption,
      launchImmediately: Boolean(body.launchImmediately),
      accountId: accountId ?? undefined,
      objective,
      destinationUrl: body.destinationUrl,
      cta,
      audience,
    })

    return apiSuccess({
      ...result,
      permalink: row.permalink,
      manageUrl: `https://www.facebook.com/adsmanager/manage/ads?act=${result.adAccountId.replace(/^act_/, '')}&selected_ad_ids=${result.adId}`,
    })
  } catch (err) {
    logger.error('Boost failed', 'Meta Ads', { error: err as Error })
    return apiError(getErrorMessage(err), 500)
  }
}
