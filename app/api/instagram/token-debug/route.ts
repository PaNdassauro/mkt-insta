import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { getAccessToken } from '@/lib/meta-client'
import { debugToken } from '@/lib/meta-ads-client'
import { resolveAccountId } from '@/lib/account-context'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instagram/token-debug
 * Inspeciona o token Meta atual via /debug_token e retorna scopes + expiracao.
 * Util para verificar se o token tem `ads_management` antes de tentar boost.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const accountId = await resolveAccountId(request)
    const token = await getAccessToken(accountId ?? undefined)
    const info = await debugToken(token)
    return apiSuccess(info)
  } catch (err) {
    logger.error('token-debug failed', 'Meta Ads', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
