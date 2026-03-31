import { createServerSupabaseClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { SearchResult } from '@/types/instagram'

// --- In-memory cache with TTL ---

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface CacheEntry {
  results: SearchResult[]
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

/** Build a cache key from the first 16 chars of the serialized embedding. */
function cacheKey(embedding: number[], threshold: number, limit: number): string {
  const prefix = JSON.stringify(embedding).slice(0, 16)
  return `${prefix}|${threshold}|${limit}`
}

/** Clear the entire vector search cache (useful for testing). */
export function clearVectorCache(): void {
  cache.clear()
  logger.info('Vector cache cleared', 'VectorSearch')
}

/**
 * Busca os chunks mais relevantes via pgvector (cosine similarity).
 * Usa a funcao SQL search_knowledge() — nunca calcula distancia no TypeScript.
 *
 * Results are cached in-memory for 30 minutes keyed by the embedding prefix,
 * threshold, and limit.
 */
export async function vectorSearch(
  queryEmbedding: number[],
  options: { threshold?: number; limit?: number } = {}
): Promise<SearchResult[]> {
  const { threshold = 0.70, limit = 8 } = options
  const key = cacheKey(queryEmbedding, threshold, limit)

  // Check cache
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.info('Cache hit', 'VectorSearch', { key })
    return cached.results
  }

  logger.info('Cache miss — querying DB', 'VectorSearch', { key })

  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase.rpc('search_knowledge', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    throw new Error(`Vector search failed: ${error.message}`)
  }

  const results = (data ?? []) as SearchResult[]

  // Store in cache
  cache.set(key, { results, timestamp: Date.now() })

  return results
}
