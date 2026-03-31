import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!botToken || !chatId) {
      return apiError('Telegram nao configurado. Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID.', 400)
    }

    await sendTelegramMessage(
      '✅ <b>DashIG — Teste de Conexao</b>\n\n' +
      'Esta mensagem confirma que as notificacoes do Telegram estao funcionando corretamente.'
    )

    return apiSuccess({ message: 'Mensagem de teste enviada com sucesso' })
  } catch (err) {
    console.error('[Settings/Telegram] Error:', err)
    return apiError(getErrorMessage(err))
  }
}
