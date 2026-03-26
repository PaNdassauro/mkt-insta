import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import {
  getAccessToken,
  createMediaContainer,
  pollContainerStatus,
  publishMedia,
} from '@/lib/meta-client'

/**
 * POST /api/instagram/publish
 * Publica um post do calendario editorial no Instagram.
 * Fluxo: create container -> poll status (videos) -> publish
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { calendarEntryId } = body

    if (!calendarEntryId) {
      return NextResponse.json({ error: 'calendarEntryId is required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const userId = process.env.META_IG_USER_ID
    if (!userId) {
      return NextResponse.json({ error: 'META_IG_USER_ID not configured' }, { status: 500 })
    }

    // Buscar entrada do calendario
    const { data: entry, error: fetchErr } = await supabase
      .from('instagram_editorial_calendar')
      .select('*')
      .eq('id', calendarEntryId)
      .single()

    if (fetchErr || !entry) {
      return NextResponse.json({ error: 'Entrada nao encontrada' }, { status: 404 })
    }

    if (entry.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Apenas entradas com status APPROVED podem ser publicadas' },
        { status: 400 }
      )
    }

    if (entry.published_media_id) {
      return NextResponse.json(
        { error: 'Esta entrada ja foi publicada', mediaId: entry.published_media_id },
        { status: 400 }
      )
    }

    // Verificar se tem media
    const isCarousel = entry.content_type === 'CAROUSEL' && entry.carousel_urls?.length > 0
    const hasMedia = entry.media_url || isCarousel

    if (!hasMedia) {
      return NextResponse.json(
        { error: 'Adicione uma URL de midia antes de publicar' },
        { status: 400 }
      )
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

    try {
      if (isCarousel) {
        // Carousel: criar containers filhos + container pai + publicar
        const childIds: string[] = []
        for (const url of entry.carousel_urls) {
          const childId = await createMediaContainer(token, userId, {
            mediaType: 'CAROUSEL',
            imageUrl: url,
            isCarouselItem: true,
          })
          childIds.push(childId)
        }

        const parentId = await createMediaContainer(token, userId, {
          mediaType: 'CAROUSEL',
          caption,
          carouselItemIds: childIds,
        })

        publishedMediaId = await publishMedia(token, userId, parentId)
      } else if (entry.content_type === 'REEL') {
        // Reel: criar container + poll + publicar
        const containerId = await createMediaContainer(token, userId, {
          mediaType: 'REELS',
          videoUrl: entry.media_url,
          caption,
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
        })

        const imgStatus = await pollContainerStatus(token, containerId, 10, 3000)
        if (imgStatus === 'ERROR') {
          throw new Error('Image processing failed on Meta servers')
        }

        publishedMediaId = await publishMedia(token, userId, containerId)
      }

      // Sucesso — atualizar calendario
      await supabase
        .from('instagram_editorial_calendar')
        .update({
          status: 'PUBLISHED',
          published_media_id: publishedMediaId,
          published_at: new Date().toISOString(),
          publish_error: null,
        })
        .eq('id', calendarEntryId)

      return NextResponse.json({ success: true, mediaId: publishedMediaId })
    } catch (publishErr) {
      // Erro de publicacao — salvar erro mas manter APPROVED para retry
      const errorMsg = publishErr instanceof Error ? publishErr.message : 'Erro desconhecido'
      await supabase
        .from('instagram_editorial_calendar')
        .update({ publish_error: errorMsg })
        .eq('id', calendarEntryId)

      return NextResponse.json({ error: errorMsg }, { status: 500 })
    }
  } catch (err) {
    console.error('[Publish]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
