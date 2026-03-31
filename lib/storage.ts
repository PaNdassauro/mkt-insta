import { createServerSupabaseClient } from './supabase'
import { logger } from '@/lib/logger'

const BUCKET = 'story-media'

/**
 * Faz download de uma URL e salva no Supabase Storage.
 * Retorna a URL publica persistente ou null se falhar.
 */
async function uploadToStorage(
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
      .from(BUCKET)
      .upload(filePath, blob, { contentType, upsert: true })

    if (error) {
      logger.error(`Upload error (${filePath})`, 'Storage', { message: error.message })
      return null
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    return data.publicUrl
  } catch (err) {
    logger.error(`Persist error (${filePath})`, 'Storage', { error: err as Error })
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
  return uploadToStorage(imageUrl, `thumbs/${mediaId}.jpg`, 'image/jpeg')
}

/**
 * Salva video de um story no Storage.
 */
export async function persistStoryVideo(
  videoUrl: string,
  mediaId: string,
): Promise<string | null> {
  return uploadToStorage(videoUrl, `videos/${mediaId}.mp4`, 'video/mp4')
}
