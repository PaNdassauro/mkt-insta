import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = "force-dynamic"

/**
 * GET /api/auth/canva/status
 * Verifica se a conta atual tem tokens Canva configurados.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const accountId = await resolveAccountId(request)

  if (!accountId) {
    return apiSuccess({ connected: false, canva_user_id: null })
  }

  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('canva_tokens')
    .select('canva_user_id, expires_at')
    .eq('account_id', accountId)
    .maybeSingle()

  if (error) {
    return apiError(`Erro ao verificar status Canva: ${error.message}`)
  }

  if (!data) {
    return apiSuccess({ connected: false, canva_user_id: null })
  }

  // Check if token is expired
  const isExpired = data.expires_at && new Date(data.expires_at) < new Date()

  return apiSuccess({
    connected: !isExpired,
    canva_user_id: data.canva_user_id ?? null,
  })
}, 'Canva Status GET')
