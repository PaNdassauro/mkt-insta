/**
 * Generic webhook notifier for Slack, Teams, or any URL.
 * Uses WEBHOOK_URL env var.
 * Sends JSON payload compatible with Slack incoming webhooks.
 */

import { logger } from '@/lib/logger'

/**
 * Sends a notification to the configured webhook URL.
 * Silently returns if WEBHOOK_URL is not set.
 */
export async function sendWebhookNotification(text: string, blocks?: unknown[]) {
  const webhookUrl = process.env.WEBHOOK_URL
  if (!webhookUrl) return

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    })

    if (!res.ok) {
      const err = await res.text()
      logger.warn(`Webhook notification failed: ${err}`, 'Webhook')
    }
  } catch {
    logger.warn('Webhook notification failed', 'Webhook')
  }
}
