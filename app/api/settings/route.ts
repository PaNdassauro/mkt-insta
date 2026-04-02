import { logger } from '@/lib/logger'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { checkTokenExpiration } from '@/lib/meta-client'

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    // Token status
    let tokenStatus: { isExpiring: boolean; daysLeft: number } | null = null
    try {
      tokenStatus = await checkTokenExpiration()
    } catch {
      tokenStatus = null
    }

    // Telegram config status
    const telegramConfigured = Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
    )

    // Webhook config status
    const webhookConfigured = Boolean(process.env.WEBHOOK_URL)

    // Instagram User ID
    const igUserId = process.env.META_IG_USER_ID ?? null

    return apiSuccess({
      token: tokenStatus
        ? {
            status: tokenStatus.isExpiring ? 'expiring' : 'valid',
            daysLeft: tokenStatus.daysLeft,
          }
        : { status: 'unknown', daysLeft: 0 },
      telegram: {
        configured: telegramConfigured,
      },
      webhook: {
        configured: webhookConfigured,
      },
      instagram: {
        userId: igUserId,
      },
    })
  } catch (err) {
    logger.error('Settings error', 'Settings', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    // Por enquanto, endpoint de teste — configuracoes vem de env vars
    return apiSuccess({ message: 'Configuracoes salvas com sucesso' })
  } catch (err) {
    logger.error('Settings error', 'Settings', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
