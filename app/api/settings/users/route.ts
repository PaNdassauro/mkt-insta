import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient, createServerComponentClient } from '@/lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'

export const dynamic = "force-dynamic"

const LOG_CTX = 'Users API'

/**
 * Verifica se o usuario autenticado e admin.
 * Retorna o userId se for admin, ou null caso contrario.
 */
async function requireAdmin(): Promise<{ userId: string } | null> {
  try {
    const supabase = await createServerComponentClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const adminSupabase = createServerSupabaseClient()
    const isAdmin = await getUserRole(adminSupabase, user.id) === 'admin'
    if (!isAdmin) return null

    return { userId: user.id }
  } catch {
    return null
  }
}

/**
 * GET /api/settings/users
 * Lista todos os usuarios com seus roles.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const admin = await requireAdmin()
  if (!admin) return apiError('Acesso restrito a administradores', 403)

  try {
    const supabase = createServerSupabaseClient()

    // Listar usuarios via admin API
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) {
      logger.error('Failed to list users', LOG_CTX, { error: usersError as unknown as Error })
      return apiError('Erro ao listar usuarios')
    }

    // Buscar roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')

    const rolesMap = new Map<string, UserRole>()
    if (roles) {
      for (const r of roles) {
        rolesMap.set(r.user_id, r.role as UserRole)
      }
    }

    const result = users.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: rolesMap.get(u.id) ?? 'viewer',
      created_at: u.created_at,
    }))

    return apiSuccess(result)
  } catch (err) {
    logger.error('List users error', LOG_CTX, { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * POST /api/settings/users
 * Convida um novo usuario (cria via admin API + atribui role).
 * Body: { email: string, role: UserRole }
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const admin = await requireAdmin()
  if (!admin) return apiError('Acesso restrito a administradores', 403)

  try {
    const body = await request.json()
    const { email, role } = body as { email?: string; role?: UserRole }

    if (!email || !role) {
      return apiError('Email e role sao obrigatorios', 400)
    }

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return apiError('Role invalido. Use: admin, editor ou viewer', 400)
    }

    const supabase = createServerSupabaseClient()

    // Criar usuario via Supabase Auth admin API (invite)
    const { data: newUser, error: createError } = await supabase.auth.admin.inviteUserByEmail(email)

    if (createError) {
      logger.error('Failed to invite user', LOG_CTX, { error: createError as unknown as Error })
      return apiError(`Erro ao convidar usuario: ${createError.message}`, 400)
    }

    if (!newUser?.user) {
      return apiError('Erro ao criar usuario')
    }

    // Atribuir role
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: newUser.user.id,
        role,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (roleError) {
      logger.error('Failed to assign role', LOG_CTX, { error: roleError as unknown as Error })
      return apiError('Usuario criado mas erro ao atribuir role')
    }

    logger.info('User invited', LOG_CTX, { email, role })

    return apiSuccess({
      id: newUser.user.id,
      email,
      role,
      created_at: newUser.user.created_at,
    }, 201)
  } catch (err) {
    logger.error('Invite user error', LOG_CTX, { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * PATCH /api/settings/users
 * Atualiza o role de um usuario existente.
 * Body: { userId: string, role: UserRole }
 */
export async function PATCH(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const admin = await requireAdmin()
  if (!admin) return apiError('Acesso restrito a administradores', 403)

  try {
    const body = await request.json()
    const { userId, role } = body as { userId?: string; role?: UserRole }

    if (!userId || !role) {
      return apiError('userId e role sao obrigatorios', 400)
    }

    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return apiError('Role invalido. Use: admin, editor ou viewer', 400)
    }

    // Impedir que admin remova seu proprio role de admin
    if (userId === admin.userId && role !== 'admin') {
      return apiError('Voce nao pode remover seu proprio role de admin', 400)
    }

    const supabase = createServerSupabaseClient()

    const { error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      logger.error('Failed to update role', LOG_CTX, { error: error as unknown as Error })
      return apiError('Erro ao atualizar role')
    }

    logger.info('Role updated', LOG_CTX, { userId, role })

    return apiSuccess({ userId, role })
  } catch (err) {
    logger.error('Update role error', LOG_CTX, { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * DELETE /api/settings/users
 * Remove um usuario.
 * Body: { userId: string }
 */
export async function DELETE(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const admin = await requireAdmin()
  if (!admin) return apiError('Acesso restrito a administradores', 403)

  try {
    const body = await request.json()
    const { userId } = body as { userId?: string }

    if (!userId) {
      return apiError('userId e obrigatorio', 400)
    }

    // Impedir que admin delete a si mesmo
    if (userId === admin.userId) {
      return apiError('Voce nao pode deletar sua propria conta', 400)
    }

    const supabase = createServerSupabaseClient()

    // Remover role primeiro (CASCADE cuida disso, mas fazemos explicitamente)
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    // Remover usuario via admin API
    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
      logger.error('Failed to delete user', LOG_CTX, { error: error as unknown as Error })
      return apiError(`Erro ao remover usuario: ${error.message}`)
    }

    logger.info('User deleted', LOG_CTX, { userId })

    return apiSuccess({ deleted: true })
  } catch (err) {
    logger.error('Delete user error', LOG_CTX, { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
