import { createServerSupabaseClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getAccessToken, getAudienceInsights } from '@/lib/meta-client'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'

export const dynamic = "force-dynamic"

interface SyncAccount {
  id: string
  ig_user_id: string
}

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()

  // Multi-account: buscar todas as contas ativas
  // Se X-Account-Id presente, sincronizar apenas essa conta
  const singleAccountId = request.headers.get('x-account-id')

  let accountQuery = supabase
    .from('instagram_accounts')
    .select('id, ig_user_id, access_token')
    .eq('is_active', true)

  if (singleAccountId) {
    accountQuery = accountQuery.eq('id', singleAccountId)
  }

  const { data: activeAccounts } = await accountQuery

  const validAccounts = (activeAccounts ?? []).filter(
    (a) => a.access_token && a.access_token !== 'pending_manual_update'
  )

  const accounts: SyncAccount[] = []
  if (validAccounts.length > 0) {
    accounts.push(...validAccounts.map((a) => ({ id: a.id, ig_user_id: a.ig_user_id })))
  } else {
    const envUserId = process.env.META_IG_USER_ID
    if (!envUserId) {
      return apiError('No active accounts and META_IG_USER_ID not configured', 500)
    }
    accounts.push({ id: '', ig_user_id: envUserId })
  }

  const useMultiAccount = accounts.length > 0 && accounts[0].id !== ''

  let totalCities = 0
  let totalCountries = 0
  const accountsSynced: string[] = []

  // Calcular inicio da semana (segunda-feira)
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0]

  for (const account of accounts) {
    const accountLabel = useMultiAccount ? ` [${account.ig_user_id}]` : ''

    try {
      const token = useMultiAccount
        ? await getAccessToken(account.id)
        : await getAccessToken()
      const audience = await getAudienceInsights(token, account.ig_user_id)

      // Processar age/gender
      const ageRanges: Record<string, number> = {}
      const gender: Record<string, number> = { M: 0, F: 0 }
      for (const [key, value] of Object.entries(audience.age_gender)) {
        const [g, ageRange] = key.split('.')
        if (ageRange) {
          ageRanges[ageRange] = (ageRanges[ageRange] ?? 0) + value
        }
        if (g === 'M' || g === 'F') {
          gender[g] += value
        }
      }

      // Top cities
      const totalCityFollowers = Object.values(audience.cities).reduce((s, v) => s + v, 0)
      const topCities = Object.entries(audience.cities)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([city, count]) => ({
          city,
          pct: totalCityFollowers > 0 ? Number(((count / totalCityFollowers) * 100).toFixed(1)) : 0,
        }))

      // Top countries
      const totalCountryFollowers = Object.values(audience.countries).reduce((s, v) => s + v, 0)
      const topCountries = Object.entries(audience.countries)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([country, count]) => ({
          country,
          pct: totalCountryFollowers > 0 ? Number(((count / totalCountryFollowers) * 100).toFixed(1)) : 0,
        }))

      // Build query with optional account_id filter
      let existingQuery = supabase
        .from('instagram_audience_snapshots')
        .select('id')
        .eq('week_start', weekStart)

      if (useMultiAccount) {
        existingQuery = existingQuery.eq('account_id', account.id)
      }

      const { data: existing } = await existingQuery.limit(1).single()

      const payload: Record<string, unknown> = {
        week_start: weekStart,
        age_ranges: ageRanges,
        gender,
        top_cities: topCities,
        top_countries: topCountries,
        active_hours: audience.online_followers,
        active_days: null,
      }
      if (useMultiAccount) {
        payload.account_id = account.id
      }

      let error
      if (existing) {
        const res = await supabase
          .from('instagram_audience_snapshots')
          .update(payload)
          .eq('id', existing.id)
        error = res.error
      } else {
        const res = await supabase
          .from('instagram_audience_snapshots')
          .insert(payload)
        error = res.error
      }

      if (error) throw new Error(error.message)

      totalCities += topCities.length
      totalCountries += topCountries.length
      accountsSynced.push(account.ig_user_id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Audience sync failed${accountLabel}: ${message}`, 'DashIG Sync Audience')
    }
  }

  if (accountsSynced.length === 0) {
    return apiError('Audience sync failed for all accounts', 500)
  }

  return apiSuccess({
    success: true,
    week_start: weekStart,
    accounts_synced: accountsSynced.length,
    cities: totalCities,
    countries: totalCountries,
  })
}, 'DashIG Sync Audience')
