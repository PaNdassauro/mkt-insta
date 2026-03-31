import { validateCronSecret } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage, withErrorHandler } from '@/lib/api-response'
import {
  getAccessToken,
  createMediaContainer,
  pollContainerStatus,
  publishMedia,
} from '@/lib/meta-client'
import { logger } from '@/lib/logger'
import { logActivity } from '@/lib/activity'

/**
 * POST /api/instagram/auto-publish
 * Cron job que publica automaticamente posts agendados.
 * Publica entradas com auto_publish=true, status=APPROVED e scheduled_for <= agora.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateCronSecret(request)
  if (authError) return authError

  const supabase = createServerSupabaseClient()
  const userId = process.env.META_IG_USER_ID
  if (!userId) {
    return apiError('META_IG_USER_ID not configured', 500)
  }

  // Buscar entradas prontas para publicar
  const now = new Date().toISOString()
  const { data: entries, error: fetchErr } = await supabase
    .from('instagram_editorial_calendar')
    .select('*')
    .eq('status', 'APPROVED')
    .eq('auto_publish', true)
    .lte('scheduled_for', now)
    .is('published_media_id', null)
    .order('scheduled_for', { ascending: true })
    .limit(5) // Max 5 por execucao para nao estourar timeout

  if (fetchErr) {
    throw new Error(`Failed to fetch entries: ${fetchErr.message}`)
  }

  if (!entries || entries.length === 0) {
    return apiSuccess({ published: 0, message: 'Nenhum post para publicar' })
  }

  const token = await getAccessToken()
  const results: Array<{ id: string; status: string; mediaId?: string; error?: string }> = []

  for (const entry of entries) {
    const hasMedia = entry.media_url || (entry.carousel_urls?.length > 0)
    if (!hasMedia) {
      results.push({ id: entry.id, status: 'skipped', error: 'Sem URL de midia' })
      continue
    }

    // Montar caption
    const captionParts: string[] = []
    if (entry.caption_draft) captionParts.push(entry.caption_draft)
    if (entry.hashtags_plan?.length) {
      captionParts.push(entry.hashtags_plan.join(' '))
    }
    const caption = captionParts.join('\n\n')

    const commonParams = {
      locationId: entry.location_id ?? undefined,
      userTags: entry.user_tags ?? undefined,
      altText: entry.alt_text ?? undefined,
      collaborators: entry.collaborators ?? undefined,
    }

    try {
      let publishedMediaId: string
      const isCarousel = entry.content_type === 'CAROUSEL' && entry.carousel_urls?.length > 0

      if (isCarousel) {
        const childIds: string[] = []
        for (const url of entry.carousel_urls) {
          const childId = await createMediaContainer(token, userId, {
            mediaType: 'CAROUSEL',
            imageUrl: url,
            isCarouselItem: true,
            altText: commonParams.altText,
            userTags: commonParams.userTags,
          })
          childIds.push(childId)
        }
        const parentId = await createMediaContainer(token, userId, {
          mediaType: 'CAROUSEL',
          caption,
          carouselItemIds: childIds,
          locationId: commonParams.locationId,
          collaborators: commonParams.collaborators,
        })
        publishedMediaId = await publishMedia(token, userId, parentId)
      } else if (entry.content_type === 'REEL') {
        const containerId = await createMediaContainer(token, userId, {
          mediaType: 'REELS',
          videoUrl: entry.media_url,
          caption,
          locationId: commonParams.locationId,
          collaborators: commonParams.collaborators,
          coverUrl: entry.cover_url ?? undefined,
        })
        const status = await pollContainerStatus(token, containerId, 15, 5000)
        if (status === 'ERROR') throw new Error('Video processing failed')
        publishedMediaId = await publishMedia(token, userId, containerId)
      } else {
        const containerId = await createMediaContainer(token, userId, {
          mediaType: 'IMAGE',
          imageUrl: entry.media_url,
          caption,
          ...commonParams,
        })
        const imgStatus = await pollContainerStatus(token, containerId, 10, 3000)
        if (imgStatus === 'ERROR') throw new Error('Image processing failed')
        publishedMediaId = await publishMedia(token, userId, containerId)
      }

      const publishedAt = new Date().toISOString()
      await supabase
        .from('instagram_editorial_calendar')
        .update({
          status: 'PUBLISHED',
          published_media_id: publishedMediaId,
          published_at: publishedAt,
          publish_error: null,
        })
        .eq('id', entry.id)

      logger.info('Auto-publish: post publicado', 'Auto-Publish', {
        entryId: entry.id,
        mediaId: publishedMediaId,
        contentType: entry.content_type,
      })

      await logActivity({
        action: 'instagram.auto_publish',
        entityType: 'calendar_entry',
        entityId: entry.id,
        details: {
          mediaId: publishedMediaId,
          contentType: entry.content_type,
          topic: entry.topic,
          publishedAt,
        },
      })

      results.push({ id: entry.id, status: 'published', mediaId: publishedMediaId })
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      await supabase
        .from('instagram_editorial_calendar')
        .update({ publish_error: errorMsg })
        .eq('id', entry.id)

      logger.error('Auto-publish: falha ao publicar', 'Auto-Publish', {
        entryId: entry.id,
        contentType: entry.content_type,
        error: errorMsg,
      })

      await logActivity({
        action: 'instagram.auto_publish_error',
        entityType: 'calendar_entry',
        entityId: entry.id,
        details: {
          contentType: entry.content_type,
          topic: entry.topic,
          error: errorMsg,
        },
      })

      results.push({ id: entry.id, status: 'error', error: errorMsg })
    }
  }

  const published = results.filter(r => r.status === 'published').length
  return apiSuccess({ published, total: entries.length, results })
}, 'Auto-Publish')
