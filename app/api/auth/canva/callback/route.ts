import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * GET /api/auth/canva/callback
 * Recebe o authorization code do Canva OAuth, troca por tokens,
 * e salva na tabela canva_tokens.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const stateParam = searchParams.get('state')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mkt-insta.vercel.app'
  const settingsPage = `${appUrl}/dashboard/instagram/settings`

  // Error from Canva (user denied, etc.)
  if (error) {
    logger.warn('Canva OAuth denied', 'CanvaOAuth', { error, errorDescription })
    return NextResponse.redirect(
      `${settingsPage}?canva_error=${encodeURIComponent(errorDescription ?? error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${settingsPage}?canva_error=${encodeURIComponent('Codigo de autorizacao nao recebido')}`
    )
  }

  // Retrieve PKCE code_verifier and state from cookies
  const cookieStore = await cookies()
  const codeVerifier = cookieStore.get('canva_code_verifier')?.value
  const storedState = cookieStore.get('canva_oauth_state')?.value

  if (!codeVerifier) {
    logger.error('Missing code_verifier cookie', 'CanvaOAuth')
    return NextResponse.redirect(
      `${settingsPage}?canva_error=${encodeURIComponent('Sessao expirada. Tente novamente.')}`
    )
  }

  // Validate state
  if (stateParam !== storedState) {
    logger.error('OAuth state mismatch', 'CanvaOAuth', {
      received: stateParam,
      expected: storedState,
    })
    return NextResponse.redirect(
      `${settingsPage}?canva_error=${encodeURIComponent('Erro de seguranca (state mismatch). Tente novamente.')}`
    )
  }

  const clientId = process.env.CANVA_CLIENT_ID
  const clientSecret = process.env.CANVA_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/auth/canva/callback`

  if (!clientId || !clientSecret) {
    logger.error('CANVA_CLIENT_ID or CANVA_CLIENT_SECRET not configured', 'CanvaOAuth')
    return NextResponse.redirect(
      `${settingsPage}?canva_error=${encodeURIComponent('OAuth nao configurado no servidor')}`
    )
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      logger.error('Failed to exchange Canva code for token', 'CanvaOAuth', { response: err })
      return NextResponse.redirect(
        `${settingsPage}?canva_error=${encodeURIComponent('Erro ao obter token do Canva')}`
      )
    }

    const tokenData = await tokenRes.json()
    const accessToken: string = tokenData.access_token
    const refreshToken: string | undefined = tokenData.refresh_token
    const expiresIn: number | undefined = tokenData.expires_in // seconds

    // Calculate expiration date
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null

    // Fetch Canva user info
    let canvaUserId: string | null = null
    try {
      const userRes = await fetch('https://api.canva.com/rest/v1/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (userRes.ok) {
        const userData = await userRes.json()
        canvaUserId = userData.id ?? userData.user?.id ?? null
      }
    } catch {
      logger.warn('Could not fetch Canva user info', 'CanvaOAuth')
    }

    // Parse account_id from state
    let accountId: string | null = null
    if (storedState) {
      try {
        const stateData = JSON.parse(storedState)
        accountId = stateData.account_id || null
      } catch {
        // ignore parse errors
      }
    }

    // Save tokens to canva_tokens table
    const supabase = createServerSupabaseClient()
    const { error: upsertErr } = await supabase
      .from('canva_tokens')
      .upsert(
        {
          account_id: accountId,
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
          expires_at: expiresAt,
          canva_user_id: canvaUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' }
      )

    if (upsertErr) {
      logger.error('Failed to save Canva tokens', 'CanvaOAuth', { error: upsertErr })
      return NextResponse.redirect(
        `${settingsPage}?canva_error=${encodeURIComponent('Erro ao salvar tokens do Canva')}`
      )
    }

    logger.info('Canva account connected', 'CanvaOAuth', { canvaUserId, accountId })

    // Clean up cookies
    cookieStore.delete('canva_code_verifier')
    cookieStore.delete('canva_oauth_state')

    return NextResponse.redirect(`${settingsPage}?canva_success=1`)
  } catch (err) {
    logger.error('Canva OAuth callback error', 'CanvaOAuth', { error: err as Error })
    return NextResponse.redirect(
      `${settingsPage}?canva_error=${encodeURIComponent('Erro interno ao conectar Canva')}`
    )
  }
}
