import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'
import { boostInstagramPost } from '@/lib/meta-ads-client'
import { validateBoostConfig, type BoostConfigBody } from '@/lib/meta-ads-validation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type BoostBody = BoostConfigBody

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

    const validationError = validateBoostConfig(body)
    if (validationError) return apiError(validationError, 400)

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
      dailyBudgetBRL: Number(body.dailyBudgetBRL),
      durationDays: Number(body.durationDays),
      caption: row.caption,
      launchImmediately: Boolean(body.launchImmediately),
      accountId: accountId ?? undefined,
      objective: body.objective,
      destinationUrl: body.destinationUrl,
      cta: body.cta,
      budgetType: body.budgetType,
      totalBudgetBRL: body.totalBudgetBRL,
      startDate: body.startDate,
      urlTags: body.urlTags,
      audience: body.audience,
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
