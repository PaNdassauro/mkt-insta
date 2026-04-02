import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = "force-dynamic"

const LOG_CTX = 'Accounts API'

/**
 * GET /api/settings/accounts
 * Lista todas as contas Instagram cadastradas.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('instagram_accounts')
      .select('id, ig_user_id, username, token_expires_at, label, is_active, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('Failed to list accounts', LOG_CTX, { error: error as unknown as Error })
      return apiError('Erro ao listar contas')
    }

    return apiSuccess(data)
  } catch (err) {
    logger.error('List accounts error', LOG_CTX, { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * POST /api/settings/accounts
 * Adiciona uma nova conta Instagram.
 * Body: { ig_user_id: string, access_token: string, label: string, username?: string }
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { ig_user_id, access_token, label, username } = body as {
      ig_user_id?: string
      access_token?: string
      label?: string
      username?: string
    }

    if (!ig_user_id || !access_token || !label) {
      return apiError('ig_user_id, access_token e label sao obrigatorios', 400)
    }

    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('instagram_accounts')
      .insert({
        ig_user_id,
        access_token,
        label,
        username: username ?? null,
      })
      .select('id, ig_user_id, username, label, is_active, created_at')
      .single()

    if (error) {
      logger.error('Failed to add account', LOG_CTX, { error: error as unknown as Error })
      if (error.code === '23505') {
        return apiError('Conta com esse ig_user_id ja existe', 409)
      }
      return apiError('Erro ao adicionar conta')
    }

    logger.info('Account added', LOG_CTX, { ig_user_id, label })

    return apiSuccess(data, 201)
  } catch (err) {
    logger.error('Add account error', LOG_CTX, { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * PATCH /api/settings/accounts
 * Atualiza uma conta Instagram existente.
 * Body: { id: string, access_token?: string, label?: string, is_active?: boolean, username?: string, token_expires_at?: string }
 */
export async function PATCH(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, ...updates } = body as {
      id?: string
      access_token?: string
      label?: string
      is_active?: boolean
      username?: string
      token_expires_at?: string
    }

    if (!id) {
      return apiError('id e obrigatorio', 400)
    }

    // Filtrar apenas campos permitidos
    const allowedFields: Record<string, unknown> = {}
    if (updates.access_token !== undefined) allowedFields.access_token = updates.access_token
    if (updates.label !== undefined) allowedFields.label = updates.label
    if (updates.is_active !== undefined) allowedFields.is_active = updates.is_active
    if (updates.username !== undefined) allowedFields.username = updates.username
    if (updates.token_expires_at !== undefined) allowedFields.token_expires_at = updates.token_expires_at

    if (Object.keys(allowedFields).length === 0) {
      return apiError('Nenhum campo para atualizar', 400)
    }

    allowedFields.updated_at = new Date().toISOString()

    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('instagram_accounts')
      .update(allowedFields)
      .eq('id', id)
      .select('id, ig_user_id, username, label, is_active, updated_at')
      .single()

    if (error) {
      logger.error('Failed to update account', LOG_CTX, { error: error as unknown as Error })
      return apiError('Erro ao atualizar conta')
    }

    if (!data) {
      return apiError('Conta nao encontrada', 404)
    }

    logger.info('Account updated', LOG_CTX, { id, fields: Object.keys(allowedFields) })

    return apiSuccess(data)
  } catch (err) {
    logger.error('Update account error', LOG_CTX, { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * DELETE /api/settings/accounts
 * Desativa uma conta Instagram (soft delete via is_active=false).
 * Body: { id: string }
 */
export async function DELETE(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { id } = body as { id?: string }

    if (!id) {
      return apiError('id e obrigatorio', 400)
    }

    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('instagram_accounts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, ig_user_id, label, is_active')
      .single()

    if (error) {
      logger.error('Failed to deactivate account', LOG_CTX, { error: error as unknown as Error })
      return apiError('Erro ao desativar conta')
    }

    if (!data) {
      return apiError('Conta nao encontrada', 404)
    }

    logger.info('Account deactivated', LOG_CTX, { id })

    return apiSuccess({ deactivated: true, ...data })
  } catch (err) {
    logger.error('Deactivate account error', LOG_CTX, { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
