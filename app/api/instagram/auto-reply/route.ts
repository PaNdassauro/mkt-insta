import { NextResponse } from 'next/server'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * GET /api/instagram/auto-reply
 * Lista regras de auto-reply.
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('auto_reply_rules')
      .select('*')
      .order('priority', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/instagram/auto-reply
 * Cria uma nova regra de auto-reply.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { name, keywords, match_type, reply_text, priority } = body

    if (!name || !keywords?.length || !reply_text) {
      return NextResponse.json(
        { error: 'name, keywords and reply_text are required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('auto_reply_rules')
      .insert({
        name,
        keywords,
        match_type: match_type ?? 'contains',
        reply_text,
        priority: priority ?? 0,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/instagram/auto-reply
 * Atualiza uma regra existente.
 */
export async function PUT(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const allowedFields = ['name', 'keywords', 'match_type', 'reply_text', 'is_active', 'priority']
    const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (updates[field] !== undefined) safeUpdates[field] = updates[field]
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('auto_reply_rules')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/instagram/auto-reply
 */
export async function DELETE(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = createServerSupabaseClient()
    await supabase.from('auto_reply_rules').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
