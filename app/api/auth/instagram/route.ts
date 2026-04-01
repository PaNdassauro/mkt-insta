import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/auth/instagram
 * Redireciona o usuario para o Meta OAuth para autorizar acesso ao Instagram.
 *
 * Permissoes solicitadas:
 * - instagram_basic: acesso ao perfil
 * - instagram_manage_insights: metricas e insights
 * - pages_show_list: listar paginas do Facebook (necessario para vincular IG)
 * - pages_read_engagement: insights de pagina
 *
 * Fluxo: DashIG → Meta Login → Autoriza → Callback com code
 */
export async function GET() {
  const appId = process.env.META_APP_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://mkt-insta.vercel.app'}/api/auth/instagram/callback`

  if (!appId) {
    logger.error('META_APP_ID not configured', 'OAuth')
    return NextResponse.json({ error: 'OAuth nao configurado. Configure META_APP_ID.' }, { status: 500 })
  }

  const scopes = [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
  ].join(',')

  // State parameter para prevenir CSRF
  const state = crypto.randomUUID()

  const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)

  logger.info('Redirecting to Meta OAuth', 'OAuth', { redirectUri })

  return NextResponse.redirect(authUrl.toString())
}
