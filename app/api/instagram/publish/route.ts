import { validateDashboardRequest } from '@/lib/auth'
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

export const dynamic = "force-dynamic"

/**
 * POST /api/instagram/publish
 * Publica um post do calendario editorial no Instagram.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  const body = await request.json()
  const { calendarEntryId } = body

  if (!calendarEntryId) {
    return apiError('calendarEntryId is required', 400)
  }

  const supabase = createServerSupabaseClient()
  const userId = process.env.META_IG_USER_ID
  if (!userId) {
    return apiError('META_IG_USER_ID not configured', 500)
  }

  // Buscar entrada do calendario
  const { data: entry, error: fetchErr } = await supabase
    .from('instagram_editorial_calendar')
    .select('*')
    .eq('id', calendarEntryId)
    .single()

  if (fetchErr || !entry) {
    return apiError('Entrada nao encontrada', 404)
  }

  if (entry.status !== 'APPROVED') {
    return apiError('Apenas entradas com status APPROVED podem ser publicadas', 400)
  }

  if (entry.published_media_id) {
    return apiError('Esta entrada ja foi publicada', 400)
  }

  // Verificar se tem media
  const isCarousel = entry.content_type === 'CAROUSEL' && entry.carousel_urls?.length > 0
  const hasMedia = entry.media_url || isCarousel

  if (!hasMedia) {
    return apiError('Adicione uma URL de midia antes de publicar', 400)
  }

  const token = await getAccessToken()

  // Montar caption completa
  const captionParts: string[] = []
  if (entry.caption_draft) captionParts.push(entry.caption_draft)
  if (entry.hashtags_plan?.length) {
    captionParts.push(entry.hashtags_plan.join(' '))
  }
  const caption = captionParts.join('\n\n')

  let publishedMediaId: string

  // Params comuns
  const commonParams = {
    locationId: entry.location_id ?? undefined,
    userTags: entry.user_tags ?? undefined,
    altText: entry.alt_text ?? undefined,
    collaborators: entry.collaborators ?? undefined,
  }

  try {
    if (isCarousel) {
      // Carousel: criar containers filhos + container pai + publicar
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
      // Reel: criar container + poll + publicar
      const containerId = await createMediaContainer(token, userId, {
        mediaType: 'REELS',
        videoUrl: entry.media_url,
        caption,
        locationId: commonParams.locationId,
        collaborators: commonParams.collaborators,
        coverUrl: entry.cover_url ?? undefined,
      })

      const status = await pollContainerStatus(token, containerId)
      if (status === 'ERROR') {
        throw new Error('Video processing failed on Meta servers')
      }

      publishedMediaId = await publishMedia(token, userId, containerId)
    } else {
      // Image: criar container + poll + publicar
      const containerId = await createMediaContainer(token, userId, {
        mediaType: 'IMAGE',
        imageUrl: entry.media_url,
        caption,
        ...commonParams,
      })

      const imgStatus = await pollContainerStatus(token, containerId, 10, 3000)
      if (imgStatus === 'ERROR') {
        throw new Error('Image processing failed on Meta servers')
      }

      publishedMediaId = await publishMedia(token, userId, containerId)
    }

    // Sucesso — atualizar calendario
    const publishedAt = new Date().toISOString()
    await supabase
      .from('instagram_editorial_calendar')
      .update({
        status: 'PUBLISHED',
        published_media_id: publishedMediaId,
        published_at: publishedAt,
        publish_error: null,
      })
      .eq('id', calendarEntryId)

    logger.info('Post publicado com sucesso', 'Publish', {
      calendarEntryId,
      mediaId: publishedMediaId,
      contentType: entry.content_type,
    })

    await logActivity({
      action: 'instagram.publish',
      entityType: 'calendar_entry',
      entityId: calendarEntryId,
      details: {
        mediaId: publishedMediaId,
        contentType: entry.content_type,
        topic: entry.topic,
        publishedAt,
      },
    })

    return apiSuccess({ success: true, mediaId: publishedMediaId })
  } catch (publishErr) {
    // Erro de publicacao — salvar erro mas manter APPROVED para retry
    const errorMsg = getErrorMessage(publishErr)
    await supabase
      .from('instagram_editorial_calendar')
      .update({ publish_error: errorMsg })
      .eq('id', calendarEntryId)

    logger.error('Falha ao publicar post', 'Publish', {
      calendarEntryId,
      contentType: entry.content_type,
      error: errorMsg,
    })

    await logActivity({
      action: 'instagram.publish_error',
      entityType: 'calendar_entry',
      entityId: calendarEntryId,
      details: {
        contentType: entry.content_type,
        topic: entry.topic,
        error: errorMsg,
      },
    })

    return apiError(errorMsg)
  }
}, 'Publish')
