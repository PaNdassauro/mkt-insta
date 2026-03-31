import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * Valida CRON_SECRET no header Authorization.
 * Retorna null se autenticado, ou NextResponse com erro 401.
 */
export function validateCronSecret(request: Request): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    logger.error('CRON_SECRET not configured', 'DashIG Auth')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

/**
 * Valida que a request vem do dashboard (mesmo origin) ou tem CRON_SECRET.
 * Protege rotas que modificam dados sem exigir login completo.
 * Retorna null se autenticado, ou NextResponse com erro 401.
 */
export function validateDashboardRequest(request: Request): NextResponse | null {
  // 1. Accept CRON_SECRET (for cron jobs and testing)
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (authHeader === `Bearer ${secret}`) return null

  // 2. Accept same-origin requests (from the dashboard)
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')

  if (host && origin) {
    const originHost = new URL(origin).host
    if (originHost === host) return null
  }

  if (host && referer) {
    try {
      const refererHost = new URL(referer).host
      if (refererHost === host) return null
    } catch {
      // invalid referer
    }
  }

  // 3. Accept localhost in development
  if (process.env.NODE_ENV === 'development') return null

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Escapa caracteres HTML para prevenir XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
