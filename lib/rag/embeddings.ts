import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

/**
 * Gera embedding para um texto usando text-embedding-3-small (1536 dims).
 * Server-only — nunca chamar no client.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' ').trim(),
  })
  return response.data[0].embedding
}

/**
 * Gera embeddings em lote (max 100 por request).
 * Inclui rate limit de 200ms entre batches.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const batches = chunkArray(texts, 100)
  const results: number[][] = []

  for (const batch of batches) {
    const response = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map((t) => t.replace(/\n/g, ' ').trim()),
    })
    results.push(...response.data.map((d) => d.embedding))

    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  return results
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
