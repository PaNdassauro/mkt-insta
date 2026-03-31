import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'

/**
 * GET /api/instagram/comments/sentiment
 * Retorna distribuicao de sentimento agregada por semana (ultimos 3 meses).
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    // Agregacao por semana e sentimento nos ultimos 90 dias
    const since = new Date()
    since.setDate(since.getDate() - 90)

    let query = supabase
      .from('instagram_comments')
      .select('sentiment, timestamp')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: true })

    if (accountId) query = query.eq('account_id', accountId)

    const { data, error } = await query

    if (error) throw error

    // Agrupar por semana
    const weekMap = new Map<string, Record<string, number>>()

    for (const row of data ?? []) {
      const d = new Date(row.timestamp)
      // Inicio da semana (segunda-feira)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const weekStart = new Date(d.setDate(diff))
      const key = weekStart.toISOString().slice(0, 10)

      if (!weekMap.has(key)) {
        weekMap.set(key, { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, QUESTION: 0 })
      }
      const bucket = weekMap.get(key)!
      const sentiment = row.sentiment ?? 'NEUTRAL'
      bucket[sentiment] = (bucket[sentiment] ?? 0) + 1
    }

    // Converter para array ordenado
    const series = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, counts]) => ({ week, ...counts }))

    // Totais
    const totals = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, QUESTION: 0 }
    for (const row of data ?? []) {
      const s = row.sentiment ?? 'NEUTRAL'
      totals[s as keyof typeof totals] = (totals[s as keyof typeof totals] ?? 0) + 1
    }

    return apiSuccess({ series, totals })
  } catch (err) {
    logger.error('Sentiment aggregation error', 'Comments Sentiment', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
