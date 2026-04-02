import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateCronSecret } from '@/lib/auth'
import { apiSuccess, apiError, withErrorHandler } from '@/lib/api-response'
import {
  getAccessToken,
  getActiveStories,
  getStoryInsights,
} from '@/lib/meta-client'
import { persistStoryMedia, persistStoryVideo } from '@/lib/storage'

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
    .select('id, ig_user_id')
    .eq('is_active', true)

  if (singleAccountId) {
    accountQuery = accountQuery.eq('id', singleAccountId)
  }

  const { data: activeAccounts } = await accountQuery

  const accounts: SyncAccount[] = []
  if (activeAccounts && activeAccounts.length > 0) {
    accounts.push(...activeAccounts)
  } else {
    const envUserId = process.env.META_IG_USER_ID
    if (!envUserId) {
      return apiError('No active accounts and META_IG_USER_ID not configured', 500)
    }
    accounts.push({ id: '', ig_user_id: envUserId })
  }

  const useMultiAccount = accounts.length > 0 && accounts[0].id !== ''

  let totalSynced = 0
  let totalThumbs = 0
  let totalVideos = 0
  let totalActive = 0

  for (const account of accounts) {
    const accountLabel = useMultiAccount ? ` [${account.ig_user_id}]` : ''

    const token = useMultiAccount
      ? await getAccessToken(account.id)
      : await getAccessToken()
    const stories = await getActiveStories(token, account.ig_user_id)
    totalActive += stories.length

    for (const story of stories) {
      const insights = await getStoryInsights(token, story.id)

      const expiresAt = new Date(
        new Date(story.timestamp).getTime() + 24 * 60 * 60 * 1000
      ).toISOString()

      const isVideo = story.media_type === 'VIDEO'

      // Verificar o que ja foi salvo
      const { data: existing } = await supabase
        .from('instagram_stories')
        .select('stored_media_url, stored_video_url')
        .eq('media_id', story.id)
        .single()

      // Persistir thumbnail (imagem)
      let storedMediaUrl = existing?.stored_media_url ?? null
      if (!storedMediaUrl) {
        const imageUrl = isVideo ? story.thumbnail_url : story.media_url
        if (imageUrl) {
          storedMediaUrl = await persistStoryMedia(imageUrl, story.id)
          if (storedMediaUrl) totalThumbs++
        }
      }

      // Persistir video (se aplicavel)
      let storedVideoUrl = existing?.stored_video_url ?? null
      if (!storedVideoUrl && isVideo && story.media_url) {
        storedVideoUrl = await persistStoryVideo(story.media_url, story.id)
        if (storedVideoUrl) totalVideos++
      }

      const storyPayload: Record<string, unknown> = {
        media_id: story.id,
        media_type: story.media_type ?? null,
        media_url: story.media_url ?? null,
        stored_media_url: storedMediaUrl,
        stored_video_url: storedVideoUrl,
        permalink: story.permalink ?? null,
        timestamp: story.timestamp,
        expires_at: expiresAt,
        reach: insights.reach,
        replies: insights.replies,
        navigation: insights.navigation,
        follows: insights.follows,
        profile_visits: insights.profile_visits,
        shares: insights.shares,
        total_interactions: insights.total_interactions,
        synced_at: new Date().toISOString(),
      }
      if (useMultiAccount) {
        storyPayload.account_id = account.id
      }

      const { error } = await supabase.from('instagram_stories').upsert(
        storyPayload,
        { onConflict: 'media_id' }
      )

      if (error) {
        logger.error(`Story upsert error (${story.id})${accountLabel}`, 'DashIG Sync Stories', { message: error.message })
      } else {
        totalSynced++
      }
    }
  }

  return apiSuccess({
    success: true,
    stories_synced: totalSynced,
    thumbs_stored: totalThumbs,
    videos_stored: totalVideos,
    total_active: totalActive,
  })
}, 'DashIG Sync Stories')
