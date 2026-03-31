import { logger } from '@/lib/logger'
import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { resolveAccountId } from '@/lib/account-context'

/**
 * GET /api/knowledge/documents
 * Lista todos os documentos da Knowledge Base com contagem de chunks.
 */
export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('knowledge_documents')
      .select('*, document_chunks(count)')
      .order('created_at', { ascending: false })

    if (accountId) query = query.eq('account_id', accountId)

    const { data: documents, error } = await query

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`)
    }

    // Formata contagem de chunks
    const formatted = (documents ?? []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      source_type: doc.source_type,
      source_url: doc.source_url,
      file_name: doc.file_name,
      description: doc.description,
      is_active: doc.is_active,
      chunk_count: doc.document_chunks?.[0]?.count ?? 0,
      indexed_at: doc.indexed_at,
      created_at: doc.created_at,
    }))

    return apiSuccess(formatted)
  } catch (err) {
    logger.error('GET error', 'Knowledge Documents', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * PATCH /api/knowledge/documents
 * Toggle is_active de um documento (ativa/desativa sem deletar).
 * Body: { id: string, is_active: boolean }
 */
export async function PATCH(request: Request) {
  const authErrorPatch = validateDashboardRequest(request)
  if (authErrorPatch) return authErrorPatch

  try {
    const body = await request.json()
    const { id, is_active } = body

    if (!id || typeof is_active !== 'boolean') {
      return apiError('id and is_active (boolean) are required', 400)
    }

    const supabase = createServerSupabaseClient()

    const { error } = await supabase
      .from('knowledge_documents')
      .update({ is_active })
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update document: ${error.message}`)
    }

    return apiSuccess({ success: true, id, is_active })
  } catch (err) {
    logger.error('PATCH error', 'Knowledge Documents', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * DELETE /api/knowledge/documents
 * Remove um documento e todos os seus chunks (CASCADE).
 * Body: { id: string }
 */
export async function DELETE(request: Request) {
  const authErrorDelete = validateDashboardRequest(request)
  if (authErrorDelete) return authErrorDelete

  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return apiError('id is required', 400)
    }

    const supabase = createServerSupabaseClient()

    const { error } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`)
    }

    return apiSuccess({ success: true, id })
  } catch (err) {
    logger.error('DELETE error', 'Knowledge Documents', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
