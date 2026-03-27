import { NextResponse } from 'next/server'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data: competitors, error: compError } = await supabase
      .from('instagram_competitors')
      .select('*')
      .order('added_at', { ascending: false })

    if (compError) throw compError

    // Buscar todos os snapshots mais recentes em uma unica query
    const compIds = (competitors ?? []).map((c) => c.id)
    const { data: allSnapshots } = compIds.length > 0
      ? await supabase
          .from('instagram_competitor_snapshots')
          .select('*')
          .in('competitor_id', compIds)
          .order('date', { ascending: false })
      : { data: [] }

    // Agrupar por competitor_id (pegar apenas o mais recente)
    const snapList = allSnapshots ?? []
    const snapshotMap = new Map<string, (typeof snapList)[number]>()
    for (const snap of snapList) {
      if (!snapshotMap.has(snap.competitor_id)) {
        snapshotMap.set(snap.competitor_id, snap)
      }
    }

    const results = (competitors ?? []).map((comp) => ({
      ...comp,
      latest_snapshot: snapshotMap.get(comp.id) ?? null,
    }))

    return NextResponse.json({ data: results })
  } catch (err) {
    console.error('[DashIG Competitors] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { username, display_name } = body

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('instagram_competitors')
      .upsert(
        { username: username.toLowerCase().replace('@', ''), display_name: display_name || username },
        { onConflict: 'username' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[DashIG Competitors POST] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = createServerSupabaseClient()

    // Deletar snapshots primeiro
    await supabase.from('instagram_competitor_snapshots').delete().eq('competitor_id', id)
    const { error } = await supabase.from('instagram_competitors').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DashIG Competitors DELETE] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
