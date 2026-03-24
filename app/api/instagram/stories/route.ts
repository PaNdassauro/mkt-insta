import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ITEMS_PER_PAGE } from '@/lib/constants'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || ITEMS_PER_PAGE, 100)
    const offset = Number(searchParams.get('offset')) || 0
    const activeOnly = searchParams.get('active') === 'true'

    const supabase = createServerSupabaseClient()
    let query = supabase
      .from('instagram_stories')
      .select('*', { count: 'exact' })

    if (activeOnly) {
      query = query.gte('expires_at', new Date().toISOString())
    }

    query = query
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ data, total: count })
  } catch (err) {
    console.error('[DashIG Stories] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
