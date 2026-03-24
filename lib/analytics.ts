import { QEI_WEIGHTS } from './constants'
import type { ContentScore } from '@/types/instagram'

/**
 * Calcula a taxa de engajamento.
 * Formula: (likes + comments + saves + shares) / reach × 100
 */
export function calcEngagementRate(
  likes: number,
  comments: number,
  saves: number,
  shares: number,
  reach: number
): number {
  if (reach === 0) return 0
  return ((likes + comments + saves + shares) / reach) * 100
}

/**
 * Calcula o Qualitative Engagement Index (QEI).
 * Ponderacao: saves (×4) e shares (×5) valem mais que likes (×1).
 */
export function calcQEI(
  likes: number,
  comments: number,
  saves: number,
  shares: number,
  reach: number
): number {
  if (reach === 0) return 0
  const qei =
    likes * QEI_WEIGHTS.likes +
    comments * QEI_WEIGHTS.comments +
    saves * QEI_WEIGHTS.saves +
    shares * QEI_WEIGHTS.shares
  return (qei / reach) * 100
}

/**
 * Calcula media e desvio padrao de um array de numeros.
 */
export function calcMeanAndStdDev(values: number[]): {
  mean: number
  stdDev: number
} {
  if (values.length === 0) return { mean: 0, stdDev: 0 }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  return { mean, stdDev }
}

/**
 * Classifica o conteudo em tier baseado no engagement_rate vs media historica.
 * VIRAL: > media + 1σ
 * GOOD: >= media
 * AVERAGE: >= media - 1σ
 * WEAK: < media - 1σ
 */
export function calcContentScore(
  engagementRate: number,
  mean: number,
  stdDev: number
): ContentScore {
  if (engagementRate >= mean + stdDev) return 'VIRAL'
  if (engagementRate >= mean) return 'GOOD'
  if (engagementRate >= mean - stdDev) return 'AVERAGE'
  return 'WEAK'
}

/**
 * Extrai hashtags de uma caption do Instagram.
 * Retorna array de hashtags sem o simbolo #.
 */
export function extractHashtags(caption: string | null): string[] {
  if (!caption) return []
  const matches = caption.match(/#[\w\u00C0-\u024F]+/g)
  if (!matches) return []
  return matches.map((tag) => tag.slice(1).toLowerCase())
}

/**
 * Formata numero para exibicao em pt-BR.
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

/**
 * Formata percentual para exibicao em pt-BR.
 */
export function formatPercent(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(n) + '%'
}

/**
 * Calcula completion rate de um Reel.
 * Formula: (avg_watch_time / duration) × 100
 */
export function calcCompletionRate(
  avgWatchTimeSec: number | null,
  durationSec: number | null
): number | null {
  if (!avgWatchTimeSec || !durationSec || durationSec === 0) return null
  return (avgWatchTimeSec / durationSec) * 100
}
