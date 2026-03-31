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

export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()
  const userId = process.env.META_IG_USER_ID
  if (!userId) {
    return apiError('META_IG_USER_ID not configured', 500)
  }

  const token = await getAccessToken()
  const stories = await getActiveStories(token, userId)
  let syncedCount = 0
  let thumbsStored = 0
  let videosStored = 0

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
        if (storedMediaUrl) thumbsStored++
      }
    }

    // Persistir video (se aplicavel)
    let storedVideoUrl = existing?.stored_video_url ?? null
    if (!storedVideoUrl && isVideo && story.media_url) {
      storedVideoUrl = await persistStoryVideo(story.media_url, story.id)
      if (storedVideoUrl) videosStored++
    }

    const { error } = await supabase.from('instagram_stories').upsert(
      {
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
      },
      { onConflict: 'media_id' }
    )

    if (error) {
      logger.error(`Story upsert error (${story.id})`, 'DashIG Sync Stories', { message: error.message })
    } else {
      syncedCount++
    }
  }

  return apiSuccess({
    success: true,
    stories_synced: syncedCount,
    thumbs_stored: thumbsStored,
    videos_stored: videosStored,
    total_active: stories.length,
  })
}, 'DashIG Sync Stories')
