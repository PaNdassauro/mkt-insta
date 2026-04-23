import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'
import { listCustomAudiences } from '@/lib/meta-ads-client'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instagram/ads/audiences
 *
 * Lista os publicos personalizados da ad account atual (customaudiences).
 * Inclui o tamanho aproximado pra o caller decidir se o publico e utilizavel
 * (Meta exige >= 100 pessoas pra aplicar num anuncio).
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const accountId = await resolveAccountId(request)
    const data = await listCustomAudiences(accountId ?? undefined)
    return apiSuccess({ data, total: data.length }, 200, 300)
  } catch (err) {
    logger.error('List custom audiences failed', 'Meta Ads', { error: err as Error })
    return apiError(getErrorMessage(err), 500)
  }
}
