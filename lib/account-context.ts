import { createServerSupabaseClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * Resolve o account_id para usar nas queries.
 *
 * Prioridade:
 * 1. Header X-Account-Id (enviado pelo frontend quando conta selecionada)
 * 2. Primeira conta ativa no banco (fallback)
 * 3. null (sem conta — compatibilidade com dados antigos sem account_id)
 */
export async function resolveAccountId(request?: Request): Promise<string | null> {
  // 1. Header do frontend
  const headerAccountId = request?.headers.get('x-account-id')
  if (headerAccountId && headerAccountId !== 'undefined' && headerAccountId !== 'null') {
    return headerAccountId
  }

  // 2. Buscar primeira conta ativa
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    return data?.id ?? null
  } catch {
    logger.warn('Could not resolve account_id', 'AccountContext')
    return null
  }
}

/**
 * Aplica filtro de account_id em uma query do Supabase.
 * Se accountId for null, não filtra (compatibilidade com dados sem account_id).
 */
export function filterByAccount<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  accountId: string | null
): T {
  if (accountId) {
    return query.eq('account_id', accountId)
  }
  return query
}
