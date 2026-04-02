import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

export const dynamic = "force-dynamic"

/**
 * POST /api/instagram/manual-sync
 * Proxy para sync manual a partir do dashboard.
 * Aceita validateDashboardRequest (usuario logado) e chama o sync com CRON_SECRET.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return apiError('CRON_SECRET nao configurado', 500)
    }

    const host = request.headers.get('host') ?? 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    // Determinar quais endpoints chamar
    const body = await request.json().catch(() => ({}))
    const action = (body as Record<string, string>).action ?? 'all'

    const endpoints = action === 'refresh-token'
      ? ['refresh-token']
      : ['sync', 'sync-stories', 'sync-audience']

    const results: Record<string, unknown> = {}

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${baseUrl}/api/instagram/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
          },
        })

        if (res.ok) {
          results[endpoint] = await res.json()
        } else {
          const errText = await res.text()
          results[endpoint] = { error: errText, status: res.status }
          logger.warn(`Manual sync ${endpoint} failed`, 'Manual Sync', { status: res.status })
        }
      } catch (err) {
        results[endpoint] = { error: getErrorMessage(err) }
        logger.error(`Manual sync ${endpoint} error`, 'Manual Sync', { error: err as Error })
      }
    }

    return apiSuccess({ success: true, results })
  } catch (err) {
    logger.error('Manual sync error', 'Manual Sync', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
