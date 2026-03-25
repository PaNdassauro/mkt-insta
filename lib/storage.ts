import { createServerSupabaseClient } from './supabase'

const BUCKET = 'story-media'

/**
 * Faz download de uma media URL do Instagram e salva no Supabase Storage.
 * Retorna a URL publica persistente ou null se falhar.
 */
export async function persistStoryMedia(
  mediaUrl: string,
  mediaId: string,
  mediaType: string
): Promise<string | null> {
  try {
    // Download da imagem/video do CDN do Instagram
    const response = await fetch(mediaUrl)
    if (!response.ok) return null

    const blob = await response.blob()
    const ext = mediaType === 'VIDEO' ? 'mp4' : 'jpg'
    const filePath = `${mediaId}.${ext}`

    const supabase = createServerSupabaseClient()

    // Upload para Supabase Storage (upsert para nao duplicar)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, blob, {
        contentType: mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg',
        upsert: true,
      })

    if (error) {
      console.error(`[Storage] Upload error (${mediaId}):`, error.message)
      return null
    }

    // Gerar URL publica
    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath)

    return data.publicUrl
  } catch (err) {
    console.error(`[Storage] Persist error (${mediaId}):`, err)
    return null
  }
}
