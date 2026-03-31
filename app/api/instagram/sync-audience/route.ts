import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken, getAudienceInsights } from '@/lib/meta-client'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()
  const userId = process.env.META_IG_USER_ID
  if (!userId) {
    return apiError('META_IG_USER_ID not configured', 500)
  }

  const token = await getAccessToken()
  const audience = await getAudienceInsights(token, userId)

  // Calcular inicio da semana (segunda-feira)
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0]

  // Processar age/gender
  const ageRanges: Record<string, number> = {}
  const gender: Record<string, number> = { M: 0, F: 0 }
  for (const [key, value] of Object.entries(audience.age_gender)) {
    // Keys format: "M.25-34", "F.18-24"
    const [g, ageRange] = key.split('.')
    if (ageRange) {
      ageRanges[ageRange] = (ageRanges[ageRange] ?? 0) + value
    }
    if (g === 'M' || g === 'F') {
      gender[g] += value
    }
  }

  // Top cities — API retorna numeros absolutos, converter para %
  const totalCityFollowers = Object.values(audience.cities).reduce((s, v) => s + v, 0)
  const topCities = Object.entries(audience.cities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([city, count]) => ({
      city,
      pct: totalCityFollowers > 0 ? Number(((count / totalCityFollowers) * 100).toFixed(1)) : 0,
    }))

  // Top countries — API retorna numeros absolutos, converter para %
  const totalCountryFollowers = Object.values(audience.countries).reduce((s, v) => s + v, 0)
  const topCountries = Object.entries(audience.countries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([country, count]) => ({
      country,
      pct: totalCountryFollowers > 0 ? Number(((count / totalCountryFollowers) * 100).toFixed(1)) : 0,
    }))

  // Verificar se ja existe snapshot desta semana
  const { data: existing } = await supabase
    .from('instagram_audience_snapshots')
    .select('id')
    .eq('week_start', weekStart)
    .limit(1)
    .single()

  const payload = {
    week_start: weekStart,
    age_ranges: ageRanges,
    gender,
    top_cities: topCities,
    top_countries: topCountries,
    active_hours: audience.online_followers,
    active_days: null,
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

  return apiSuccess({
    success: true,
    week_start: weekStart,
    cities: topCities.length,
    countries: topCountries.length,
  })
}, 'DashIG Sync Audience')
