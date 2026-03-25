import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM
    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('instagram_editorial_calendar')
      .select('*')
      .order('scheduled_for', { ascending: true })

    if (month) {
      const start = `${month}-01T00:00:00Z`
      const [y, m] = month.split('-').map(Number)
      const end = new Date(y, m, 0, 23, 59, 59).toISOString()
      query = query.gte('scheduled_for', start).lte('scheduled_for', end)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[DashIG Calendar GET] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { scheduled_for, content_type, topic, caption_draft, hashtags_plan, status } = body

    if (!scheduled_for || !content_type) {
      return NextResponse.json({ error: 'scheduled_for and content_type are required' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('instagram_editorial_calendar')
      .insert({
        scheduled_for,
        content_type,
        topic: topic || null,
        caption_draft: caption_draft || null,
        hashtags_plan: hashtags_plan || null,
        status: status || 'DRAFT',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[DashIG Calendar POST] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const allowedFields = [
      'scheduled_for', 'content_type', 'topic', 'caption_draft',
      'hashtags_plan', 'status', 'media_url', 'carousel_urls',
    ]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('instagram_editorial_calendar')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[DashIG Calendar PUT] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = createServerSupabaseClient()
    const { error } = await supabase.from('instagram_editorial_calendar').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DashIG Calendar DELETE] Error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
