import { NextResponse } from 'next/server'

// ============================================================
// Helpers padronizados para respostas de API
// ============================================================

/**
 * Resposta de sucesso padronizada.
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
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
      const prefix = label ? `[${label}]` : '[API]'
      console.error(`${prefix} Unhandled error:`, err)
      return apiError(getErrorMessage(err))
    }
  }
}
