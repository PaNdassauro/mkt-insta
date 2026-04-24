import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'
import {
  getAdMeta,
  getAdDailyInsights,
  getAdBreakdowns,
  type AdRow,
  type AdDailyPoint,
  type AdBreakdownRow,
} from '@/lib/meta-ads-client'
import { getAdActivityHistory, type ActivityLogRow } from '@/lib/activity-queries'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function defaultSince(until: string): string {
  // Last 30 days ending at `until` (inclusive).
  const end = new Date(`${until}T00:00:00Z`)
  if (!Number.isFinite(end.getTime())) return until
  const start = new Date(end.getTime() - 29 * 86_400_000)
  return start.toISOString().slice(0, 10)
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface AdDetailResponse {
  ad: AdRow
  daily: AdDailyPoint[]
  demographics: AdBreakdownRow[]
  platform: AdBreakdownRow[]
  history: ActivityLogRow[]
  meta: { partial: boolean; errors: string[]; since: string; until: string }
}

/**
 * GET /api/instagram/ads/{adId}?since=YYYY-MM-DD&until=YYYY-MM-DD
 *
 * Drill-down de um unico anuncio: metadata + insights diarios (time_increment=1)
 * + breakdowns por idade/genero e por plataforma + historico interno de status
 * (activity_log). Se since/until forem omitidos, usa os ultimos 30 dias.
 *
 * Response shape:
 *   { ad, daily, demographics, platform, history, meta: { partial, errors, since, until } }
 *
 * - 404 se o ad nao existir / token nao ter acesso (falha de getAdMeta).
 * - 200 com meta.partial=true se alguma das chamadas auxiliares falhar; a secao
 *   correspondente volta vazia.
 */
export const GET = withErrorHandler(async (
  request: Request,
  ctx: { params: Promise<{ adId: string }> }
) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const { adId } = await ctx.params
  if (!adId || !/^\d+$/.test(adId)) {
    return apiError('adId invalido', 400)
  }

  const { searchParams } = new URL(request.url)
  const rawSince = searchParams.get('since') ?? undefined
  const rawUntil = searchParams.get('until') ?? undefined

  if (rawSince && !DATE_RE.test(rawSince)) return apiError('since deve estar no formato YYYY-MM-DD', 400)
  if (rawUntil && !DATE_RE.test(rawUntil)) return apiError('until deve estar no formato YYYY-MM-DD', 400)

  const until = rawUntil ?? todayUtc()
  const since = rawSince ?? defaultSince(until)

  const accountId = (await resolveAccountId(request)) ?? undefined

  // Primeiro: o ad em si. Se isso falhar, 404 — nao faz sentido renderizar
  // breakdowns de um anuncio que nao existe.
  let ad: AdRow
  try {
    ad = await getAdMeta(adId, { since, until, accountId })
  } catch (err) {
    logger.warn('Ad drill-down: getAdMeta falhou', 'Meta Ads', {
      adId,
      error: err instanceof Error ? err.message : String(err),
    })
    return apiError('Anuncio nao encontrado ou sem acesso', 404)
  }

  // Em paralelo: daily, dois breakdowns, historico. Qualquer falha vira
  // secao vazia + meta.partial=true.
  const [dailyRes, demoRes, platformRes, historyRes] = await Promise.allSettled([
    getAdDailyInsights(adId, since, until, { accountId }),
    getAdBreakdowns(adId, since, until, 'age,gender', { accountId }),
    getAdBreakdowns(adId, since, until, 'publisher_platform', { accountId }),
    getAdActivityHistory(adId),
  ])

  const errors: string[] = []

  function unwrap<T>(
    res: PromiseSettledResult<T>,
    label: string,
    fallback: T
  ): T {
    if (res.status === 'fulfilled') return res.value
    const msg = res.reason instanceof Error ? res.reason.message : String(res.reason)
    errors.push(`${label}: ${msg}`)
    logger.warn(`Ad drill-down: ${label} falhou`, 'Meta Ads', { adId, error: msg })
    return fallback
  }

  const daily = unwrap(dailyRes, 'daily', [] as AdDailyPoint[])
  const demographics = unwrap(demoRes, 'demographics', [] as AdBreakdownRow[])
  const platform = unwrap(platformRes, 'platform', [] as AdBreakdownRow[])
  const history = unwrap(historyRes, 'history', [] as ActivityLogRow[])

  const body: AdDetailResponse = {
    ad,
    daily,
    demographics,
    platform,
    history,
    meta: {
      partial: errors.length > 0,
      errors,
      since,
      until,
    },
  }

  return apiSuccess(body, 200, 300)
}, 'DashIG Ads Drilldown')
