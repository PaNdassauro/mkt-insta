import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { validateCronSecret } from '@/lib/auth'
import {
  getAccessToken,
  getActiveStories,
  getStoryInsights,
} from '@/lib/meta-client'
import { persistStoryMedia } from '@/lib/storage'

export async function POST(request: Request) {
  try {
    const authError = validateCronSecret(request)
    if (authError) return authError

    const supabase = createServerSupabaseClient()
    const userId = process.env.META_IG_USER_ID
    if (!userId) {
      return NextResponse.json({ error: 'META_IG_USER_ID not configured' }, { status: 500 })
    }

    const token = await getAccessToken()
    const stories = await getActiveStories(token, userId)
    let syncedCount = 0
    let storedCount = 0

    for (const story of stories) {
      const insights = await getStoryInsights(token, story.id)

      // Story expira 24h apos publicacao
      const expiresAt = new Date(
        new Date(story.timestamp).getTime() + 24 * 60 * 60 * 1000
      ).toISOString()

      // Persistir media no Supabase Storage (se ainda nao foi salvo)
      let storedMediaUrl: string | null = null
      if (story.media_url) {
        // Verificar se ja existe no storage
        const { data: existing } = await supabase
          .from('instagram_stories')
          .select('stored_media_url')
          .eq('media_id', story.id)
          .single()

        if (existing?.stored_media_url) {
          storedMediaUrl = existing.stored_media_url
        } else {
          storedMediaUrl = await persistStoryMedia(
            story.media_url,
            story.id,
            story.media_type ?? 'IMAGE'
          )
          if (storedMediaUrl) storedCount++
        }
      }

      const { error } = await supabase.from('instagram_stories').upsert(
        {
          media_id: story.id,
          media_type: story.media_type ?? null,
          media_url: story.media_url ?? null,
          stored_media_url: storedMediaUrl,
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
        console.error(`Story upsert error (${story.id}):`, error.message)
      } else {
        syncedCount++
      }
    }

    return NextResponse.json({
      success: true,
      stories_synced: syncedCount,
      media_stored: storedCount,
      total_active: stories.length,
    })
  } catch (err) {
    console.error('[DashIG Sync Stories] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
