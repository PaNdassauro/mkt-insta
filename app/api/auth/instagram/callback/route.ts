import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { META_API_BASE_URL } from '@/lib/constants'

export const dynamic = "force-dynamic"

/**
 * GET /api/auth/instagram/callback
 * Recebe o authorization code do Meta OAuth, troca por token de longa duracao,
 * descobre a conta Instagram Business vinculada, e salva em instagram_accounts.
 *
 * Fluxo:
 * 1. Recebe ?code=xxx da URL
 * 2. Troca code por short-lived token
 * 3. Troca short-lived por long-lived token (60 dias)
 * 4. Busca paginas do Facebook vinculadas
 * 5. Para cada pagina, busca a conta IG Business vinculada
 * 6. Salva a conta com token em instagram_accounts
 * 7. Redireciona para /dashboard/instagram/settings/accounts
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mkt-insta.vercel.app'
  const accountsPage = `${appUrl}/dashboard/instagram/settings/accounts`

  // Erro do Meta (usuario negou permissao, etc.)
  if (error) {
    logger.warn('OAuth denied', 'OAuth', { error, errorDescription })
    return NextResponse.redirect(`${accountsPage}?error=${encodeURIComponent(errorDescription ?? error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${accountsPage}?error=${encodeURIComponent('Codigo de autorizacao nao recebido')}`)
  }

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  const redirectUri = `${appUrl}/api/auth/instagram/callback`

  if (!appId || !appSecret) {
    logger.error('META_APP_ID or META_APP_SECRET not configured', 'OAuth')
    return NextResponse.redirect(`${accountsPage}?error=${encodeURIComponent('OAuth nao configurado no servidor')}`)
  }

  try {
    // 1. Trocar code por short-lived token
    const tokenRes = await fetch(
      `${META_API_BASE_URL}/oauth/access_token?` +
        `client_id=${appId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `client_secret=${appSecret}&` +
        `code=${code}`
    )

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      logger.error('Failed to exchange code for token', 'OAuth', { response: err })
      return NextResponse.redirect(`${accountsPage}?error=${encodeURIComponent('Erro ao obter token do Meta')}`)
    }

    const tokenData = await tokenRes.json()
    const shortLivedToken = tokenData.access_token

    // 2. Trocar por long-lived token (60 dias)
    const longLivedRes = await fetch(
      `${META_API_BASE_URL}/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${appId}&` +
        `client_secret=${appSecret}&` +
        `fb_exchange_token=${shortLivedToken}`
    )

    if (!longLivedRes.ok) {
      const err = await longLivedRes.text()
      logger.error('Failed to exchange for long-lived token', 'OAuth', { response: err })
      return NextResponse.redirect(`${accountsPage}?error=${encodeURIComponent('Erro ao obter token de longa duracao')}`)
    }

    const longLivedData = await longLivedRes.json()
    const accessToken = longLivedData.access_token
    const expiresIn = longLivedData.expires_in // seconds

    // Calcular data de expiracao
    const expiresAt = new Date(Date.now() + (expiresIn ?? 5184000) * 1000).toISOString()

    // 3. Buscar paginas do Facebook
    const pagesRes = await fetch(
      `${META_API_BASE_URL}/me/accounts?access_token=${accessToken}&fields=id,name,instagram_business_account`
    )

    if (!pagesRes.ok) {
      const err = await pagesRes.text()
      logger.error('Failed to fetch Facebook pages', 'OAuth', { response: err })
      return NextResponse.redirect(`${accountsPage}?error=${encodeURIComponent('Erro ao buscar paginas do Facebook')}`)
    }

    const pagesData = await pagesRes.json()
    const pages = pagesData.data ?? []

    // 4. Buscar contas IG Business vinculadas
    const supabase = createServerSupabaseClient()
    let accountsLinked = 0

    for (const page of pages) {
      const igAccountId = page.instagram_business_account?.id
      if (!igAccountId) continue

      // Buscar detalhes da conta IG
      const igRes = await fetch(
        `https://graph.instagram.com/v21.0/${igAccountId}?fields=username,name,profile_picture_url,followers_count&access_token=${accessToken}`
      )

      if (!igRes.ok) continue

      const igData = await igRes.json()

      // 5. Upsert na tabela instagram_accounts
      const { error: upsertErr } = await supabase
        .from('instagram_accounts')
        .upsert(
          {
            ig_user_id: igAccountId,
            username: igData.username ?? null,
            access_token: accessToken,
            token_expires_at: expiresAt,
            label: igData.name ?? igData.username ?? page.name ?? 'Conta Instagram',
            is_active: true,
          },
          { onConflict: 'ig_user_id' }
        )

      if (upsertErr) {
        logger.error('Failed to save account', 'OAuth', { igAccountId, error: upsertErr })
        continue
      }

      accountsLinked++
      logger.info(`Account linked: @${igData.username}`, 'OAuth', {
        igAccountId,
        username: igData.username,
        followers: igData.followers_count,
      })
    }

    if (accountsLinked === 0) {
      return NextResponse.redirect(
        `${accountsPage}?error=${encodeURIComponent('Nenhuma conta Instagram Business encontrada. Verifique se sua conta esta vinculada a uma Pagina do Facebook.')}`
      )
    }

    // Sucesso!
    return NextResponse.redirect(`${accountsPage}?success=${accountsLinked}`)
  } catch (err) {
    logger.error('OAuth callback error', 'OAuth', { error: err as Error })
    return NextResponse.redirect(`${accountsPage}?error=${encodeURIComponent('Erro interno ao conectar conta')}`)
  }
}
