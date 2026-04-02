import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { listTemplates } from '@/lib/canva-client'
import { logger } from '@/lib/logger'

/**
 * GET /api/canva/templates
 * Lista templates disponiveis na conta Canva conectada.
 */
export const GET = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const templates = await listTemplates()
    return apiSuccess({ templates, connected: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    logger.warn('Canva templates fetch failed (expected if not configured)', 'CanvaTemplates', { error: message })
    return apiSuccess({ templates: [], connected: false, message })
  }
}, 'Canva Templates GET')
