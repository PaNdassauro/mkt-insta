import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { exportDesign } from '@/lib/canva-client'
import { logger } from '@/lib/logger'

/**
 * POST /api/canva/export
 * Exporta um design do Canva como PNG.
 *
 * Body: { design_id: string, format?: 'png' | 'jpg' | 'pdf' }
 */
export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const body = await request.json()
  const { design_id, format = 'png' } = body

  if (!design_id) {
    return apiError('Campo obrigatorio: design_id', 400)
  }

  logger.info('Exporting Canva design', 'CanvaExport', { design_id, format })

  try {
    const downloadUrl = await exportDesign(design_id, format)
    return apiSuccess({ download_url: downloadUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    logger.error('Canva export failed', 'CanvaExport', { error: message })
    return apiError(`Erro ao exportar design do Canva: ${message}`)
  }
}, 'Canva Export POST')
