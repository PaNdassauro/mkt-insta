import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateDashboardRequest } from '@/lib/auth'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { getAccessToken } from '@/lib/meta-client'

/**
 * POST /api/instagram/messages/enrich
 * Busca usernames para conversas sem nome.
 *
 * O ig_user_id em conversas de DM e um IGSID (Instagram-Scoped ID).
 * A unica forma de obter o username e via:
 * 1. O payload do webhook (quando a mensagem chega) - ideal
 * 2. A API de conversas do Meta: GET /{ig-user-id}/conversations
 *
 * Para IGSIDs que nao tem username, tentamos buscar via
 * GET /{igsid}?fields=name,username com o token da pagina.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()

    let token: string
    try {
      token = await getAccessToken()
    } catch {
      return apiError('Token de acesso nao disponivel', 500)
    }

    // Buscar conversas sem username
    const { data: conversations } = await supabase
      .from('instagram_conversations')
      .select('id, ig_user_id')
      .is('username', null)

    if (!conversations || conversations.length === 0) {
      return apiSuccess({ enriched: 0, message: 'Todas as conversas ja tem username' })
    }

    let enriched = 0
    const errors: string[] = []

    for (const conv of conversations) {
      try {
        // Tentar buscar via Graph API (funciona para Business/Creator accounts)
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${conv.ig_user_id}?fields=name,username,profile_pic&access_token=${token}`
        )

        if (res.ok) {
          const profile = await res.json()
          const displayName = profile.username ?? profile.name ?? null

          if (displayName) {
            await supabase
              .from('instagram_conversations')
              .update({ username: displayName })
              .eq('id', conv.id)
            enriched++
          } else {
            // Sem username disponivel — usar ID abreviado como fallback
            await supabase
              .from('instagram_conversations')
              .update({ username: `usuario_${conv.ig_user_id.slice(-6)}` })
              .eq('id', conv.id)
            enriched++
          }
        } else {
          // API nao retornou dados — usar fallback
          const errText = await res.text()
          logger.warn(`Graph API returned ${res.status} for ${conv.ig_user_id}`, 'Messages Enrich', { response: errText })

          await supabase
            .from('instagram_conversations')
            .update({ username: `usuario_${conv.ig_user_id.slice(-6)}` })
            .eq('id', conv.id)
          enriched++
        }

        await new Promise((r) => setTimeout(r, 300))
      } catch {
        errors.push(conv.ig_user_id)
        logger.warn(`Failed to enrich ${conv.ig_user_id}`, 'Messages Enrich')
      }
    }

    return apiSuccess({
      enriched,
      total: conversations.length,
      errors: errors.length,
      message: enriched > 0
        ? `${enriched} conversas atualizadas${errors.length > 0 ? ` (${errors.length} erros)` : ''}`
        : 'Nenhuma conversa pôde ser atualizada',
    })
  } catch (err) {
    logger.error('Enrich error', 'Messages Enrich', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
