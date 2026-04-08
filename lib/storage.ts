import { createServerSupabaseClient } from './supabase'
import { logger } from '@/lib/logger'

const STORY_BUCKET = 'story-media'
const POST_BUCKET = 'post-media'

/**
 * Faz download de uma URL e salva no Supabase Storage.
 * Retorna a URL publica persistente ou null se falhar.
 */
async function uploadToStorage(
  bucket: string,
  url: string,
  filePath: string,
  contentType: string
): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const blob = await response.blob()
    const supabase = createServerSupabaseClient()

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, { contentType, upsert: true })

    if (error) {
      logger.error(`Upload error (${bucket}/${filePath})`, 'Storage', { message: error.message })
      return null
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
    return data.publicUrl
  } catch (err) {
    logger.error(`Persist error (${bucket}/${filePath})`, 'Storage', { error: err as Error })
    return null
  }
}

/**
 * Salva thumbnail (imagem) de um story no Storage.
 */
export async function persistStoryMedia(
  imageUrl: string,
  mediaId: string,
): Promise<string | null> {
  return uploadToStorage(STORY_BUCKET, imageUrl, `thumbs/${mediaId}.jpg`, 'image/jpeg')
}

/**
 * Salva video de um story no Storage.
 */
export async function persistStoryVideo(
  videoUrl: string,
  mediaId: string,
): Promise<string | null> {
  return uploadToStorage(STORY_BUCKET, videoUrl, `videos/${mediaId}.mp4`, 'video/mp4')
}

/**
 * Salva thumbnail (imagem) de um post ou reel no Storage.
 * Retorna a URL publica persistente, ou null se o download/upload falhar.
 *
 * As URLs thumbnail_url do Instagram Graph API expiram em ~24h, entao
 * persistimos uma copia no Supabase Storage para uso continuo no dashboard.
 */
export async function persistPostMedia(
  imageUrl: string,
  mediaId: string,
): Promise<string | null> {
  return uploadToStorage(POST_BUCKET, imageUrl, `thumbs/${mediaId}.jpg`, 'image/jpeg')
}
