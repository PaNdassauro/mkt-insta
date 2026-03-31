'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { logger } from '@/lib/logger'

// ============================================================
// Recommendation Widget — Exibe recomendacoes de conteudo
// baseadas em analise de dados historicos do Instagram.
// ============================================================

interface Recommendation {
  type: 'timing' | 'format' | 'gap' | 'theme' | 'trend'
  title: string
  description: string
  confidence: 'high' | 'medium' | 'low'
  data: Record<string, unknown>
}

const TYPE_ICONS: Record<Recommendation['type'], string> = {
  timing: '\u{1F550}',  // clock
  format: '\u{1F4CA}',  // bar chart
  gap: '\u{1F4C5}',     // calendar
  theme: '#\uFE0F\u20E3', // hash
  trend: '\u{1F4C8}',   // chart increasing
}

const TYPE_LABELS: Record<Recommendation['type'], string> = {
  timing: 'Horario',
  format: 'Formato',
  gap: 'Calendario',
  theme: 'Tema',
  trend: 'Tendencia',
}

const CONFIDENCE_STYLES: Record<Recommendation['confidence'], { label: string; className: string }> = {
  high: { label: 'Alta confianca', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  medium: { label: 'Media confianca', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  low: { label: 'Baixa confianca', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

export default function RecommendationWidget() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchRecommendations() {
      try {
        const res = await fetchWithAccount('/api/instagram/recommendations')
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const json = await res.json()
        if (!cancelled) {
          setRecommendations(json.recommendations ?? [])
        }
      } catch (err) {
        logger.error('Failed to fetch recommendations', 'RecommendationWidget', {
          error: err instanceof Error ? { message: err.message } : {},
        })
        if (!cancelled) {
          setError('Nao foi possivel carregar recomendacoes.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchRecommendations()
    return () => { cancelled = true }
  }, [])

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Recomendacoes de Conteudo</CardTitle>
        <p className="text-xs text-muted-foreground">
          Sugestoes baseadas na analise de performance dos ultimos 30 dias
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg p-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{error}</p>
        ) : recommendations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma recomendacao disponivel. Publique mais conteudo para gerar insights.
          </p>
        ) : (
          <div className="space-y-2">
            {recommendations.map((rec, i) => {
              const conf = CONFIDENCE_STYLES[rec.confidence]
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base"
                    role="img"
                    aria-label={TYPE_LABELS[rec.type]}
                  >
                    {TYPE_ICONS[rec.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-tight">{rec.title}</p>
                      <Badge
                        className={`${conf.className} border-0 text-[10px] px-1.5 py-0 shrink-0`}
                      >
                        {conf.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {rec.description}
                    </p>
                    <span className="mt-1 inline-block text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                      {TYPE_LABELS[rec.type]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
