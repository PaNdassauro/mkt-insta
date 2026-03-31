import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { parsePDF } from '@/lib/rag/pdf-parser'
import { chunkText } from '@/lib/rag/chunker'
import { generateEmbeddings } from '@/lib/rag/embeddings'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

/**
 * POST /api/knowledge/ingest
 * Upload e ingestao de PDFs na Knowledge Base.
 * Chamado pelo dashboard (upload manual) ou cron.
 */
export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const description = formData.get('description') as string | null

    if (!file || !title) {
      return apiError('file and title are required', 400)
    }

    // Limite de 20MB
    const MAX_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return apiError('Arquivo muito grande. Maximo: 20MB', 400)
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return apiError('Only PDF files are supported', 400)
    }

    const supabase = createServerSupabaseClient()

    // 1. Parse PDF
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const parsed = await parsePDF(buffer)

    if (!parsed.text.trim()) {
      return apiError('PDF has no extractable text', 400)
    }

    // 2. Criar documento na knowledge_documents
    const { data: doc, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        title,
        source_type: 'PDF',
        file_name: file.name,
        description,
        indexed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (docError) {
      throw new Error(`Failed to create document: ${docError.message}`)
    }

    // 3. Chunk text
    const chunks = chunkText(parsed.text, {
      source: file.name,
      pages: parsed.numPages,
    })

    // 4. Gerar embeddings em lote
    const texts = chunks.map((c) => c.content)
    const embeddings = await generateEmbeddings(texts)

    // 5. Upsert chunks com embeddings
    const chunkRows = chunks.map((chunk, i) => ({
      document_id: doc.id,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      token_count: chunk.tokenCount,
      embedding: JSON.stringify(embeddings[i]),
      metadata: chunk.metadata ?? null,
    }))

    const { error: chunkError } = await supabase
      .from('document_chunks')
      .insert(chunkRows)

    if (chunkError) {
      // Rollback: remove documento se chunks falharem
      await supabase.from('knowledge_documents').delete().eq('id', doc.id)
      throw new Error(`Failed to insert chunks: ${chunkError.message}`)
    }

    return apiSuccess({
      success: true,
      document_id: doc.id,
      title,
      chunks_created: chunks.length,
      pages: parsed.numPages,
    })
  } catch (err) {
    console.error('[Knowledge Ingest]', err)
    return apiError(getErrorMessage(err))
  }
}
