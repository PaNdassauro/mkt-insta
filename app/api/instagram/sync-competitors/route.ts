// Cron schedule: 0 11 * * 1 (Monday 8am BRT / 11:00 UTC)
// Syncs public profile data for all tracked competitors via Meta Graph API.

import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken } from '@/lib/meta-client'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, getErrorMessage, withErrorHandler } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { META_API_BASE_URL } from '@/lib/constants'

interface CompetitorRow {
  id: string
  username: string
  ig_user_id: string | null
}

interface CompetitorProfileResponse {
  id: string
  username?: string
  followers_count?: number
  media_count?: number
  biography?: string
  profile_picture_url?: string
}

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()
  const token = await getAccessToken()
  const today = new Date().toISOString().split('T')[0]

  // Fetch all competitors that have an ig_user_id
  const { data: competitors, error: fetchError } = await supabase
    .from('instagram_competitors')
    .select('id, username, ig_user_id')
    .not('ig_user_id', 'is', null)

  if (fetchError) throw new Error(fetchError.message)

  const rows = (competitors ?? []) as CompetitorRow[]

  if (rows.length === 0) {
    logger.info('No competitors with ig_user_id to sync', 'DashIG Sync Competitors')
    return apiSuccess({ synced: 0, skipped: 0, message: 'No competitors with ig_user_id' })
  }

  let synced = 0
  let skipped = 0
  const errors: string[] = []

  for (const comp of rows) {
    try {
      const url = `${META_API_BASE_URL}/${comp.ig_user_id}?fields=followers_count,media_count,biography,username,profile_picture_url&access_token=${token}`
      const res = await fetch(url)

      if (!res.ok) {
        const body = await res.text()
        logger.warn(`Failed to fetch profile for @${comp.username}`, 'DashIG Sync Competitors', {
          status: res.status,
          body,
        })
        errors.push(`@${comp.username}: HTTP ${res.status}`)
        skipped++
        continue
      }

      const profile = (await res.json()) as CompetitorProfileResponse

      // Upsert snapshot for today (unique on competitor_id + date)
      const { error: upsertError } = await supabase
        .from('instagram_competitor_snapshots')
        .upsert(
          {
            competitor_id: comp.id,
            date: today,
            followers_count: profile.followers_count ?? null,
            media_count: profile.media_count ?? null,
          },
          { onConflict: 'competitor_id,date' }
        )

      if (upsertError) {
        logger.error(`Upsert failed for @${comp.username}`, 'DashIG Sync Competitors', {
          error: upsertError as unknown as Error,
        })
        errors.push(`@${comp.username}: ${upsertError.message}`)
        skipped++
        continue
      }

      logger.info(`Synced @${comp.username}: ${profile.followers_count} followers`, 'DashIG Sync Competitors')
      synced++
    } catch (err) {
      logger.error(`Error syncing @${comp.username}`, 'DashIG Sync Competitors', {
        error: err as Error,
      })
      errors.push(`@${comp.username}: ${getErrorMessage(err)}`)
      skipped++
    }
  }

  logger.info(`Competitor sync complete: ${synced} synced, ${skipped} skipped`, 'DashIG Sync Competitors')

  return apiSuccess({
    synced,
    skipped,
    total: rows.length,
    date: today,
    ...(errors.length > 0 ? { errors } : {}),
  })
}, 'DashIG Sync Competitors')
