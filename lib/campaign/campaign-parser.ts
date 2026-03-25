import type { PostFormat } from '@/types/instagram'

export interface CampaignOutput {
  campaign_summary: string
  strategic_rationale: string
  format_strategy: string
  timing_strategy: string
  expected_results: string
  posts: CampaignPostOutput[]
}

export interface CampaignPostOutput {
  post_order: number
  format: PostFormat
  scheduled_for?: string
  caption: string
  hashtags: string[]
  cta: string
  visual_brief: string
  strategic_note?: string
  reel_concept?: string
  reel_duration?: string
  audio_suggestion?: string
  slides?: Record<string, unknown>[]
}

const VALID_FORMATS: PostFormat[] = ['REEL', 'CAROUSEL', 'IMAGE', 'STORY']

/**
 * Extrai JSON do texto retornado pelo Claude.
 * Lida com markdown fences, whitespace variavel, etc.
 */
export function extractJSON(text: string): CampaignOutput {
  // Remove markdown fences se houver
  let clean = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim()

  // Tenta encontrar o JSON no texto (caso tenha texto antes/depois)
  const jsonStart = clean.indexOf('{')
  const jsonEnd = clean.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No JSON object found in response')
  }

  clean = clean.slice(jsonStart, jsonEnd + 1)

  try {
    const parsed = JSON.parse(clean)
    return validateCampaignSchema(parsed)
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${err.message}`)
    }
    throw err
  }
}

/**
 * Valida e normaliza o schema da campanha.
 * Garante campos obrigatorios e aplica defaults para opcionais.
 */
export function validateCampaignSchema(data: unknown): CampaignOutput {
  if (!data || typeof data !== 'object') {
    throw new Error('Campaign data must be an object')
  }

  const obj = data as Record<string, unknown>

  const campaign_summary =
    typeof obj.campaign_summary === 'string'
      ? obj.campaign_summary
      : 'Campanha gerada pelo Campaign Studio'

  const strategic_rationale =
    typeof obj.strategic_rationale === 'string'
      ? obj.strategic_rationale
      : ''

  const format_strategy =
    typeof obj.format_strategy === 'string'
      ? obj.format_strategy
      : ''

  const timing_strategy =
    typeof obj.timing_strategy === 'string'
      ? obj.timing_strategy
      : ''

  const expected_results =
    typeof obj.expected_results === 'string'
      ? obj.expected_results
      : ''

  if (!Array.isArray(obj.posts) || obj.posts.length === 0) {
    throw new Error('Campaign must have at least one post')
  }

  const posts: CampaignPostOutput[] = obj.posts.map(
    (post: unknown, index: number) => {
      if (!post || typeof post !== 'object') {
        throw new Error(`Post ${index + 1} must be an object`)
      }

      const p = post as Record<string, unknown>

      // Validar format
      const format = (typeof p.format === 'string' ? p.format.toUpperCase() : 'IMAGE') as PostFormat
      if (!VALID_FORMATS.includes(format)) {
        throw new Error(
          `Post ${index + 1}: invalid format "${p.format}". Must be one of: ${VALID_FORMATS.join(', ')}`
        )
      }

      // Caption obrigatoria
      if (typeof p.caption !== 'string' || !p.caption.trim()) {
        throw new Error(`Post ${index + 1}: caption is required`)
      }

      // Normalizar hashtags
      let hashtags: string[] = []
      if (Array.isArray(p.hashtags)) {
        hashtags = p.hashtags
          .filter((h): h is string => typeof h === 'string')
          .map((h) => h.replace(/^#/, ''))
      }

      const result: CampaignPostOutput = {
        post_order: typeof p.post_order === 'number' ? p.post_order : index + 1,
        format,
        caption: p.caption.trim(),
        hashtags,
        cta: typeof p.cta === 'string' ? p.cta : '',
        visual_brief: typeof p.visual_brief === 'string' ? p.visual_brief : '',
      }

      // Campos opcionais
      if (typeof p.scheduled_for === 'string') {
        result.scheduled_for = p.scheduled_for
      }
      if (typeof p.strategic_note === 'string') {
        result.strategic_note = p.strategic_note
      }

      // Campos de Reel
      if (format === 'REEL') {
        if (typeof p.reel_concept === 'string') result.reel_concept = p.reel_concept
        if (typeof p.reel_duration === 'string') result.reel_duration = p.reel_duration
        if (typeof p.audio_suggestion === 'string') result.audio_suggestion = p.audio_suggestion
      }

      // Slides de Carousel
      if (format === 'CAROUSEL' && Array.isArray(p.slides)) {
        result.slides = p.slides as Record<string, unknown>[]
      }

      return result
    }
  )

  return { campaign_summary, strategic_rationale, format_strategy, timing_strategy, expected_results, posts }
}
