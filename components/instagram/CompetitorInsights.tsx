'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAccount } from '@/lib/fetch-with-account'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/analytics'

interface TopPost {
  username: string
  caption: string
  likes: number
  comments: number
  format: string
  permalink: string
}

interface InsightsData {
  top_posts: TopPost[]
  trending_hashtags: string[]
  dominant_format: string | null
  suggestion: string
}

const FORMAT_BADGES: Record<string, { label: string; className: string }> = {
  VIDEO: { label: 'Reel', className: 'bg-purple-100 text-purple-700' },
  REEL: { label: 'Reel', className: 'bg-purple-100 text-purple-700' },
  IMAGE: { label: 'Imagem', className: 'bg-blue-100 text-blue-700' },
  CAROUSEL_ALBUM: { label: 'Carrossel', className: 'bg-amber-100 text-amber-700' },
}

export default function CompetitorInsights() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetchWithAccount('/api/instagram/competitors/insights')
      if (!res.ok) {
        setError(true)
        return
      }
      const json = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-8 w-2/3 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Inspiracao Competitiva</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nao foi possivel carregar insights dos concorrentes.
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasContent = data.top_posts.length > 0

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Inspiracao Competitiva</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Analise dos melhores posts recentes dos concorrentes
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasContent ? (
          <div className="rounded-xl border-2 border-dashed border-border/60 p-8 text-center">
            <p className="text-2xl mb-2">💡</p>
            <p className="font-medium text-muted-foreground">Sem dados de inspiracao</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {data.suggestion}
            </p>
          </div>
        ) : (
          <>
            {/* Top Posts */}
            <div>
              <h3 className="text-sm font-medium mb-3">Top Posts dos Concorrentes</h3>
              <div className="space-y-3">
                {data.top_posts.map((post, idx) => {
                  const badge = FORMAT_BADGES[post.format] ?? {
                    label: post.format,
                    className: 'bg-gray-100 text-gray-700',
                  }
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[10px] font-bold">
                        {post.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            @{post.username}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2">
                          {post.caption || '(sem legenda)'}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{formatNumber(post.likes)} curtidas</span>
                          <span>{formatNumber(post.comments)} comentarios</span>
                          {post.permalink && (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Ver
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Trending Hashtags */}
            {data.trending_hashtags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Hashtags em Alta</h3>
                <div className="flex flex-wrap gap-1.5">
                  {data.trending_hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestion */}
            {data.suggestion && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Recomendacao: </span>
                  {data.suggestion}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
