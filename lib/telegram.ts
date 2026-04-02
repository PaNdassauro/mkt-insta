/**
 * Telegram Bot API wrapper para notificacoes do DashIG.
 *
 * Configuracao via env vars:
 *   TELEGRAM_BOT_TOKEN - Token do bot (@BotFather)
 *   TELEGRAM_CHAT_ID   - Chat ID do grupo/usuario que recebe alertas
 */

import { logger } from '@/lib/logger'

const TELEGRAM_API = 'https://api.telegram.org/bot'

function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  return { token, chatId, configured: Boolean(token && chatId) }
}

/**
 * Envia mensagem de texto via Telegram Bot API.
 * Silenciosamente ignora se as env vars nao estiverem configuradas.
 */
export async function sendTelegramMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  const { token, chatId, configured } = getConfig()
  if (!configured) return

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      logger.warn('Failed to send message', 'Telegram', { response: err })
    }
  } catch (err) {
    logger.warn('Error sending message', 'Telegram', { error: err as Error })
  }
}

// ============================================================
// Alertas pre-definidos
// ============================================================

/**
 * Alerta: token do Meta esta expirando.
 */
export async function alertTokenExpiring(daysLeft: number) {
  await sendTelegramMessage(
    `⚠️ <b>DashIG — Token Expirando</b>\n\n` +
    `O token de acesso do Meta expira em <b>${daysLeft} dias</b>.\n` +
    `Acesse o dashboard para renovar.`
  )
}

/**
 * Alerta: campanha foi aprovada.
 */
export async function alertCampaignApproved(campaignTitle: string, postCount: number) {
  await sendTelegramMessage(
    `✅ <b>DashIG — Campanha Aprovada</b>\n\n` +
    `<b>${campaignTitle}</b>\n` +
    `${postCount} post(s) prontos para agendamento.`
  )
}

/**
 * Alerta: anomalia de engagement detectada.
 */
export async function alertEngagementAnomaly(
  type: 'drop' | 'spike',
  metric: string,
  value: number,
  average: number
) {
  const icon = type === 'drop' ? '📉' : '📈'
  const label = type === 'drop' ? 'Queda' : 'Pico'
  const pct = Math.abs(Math.round(((value - average) / average) * 100))

  await sendTelegramMessage(
    `${icon} <b>DashIG — ${label} de ${metric}</b>\n\n` +
    `Valor atual: <b>${value.toLocaleString('pt-BR')}</b>\n` +
    `Media 7 dias: <b>${average.toLocaleString('pt-BR')}</b>\n` +
    `Variacao: <b>${pct}%</b>`
  )
}

/**
 * Alerta: concorrente com crescimento acelerado de seguidores.
 */
export async function alertCompetitorGrowth(username: string, followers: number, growthPct: number) {
  await sendTelegramMessage(
    `🏆 <b>DashIG — Concorrente em Alta</b>\n\n` +
    `@${username} cresceu <b>${growthPct.toFixed(1)}%</b> na ultima semana.\n` +
    `Seguidores atuais: <b>${followers.toLocaleString('pt-BR')}</b>`
  )
}

/**
 * Alerta: sync diario completado com resumo.
 */
export async function alertSyncCompleted(posts: number, reels: number) {
  await sendTelegramMessage(
    `🔄 <b>DashIG — Sync Concluido</b>\n\n` +
    `Posts: ${posts} | Reels: ${reels}`
  )
}
