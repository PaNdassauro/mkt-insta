import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { getAccessToken, refreshLongLivedToken } from '@/lib/meta-client'

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const currentToken = await getAccessToken()
  const { token, expiresAt } = await refreshLongLivedToken(currentToken)

  return apiSuccess({
    success: true,
    expires_at: expiresAt.toISOString(),
    token_preview: `${token.slice(0, 10)}...`,
  })
}, 'DashIG Refresh Token')
