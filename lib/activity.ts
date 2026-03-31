import { createServerSupabaseClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

interface LogActivityParams {
  userId?: string
  userEmail?: string
  action: string
  entityType?: string
  entityId?: string
  details?: Record<string, unknown>
}

/**
 * Registra uma atividade no log.
 * Nao lanca erro em caso de falha — apenas emite warning no logger.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const supabase = createServerSupabaseClient()

    const { error } = await supabase.from('activity_log').insert({
      user_id: params.userId ?? null,
      user_email: params.userEmail ?? null,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      details: params.details ?? null,
    })

    if (error) {
      logger.warn('Falha ao registrar atividade', 'ActivityLog', {
        action: params.action,
        error: error.message,
      })
    }
  } catch (err) {
    logger.warn('Erro inesperado ao registrar atividade', 'ActivityLog', {
      action: params.action,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
