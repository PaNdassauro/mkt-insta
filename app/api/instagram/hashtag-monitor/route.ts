import { NextResponse } from 'next/server'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken } from '@/lib/meta-client'

const META_API = 'https://graph.facebook.com/v21.0'

/**
 * GET /api/instagram/hashtag-monitor
 * Lista hashtags monitoradas com snapshots.
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('monitored_hashtags')
      .select('*, hashtag_snapshots(date, top_media, recent_media)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/instagram/hashtag-monitor
 * Adicionar hashtag para monitorar OU sincronizar dados.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()

    if (body.action === 'sync') {
      return handleSync()
    }

    if (body.action === 'add') {
      return handleAdd(body.hashtag)
    }

    if (body.action === 'remove') {
      return handleRemove(body.id)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[Hashtag Monitor]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

async function handleAdd(hashtag: string) {
  if (!hashtag) return NextResponse.json({ error: 'hashtag is required' }, { status: 400 })

  const clean = hashtag.replace(/^#/, '').toLowerCase().trim()
  const supabase = createServerSupabaseClient()
  const token = await getAccessToken()
  const userId = process.env.META_IG_USER_ID!

  // Buscar ID do hashtag no Instagram
  const searchRes = await fetch(
    `${META_API}/ig_hashtag_search?q=${encodeURIComponent(clean)}&user_id=${userId}&access_token=${token}`
  )
  const searchData = await searchRes.json()
  const igHashtagId = searchData.data?.[0]?.id

  const { data, error } = await supabase
    .from('monitored_hashtags')
    .upsert(
      { hashtag: clean, ig_hashtag_id: igHashtagId ?? null },
      { onConflict: 'hashtag' }
    )
    .select()
    .single()

  if (error) throw error
  return NextResponse.json(data)
}

async function handleRemove(id: string) {
  const supabase = createServerSupabaseClient()
  await supabase.from('monitored_hashtags').update({ is_active: false }).eq('id', id)
  return NextResponse.json({ success: true })
}

async function handleSync() {
  const supabase = createServerSupabaseClient()
  const token = await getAccessToken()
  const userId = process.env.META_IG_USER_ID!

  const { data: hashtags } = await supabase
    .from('monitored_hashtags')
    .select('*')
    .eq('is_active', true)
    .not('ig_hashtag_id', 'is', null)

  if (!hashtags || hashtags.length === 0) {
    return NextResponse.json({ synced: 0, message: 'Nenhuma hashtag com ID para sincronizar' })
  }

  const today = new Date().toISOString().slice(0, 10)
  let synced = 0

  for (const ht of hashtags) {
    try {
      // Buscar top media
      const topRes = await fetch(
        `${META_API}/${ht.ig_hashtag_id}/top_media?user_id=${userId}&fields=id,caption,like_count,comments_count,media_type,permalink,timestamp&access_token=${token}`
      )
      const topData = await topRes.json()

      // Buscar recent media
      const recentRes = await fetch(
        `${META_API}/${ht.ig_hashtag_id}/recent_media?user_id=${userId}&fields=id,caption,like_count,comments_count,media_type,permalink,timestamp&access_token=${token}`
      )
      const recentData = await recentRes.json()

      // Salvar snapshot
      await supabase.from('hashtag_snapshots').upsert(
        {
          hashtag_id: ht.id,
          date: today,
          top_media: topData.data ?? [],
          recent_media: recentData.data ?? [],
        },
        { onConflict: 'hashtag_id,date' }
      )

      // Atualizar contadores
      await supabase
        .from('monitored_hashtags')
        .update({
          last_synced_at: new Date().toISOString(),
          top_media_count: (topData.data ?? []).length,
          recent_media_count: (recentData.data ?? []).length,
        })
        .eq('id', ht.id)

      synced++
    } catch (err) {
      console.error(`[Hashtag Sync] Error for #${ht.hashtag}:`, err)
    }
  }

  return NextResponse.json({ synced, total: hashtags.length })
}
