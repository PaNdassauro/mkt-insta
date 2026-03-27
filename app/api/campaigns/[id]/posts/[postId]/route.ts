import { NextResponse } from 'next/server'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * PATCH /api/campaigns/[id]/posts/[postId]
 * Edita um post individual da campanha.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { id, postId } = await params
    const body = await request.json()
    const supabase = createServerSupabaseClient()

    const allowedFields = [
      'caption_edited',
      'hashtags_edited',
      'visual_notes',
      'status',
      'analyst_notes',
    ]

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from('campaign_posts')
      .update(updates)
      .eq('id', postId)
      .eq('campaign_id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update post: ${error.message}`)
    }

    // Verificar se todos os posts estao aprovados -> campanha APPROVED
    const { data: allPosts } = await supabase
      .from('campaign_posts')
      .select('status')
      .eq('campaign_id', id)

    if (allPosts && allPosts.length > 0) {
      const allApproved = allPosts.every((p) => p.status === 'APPROVED')
      if (allApproved) {
        await supabase
          .from('instagram_campaigns')
          .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
          .eq('id', id)
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[Campaign Post PATCH]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
