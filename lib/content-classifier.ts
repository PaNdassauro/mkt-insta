/**
 * Keyword-based content classifier for Instagram posts and reels.
 * Classifies content into categories based on caption text and hashtags.
 */

import { logger } from '@/lib/logger'

export type ContentCategory =
  | 'destination'
  | 'behind_the_scenes'
  | 'testimonial'
  | 'tips'
  | 'inspiration'
  | 'promotion'
  | 'event'
  | 'other'

interface CategoryRule {
  category: ContentCategory
  keywords: string[]
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'destination',
    keywords: ['destino', 'viagem', 'lugar', 'paisagem', 'praia', 'montanha', 'resort', 'hotel', 'localizacao', 'paraiso'],
  },
  {
    category: 'behind_the_scenes',
    keywords: ['bastidores', 'making of', 'equipe', 'preparacao', 'preparativo', 'nos bastidores', 'behind the scenes', 'backstage'],
  },
  {
    category: 'testimonial',
    keywords: ['depoimento', 'feedback', 'noiva', 'noivo disse', 'recomendo', 'testemunho', 'cliente', 'experiencia', 'avaliacao'],
  },
  {
    category: 'tips',
    keywords: ['dica', 'como', 'passo a passo', 'tutorial', 'guia', 'aprenda', 'confira', 'saiba', 'checklist'],
  },
  {
    category: 'inspiration',
    keywords: ['inspiracao', 'sonho', 'amor', 'romantico', 'apaixonante', 'encantador', 'magico', 'lindo', 'perfeito'],
  },
  {
    category: 'promotion',
    keywords: ['promocao', 'desconto', 'oferta', 'preco', 'pacote', 'condicao especial', 'oportunidade', 'imperdivel', 'black friday'],
  },
  {
    category: 'event',
    keywords: ['evento', 'feira', 'workshop', 'palestra', 'encontro', 'exposicao', 'open day', 'convite'],
  },
]

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  destination: 'Destino',
  behind_the_scenes: 'Bastidores',
  testimonial: 'Depoimento',
  tips: 'Dica',
  inspiration: 'Inspiracao',
  promotion: 'Promocao',
  event: 'Evento',
  other: 'Outro',
}

/**
 * Classifies content into a category based on caption and hashtags.
 * Uses keyword matching with priority based on rule order.
 */
export function classifyContent(caption: string | null, hashtags: string[] | null): ContentCategory {
  const text = [
    caption ?? '',
    ...(hashtags ?? []),
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents for matching

  if (!text.trim()) return 'other'

  let bestCategory: ContentCategory = 'other'
  let bestScore = 0

  for (const rule of CATEGORY_RULES) {
    let score = 0
    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      if (text.includes(normalizedKeyword)) {
        score++
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = rule.category
    }
  }

  logger.info(`Classified content as "${bestCategory}" (score: ${bestScore})`, 'Classifier')

  return bestCategory
}
