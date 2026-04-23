import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { getAccessToken } from '@/lib/meta-client'
import { META_API_BASE_URL } from '@/lib/constants'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/instagram/meta-targeting/search?type=interests|cities|regions&q=<query>
 *
 * Proxy para o endpoint /search da Marketing API — usado pelos autocompletes
 * de interesses + cidades + estados no modal de Impulsionar.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const q = (searchParams.get('q') ?? '').trim()

    if (!type || !['interests', 'cities', 'regions'].includes(type)) {
      return apiError('type deve ser: interests | cities | regions', 400)
    }
    if (!q || q.length < 2) {
      return apiSuccess({ data: [] })
    }

    const token = await getAccessToken()

    const url = new URL(`${META_API_BASE_URL}/search`)
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '15')
    url.searchParams.set('access_token', token)

    if (type === 'interests') {
      url.searchParams.set('type', 'adinterest')
    } else if (type === 'cities') {
      url.searchParams.set('type', 'adgeolocation')
      url.searchParams.set('location_types', JSON.stringify(['city']))
    } else {
      url.searchParams.set('type', 'adgeolocation')
      url.searchParams.set('location_types', JSON.stringify(['region']))
    }

    const res = await fetch(url.toString())
    const text = await res.text()
    if (!res.ok) {
      logger.warn('Meta search failed', 'Targeting', { status: res.status, body: text.slice(0, 300) })
      return apiError(`Meta search ${res.status}: ${text.slice(0, 200)}`, res.status)
    }

    const body = JSON.parse(text) as {
      data: Array<Record<string, unknown>>
    }

    if (type === 'interests') {
      const items = (body.data ?? []).map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        audienceSize: typeof item.audience_size_lower_bound === 'number'
          ? item.audience_size_lower_bound
          : null,
        path: Array.isArray(item.path) ? (item.path as string[]) : [],
      }))
      return apiSuccess({ data: items }, 200, 3600)
    }

    // geo
    const items = (body.data ?? []).map((item) => ({
      key: String(item.key ?? ''),
      name: String(item.name ?? ''),
      type: String(item.type ?? ''),
      countryCode: String(item.country_code ?? ''),
      region: item.region ? String(item.region) : null,
      supportsCity: item.supports_city ?? true,
      supportsRegion: item.supports_region ?? true,
    }))
    return apiSuccess({ data: items }, 200, 3600)
  } catch (err) {
    logger.error('targeting search failed', 'Targeting', { error: err as Error })
    return apiError(getErrorMessage(err), 500)
  }
}
