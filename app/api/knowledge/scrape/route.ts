import { logger } from '@/lib/logger'
import { validateCronSecret } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { chunkText } from '@/lib/rag/chunker'
import { generateEmbeddings } from '@/lib/rag/embeddings'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'

const SITE_URL = process.env.WELCOME_WEDDINGS_SITE_URL || 'https://www.welcomeweddings.com.br'

// Paginas do site para indexar
const PAGES_TO_SCRAPE = [
  '/',
  '/destinos',
  '/sobre',
  '/depoimentos',
  '/pacotes',
  '/contato',
]

/**
 * POST /api/knowledge/scrape
 * Scrapa paginas do site da Welcome Weddings e indexa no pgvector.
 * Chamado via pg_cron (seg 6h BRT) ou manualmente.
 */
export async function POST(request: Request) {
  const authError = validateCronSecret(request)
  if (authError) return authError

  try {
    const supabase = createServerSupabaseClient()
    let totalChunks = 0
    const errors: string[] = []

    for (const path of PAGES_TO_SCRAPE) {
      const url = `${SITE_URL}${path}`

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'DashIG-Scraper/1.0' },
          signal: AbortSignal.timeout(15000),
        })

        if (!response.ok) {
          errors.push(`${url}: HTTP ${response.status}`)
          continue
        }

        const html = await response.text()
        const text = extractTextFromHTML(html)

        if (!text.trim()) {
          errors.push(`${url}: no text extracted`)
          continue
        }

        // Buscar ou criar documento para esta URL
        const { data: existingDoc } = await supabase
          .from('knowledge_documents')
          .select('id')
          .eq('source_url', url)
          .eq('source_type', 'WEBSITE')
          .single()

        let docId: string

        if (existingDoc) {
          // Re-indexar: deletar chunks antigos (CASCADE nao se aplica aqui pois mantemos o doc)
          await supabase
            .from('document_chunks')
            .delete()
            .eq('document_id', existingDoc.id)

          await supabase
            .from('knowledge_documents')
            .update({ indexed_at: new Date().toISOString() })
            .eq('id', existingDoc.id)

          docId = existingDoc.id
        } else {
          const { data: newDoc, error: docError } = await supabase
            .from('knowledge_documents')
            .insert({
              title: `Site - ${path === '/' ? 'Home' : path.slice(1)}`,
              source_type: 'WEBSITE',
              source_url: url,
              indexed_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (docError) {
            errors.push(`${url}: ${docError.message}`)
            continue
          }
          docId = newDoc.id
        }

        // Chunk e embed
        const chunks = chunkText(text, { source_url: url, page_path: path })
        const texts = chunks.map((c) => c.content)
        const embeddings = await generateEmbeddings(texts)

        const chunkRows = chunks.map((chunk, i) => ({
          document_id: docId,
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
          errors.push(`${url}: chunk insert failed — ${chunkError.message}`)
          continue
        }

        totalChunks += chunks.length
      } catch (err) {
        errors.push(
          `${url}: ${err instanceof Error ? err.message : 'unknown error'}`
        )
      }
    }

    return apiSuccess({
      success: true,
      pages_scraped: PAGES_TO_SCRAPE.length - errors.length,
      total_chunks: totalChunks,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    logger.error('Scrape error', 'Knowledge Scrape', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

/**
 * Extrai texto relevante de HTML removendo nav, footer, scripts, styles.
 */
function extractTextFromHTML(html: string): string {
  // Remove scripts, styles, nav, footer, header, noscript
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')

  // Remove todas as tags HTML
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")

  // Limpa whitespace
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()

  return text
}
