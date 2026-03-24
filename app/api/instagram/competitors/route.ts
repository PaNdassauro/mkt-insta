import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { data: competitors, error: compError } = await supabase
      .from('instagram_competitors')
      .select('*')
      .order('added_at', { ascending: false })

    if (compError) throw compError

    // Buscar ultimo snapshot de cada concorrente
    const results = []
    for (const comp of competitors ?? []) {
      const { data: snapshot } = await supabase
        .from('instagram_competitor_snapshots')
        .select('*')
        .eq('competitor_id', comp.id)
        .order('date', { ascending: false })
        .limit(1)
        .single()

      results.push({ ...comp, latest_snapshot: snapshot ?? null })
    }

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
