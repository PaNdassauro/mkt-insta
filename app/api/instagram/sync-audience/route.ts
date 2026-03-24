import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken, getAudienceInsights } from '@/lib/meta-client'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const userId = process.env.META_IG_USER_ID
    if (!userId) {
      return NextResponse.json({ error: 'META_IG_USER_ID not configured' }, { status: 500 })
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

    // Top cities
    const topCities = Object.entries(audience.cities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([city, pct]) => ({ city, pct }))

    // Top countries
    const topCountries = Object.entries(audience.countries)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, pct]) => ({ country, pct }))

    const { error } = await supabase
      .from('instagram_audience_snapshots')
      .upsert(
        {
          week_start: weekStart,
          age_ranges: ageRanges,
          gender,
          top_cities: topCities,
          top_countries: topCountries,
          active_hours: audience.online_followers,
          active_days: null, // Calculado a partir de online_followers se necessario
        },
        { onConflict: 'week_start' }
      )

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      week_start: weekStart,
      cities: topCities.length,
      countries: topCountries.length,
    })
  } catch (err) {
    console.error('[DashIG Sync Audience] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
