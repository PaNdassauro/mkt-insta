import { logger } from '@/lib/logger'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { sendWebhookNotification } from '@/lib/webhook-notifier'

export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const webhookUrl = process.env.WEBHOOK_URL

    if (!webhookUrl) {
      return apiError('Webhook nao configurado. Defina a variavel WEBHOOK_URL.', 400)
    }

    await sendWebhookNotification(
      '✅ DashIG — Teste de Conexao\n\n' +
      'Esta mensagem confirma que as notificacoes via webhook estao funcionando corretamente.'
    )

    return apiSuccess({ message: 'Webhook de teste enviado com sucesso' })
  } catch (err) {
    logger.error('Webhook test error', 'Settings/Webhook', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
