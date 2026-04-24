import { createServerSupabaseClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export interface ActivityLogRow {
  id: string
  user_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export async function getAdActivityHistory(
  adId: string,
  limit = 50
): Promise<ActivityLogRow[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, user_email, action, entity_type, entity_id, details, created_at')
    .eq('entity_type', 'ad')
    .eq('entity_id', adId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    logger.warn('Falha ao ler activity_log', 'ActivityLog', {
      adId,
      error: error.message,
    })
    return []
  }
  return (data ?? []) as ActivityLogRow[]
}
