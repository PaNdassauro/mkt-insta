// Cron schedule: 0 11 * * 1 (Monday 8am BRT / 11:00 UTC)
// Syncs public profile data for all tracked competitors via Business Discovery API.

import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken } from '@/lib/meta-client'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { META_API_BASE_URL } from '@/lib/constants'
import { alertCompetitorGrowth } from '@/lib/telegram'

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()
  const token = await getAccessToken()
  const userId = process.env.META_IG_USER_ID ?? 'me'
  const today = new Date().toISOString().split('T')[0]

  // Buscar todos os concorrentes ativos
  const { data: competitors, error: fetchError } = await supabase
    .from('instagram_competitors')
    .select('id, username, ig_user_id')

  if (fetchError) throw new Error(fetchError.message)

  if (!competitors || competitors.length === 0) {
    return apiSuccess({ synced: 0, total: 0, message: 'Nenhum concorrente cadastrado' })
  }

  let synced = 0
  let skipped = 0

  for (const comp of competitors) {
    try {
      // Usar Business Discovery API — funciona com username, nao precisa de ig_user_id
      const fields = 'username,name,followers_count,media_count,biography,profile_picture_url,ig_id'
      const res = await fetch(
        `${META_API_BASE_URL}/${userId}?fields=business_discovery.fields(${fields})&business_discovery.username=${comp.username}&access_token=${token}`
      )

      if (!res.ok) {
        const body = await res.text()
        logger.warn(`Business Discovery failed for @${comp.username}`, 'Sync Competitors', { status: res.status, body })
        skipped++
        continue
      }

      const data = await res.json()
      const biz = data.business_discovery

      if (!biz) {
        logger.warn(`No business_discovery data for @${comp.username}`, 'Sync Competitors')
        skipped++
        continue
      }

      // Atualizar ig_user_id e display_name se nao existiam
      const updates: Record<string, string | null> = {}
      if (!comp.ig_user_id && biz.ig_id) updates.ig_user_id = String(biz.ig_id)
      if (biz.name) updates.display_name = biz.name
      if (Object.keys(updates).length > 0) {
        await supabase.from('instagram_competitors').update(updates).eq('id', comp.id)
      }

      // Upsert snapshot
      await supabase.from('instagram_competitor_snapshots').upsert(
        {
          competitor_id: comp.id,
          date: today,
          followers_count: biz.followers_count ?? null,
          media_count: biz.media_count ?? null,
        },
        { onConflict: 'competitor_id,date' }
      )

      // Check for rapid follower growth (>5% in 7 days) — alert via Telegram
      try {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

        const { data: prevSnapshot } = await supabase
          .from('instagram_competitor_snapshots')
          .select('followers_count')
          .eq('competitor_id', comp.id)
          .lte('date', sevenDaysAgoStr)
          .order('date', { ascending: false })
          .limit(1)
          .single()

        if (prevSnapshot?.followers_count && biz.followers_count) {
          const growthPct = ((biz.followers_count - prevSnapshot.followers_count) / prevSnapshot.followers_count) * 100
          if (growthPct > 5) {
            logger.info(`Competitor @${comp.username} grew ${growthPct.toFixed(1)}% in 7 days`, 'Sync Competitors')
            await alertCompetitorGrowth(comp.username, biz.followers_count, growthPct)
          }
        }
      } catch {
        // Non-critical — skip alert if previous snapshot not found
      }

      logger.info(`Synced @${comp.username}: ${biz.followers_count} followers`, 'Sync Competitors')
      synced++
    } catch (err) {
      logger.error(`Error syncing @${comp.username}`, 'Sync Competitors', { error: err as Error })
      skipped++
    }
  }

  return apiSuccess({ synced, skipped, total: competitors.length, date: today })
}, 'Sync Competitors')
