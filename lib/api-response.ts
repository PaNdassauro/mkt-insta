import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// ============================================================
// Helpers padronizados para respostas de API
// ============================================================

/**
 * Resposta de sucesso padronizada.
 * @param cacheSeconds - Se fornecido, adiciona Cache-Control com s-maxage e stale-while-revalidate.
 */
export function apiSuccess<T>(data: T, status = 200, cacheSeconds?: number) {
  const headers: HeadersInit = {}
  if (cacheSeconds && cacheSeconds > 0) {
    headers['Cache-Control'] = `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`
  }
  return NextResponse.json(data, { status, headers })
}

/**
 * Resposta de erro padronizada.
 */
export function apiError(
  message: string,
  status = 500,
  details?: string
) {
  const body: { error: string; details?: string } = { error: message }
  if (details) body.details = details
  return NextResponse.json(body, { status })
}

/**
 * Extrai mensagem de erro de qualquer tipo de erro.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Internal server error'
}

/**
 * Wrapper para route handlers com try/catch padronizado.
 * Captura erros nao tratados e retorna 500 com mensagem padronizada.
 *
 * Uso:
 *   export const GET = withErrorHandler(async (request) => {
 *     // ... logica da rota
 *     return apiSuccess({ data: results })
 *   })
 */
export function withErrorHandler(
  handler: (request: Request) => Promise<NextResponse>,
  label?: string
) {
  return async (request: Request): Promise<NextResponse> => {
    try {
      return await handler(request)
    } catch (err) {
      logger.error('Unhandled error', label ?? 'API', { error: err as Error })
      return apiError(getErrorMessage(err))
    }
  }
}
