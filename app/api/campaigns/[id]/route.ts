import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * GET /api/campaigns/[id]
 * Retorna uma campanha com seus posts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from('instagram_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      throw new Error(`Campaign not found: ${error.message}`)
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[Campaign GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Atualiza status da campanha.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createServerSupabaseClient()

    const allowedFields = ['status', 'title', 'theme', 'objective', 'tags']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from('instagram_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update campaign: ${error.message}`)
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[Campaign PATCH]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
