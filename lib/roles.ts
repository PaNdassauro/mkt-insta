import { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'editor' | 'viewer'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  editor: 2,
  viewer: 1,
}

/**
 * Retorna o role de um usuario. Retorna 'viewer' se nao houver role atribuido.
 */
export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRole> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error || !data) return 'viewer'
  return data.role as UserRole
}

/**
 * Verifica se o usuario possui pelo menos o role minimo exigido.
 * Hierarquia: admin > editor > viewer
 */
export async function requireRole(
  supabase: SupabaseClient,
  userId: string,
  minRole: UserRole
): Promise<boolean> {
  const role = await getUserRole(supabase, userId)
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole]
}
