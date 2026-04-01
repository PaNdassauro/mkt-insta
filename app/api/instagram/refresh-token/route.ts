import { logger } from '@/lib/logger'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, getErrorMessage, withErrorHandler } from '@/lib/api-response'
import { getAccessToken, refreshLongLivedToken } from '@/lib/meta-client'
import { createServerSupabaseClient } from '@/lib/supabase'
import { META_API_BASE_URL } from '@/lib/constants'

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()
  const results: Array<{ account: string; success: boolean; error?: string }> = []

  // 1. Renovar tokens de todas as contas na tabela instagram_accounts
  const { data: accounts } = await supabase
    .from('instagram_accounts')
    .select('id, ig_user_id, username, access_token, label')
    .eq('is_active', true)

  if (accounts && accounts.length > 0) {
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET

    if (appId && appSecret) {
      for (const account of accounts) {
        try {
          const res = await fetch(
            `${META_API_BASE_URL}/oauth/access_token?` +
              `grant_type=fb_exchange_token&` +
              `client_id=${appId}&` +
              `client_secret=${appSecret}&` +
              `fb_exchange_token=${account.access_token}`
          )

          if (!res.ok) {
            const err = await res.text()
            logger.warn(`Token refresh failed for ${account.label}`, 'Refresh Token', { error: err })
            results.push({ account: account.label, success: false, error: 'Meta API error' })
            continue
          }

          const data = await res.json()
          const newToken = data.access_token
          const expiresIn = data.expires_in ?? 5184000
          const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

          await supabase
            .from('instagram_accounts')
            .update({
              access_token: newToken,
              token_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', account.id)

          logger.info(`Token refreshed for ${account.label}`, 'Refresh Token', { expiresAt })
          results.push({ account: account.label, success: true })
        } catch (err) {
          logger.error(`Token refresh error for ${account.label}`, 'Refresh Token', { error: err as Error })
          results.push({ account: account.label, success: false, error: getErrorMessage(err) })
        }
      }
    }
  }

  // 2. Renovar token legacy (app_config) se existir
  try {
    const currentToken = await getAccessToken()
    const { expiresAt } = await refreshLongLivedToken(currentToken)
    results.push({ account: 'legacy (app_config)', success: true })
    logger.info('Legacy token refreshed', 'Refresh Token', { expiresAt: expiresAt.toISOString() })
  } catch (err) {
    logger.warn('Legacy token refresh failed (may not exist)', 'Refresh Token')
    results.push({ account: 'legacy (app_config)', success: false, error: getErrorMessage(err) })
  }

  const successCount = results.filter((r) => r.success).length

  return apiSuccess({
    success: successCount > 0,
    refreshed: successCount,
    total: results.length,
    results,
  })
}, 'DashIG Refresh Token')
