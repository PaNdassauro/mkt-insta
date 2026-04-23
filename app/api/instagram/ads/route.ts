import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'
import { listAdsWithInsights } from '@/lib/meta-ads-client'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/instagram/ads?since=YYYY-MM-DD&until=YYYY-MM-DD
 *
 * Lista todos os anuncios da conta de ads configurada (META_AD_ACCOUNT_ID)
 * com metricas agregadas de insights (gasto, alcance, impressoes, cliques, etc.)
 * para o periodo informado. Se since/until forem omitidos, retorna insights
 * lifetime do anuncio.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') ?? undefined
    const until = searchParams.get('until') ?? undefined

    if (since && !DATE_RE.test(since)) return apiError('since deve estar no formato YYYY-MM-DD', 400)
    if (until && !DATE_RE.test(until)) return apiError('until deve estar no formato YYYY-MM-DD', 400)
    if ((since && !until) || (!since && until)) {
      return apiError('Informe since e until juntos, ou nenhum', 400)
    }

    const accountId = await resolveAccountId(request)
    const data = await listAdsWithInsights({
      since,
      until,
      accountId: accountId ?? undefined,
    })

    return apiSuccess({ data, total: data.length }, 200, 300)
  } catch (err) {
    logger.error('List ads failed', 'Meta Ads', { error: err as Error })
    return apiError(getErrorMessage(err), 500)
  }
}
