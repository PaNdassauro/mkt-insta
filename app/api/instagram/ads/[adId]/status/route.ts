import { z } from 'zod'
import { apiSuccess, apiError, getErrorMessage, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'
import { getAdAccountConfig, updateAdStatus, type AdStatusUpdate } from '@/lib/meta-ads-client'
import { logActivity } from '@/lib/activity'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'DELETED']),
})

/**
 * PATCH /api/instagram/ads/{adId}/status
 *
 * Body: { status: "ACTIVE" | "PAUSED" | "DELETED" }
 *
 * Pausar, ativar ou excluir (soft) um anuncio via Meta Marketing API.
 * DELETED equivale a "arquivar" — o anuncio some da listagem padrao mas fica
 * recuperavel no Ads Manager (nao e DROP fisico).
 */
export const PATCH = withErrorHandler(async (
  request: Request,
  ctx: { params: Promise<{ adId: string }> }
) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const { adId } = await ctx.params
  if (!adId || !/^\d+$/.test(adId)) {
    return apiError('adId invalido', 400)
  }

  let body: { status: AdStatusUpdate }
  try {
    const raw = await request.json()
    body = BodySchema.parse(raw)
  } catch (err) {
    return apiError(`Body invalido: ${getErrorMessage(err)}`, 400)
  }

  const accountId = await resolveAccountId(request)
  const cfg = await getAdAccountConfig(accountId ?? undefined)

  const result = await updateAdStatus(adId, body.status, cfg.token)

  logger.info('Ad status atualizado', 'Meta Ads', {
    adId,
    newStatus: body.status,
    effectiveStatus: result.effective_status,
  })

  await logActivity({
    action: `instagram.ad.${body.status.toLowerCase()}`,
    entityType: 'ad',
    entityId: adId,
    details: {
      status: result.status,
      effective_status: result.effective_status,
    },
  })

  return apiSuccess({
    ad_id: adId,
    status: result.status,
    effective_status: result.effective_status,
  })
}, 'DashIG Ads Status')
