import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

/**
 * GET /api/auth/canva
 * Redireciona o usuario para o Canva OAuth com PKCE.
 *
 * Query params opcionais:
 *   ?account_id=UUID — vincula o token a uma conta Instagram específica
 */
export async function GET(request: Request) {
  const clientId = process.env.CANVA_CLIENT_ID

  if (!clientId) {
    logger.error('CANVA_CLIENT_ID not configured', 'CanvaOAuth')
    return NextResponse.json(
      { error: 'Canva OAuth nao configurado. Configure CANVA_CLIENT_ID.' },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mkt-insta.vercel.app'
  const redirectUri = `${appUrl}/api/auth/canva/callback`

  // Optional account_id from query string
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id') ?? ''

  // Generate PKCE code_verifier and code_challenge
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  // State to carry account_id through the OAuth flow
  const state = JSON.stringify({ account_id: accountId, nonce: crypto.randomUUID() })

  // Store code_verifier and state in cookies (short-lived, httpOnly)
  const cookieStore = await cookies()
  cookieStore.set('canva_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  })
  cookieStore.set('canva_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  const scopes = 'design:read design:write asset:read'

  const authUrl = new URL('https://www.canva.com/api/oauth/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)

  logger.info('Redirecting to Canva OAuth', 'CanvaOAuth', { redirectUri })

  return NextResponse.redirect(authUrl.toString())
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
