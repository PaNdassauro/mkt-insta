'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/analytics'
import type { Campaign } from '@/types/instagram'

// ---------- Types ----------

interface CampaignWithCount extends Campaign {
  post_count: number
}

interface CampaignMetrics {
  total_media: number
  posts_count: number
  reels_count: number
  reach: number
  likes: number
  comments: number
  saves: number
  shares: number
  engagement_rate_avg: number
}

interface ComparedCampaign extends Campaign {
  metrics: CampaignMetrics
}

interface CompareResponse {
  tags: string[]
  campaigns: ComparedCampaign[]
}

// ---------- Constants ----------

const RADAR_COLORS = ['#4F46E5', '#06B6D4', '#F59E0B', '#EF4444']

const METRIC_LABELS: Record<string, string> = {
  reach: 'Alcance',
  likes: 'Curtidas',
  comments: 'Comentarios',
  saves: 'Salvamentos',
  shares: 'Compartilhamentos',
  engagement_rate_avg: 'Engajamento (%)',
  total_media: 'Total de Midias',
  posts_count: 'Posts',
  reels_count: 'Reels',
}

// ---------- Component ----------

export default function CampaignComparePage() {
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [compared, setCompared] = useState<ComparedCampaign[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch campaign list
  useEffect(() => {
    fetchWithAccount('/api/campaigns')
      .then((res) => res.json())
      .then((data: CampaignWithCount[]) => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setError('Erro ao carregar campanhas.'))
      .finally(() => setLoadingList(false))
  }, [])

  // Toggle campaign selection (max 4)
  const toggleCampaign = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < 4) {
        next.add(id)
      }
      return next
    })
  }, [])

  // Fetch comparison data
  const handleCompare = useCallback(async () => {
    if (selectedIds.size < 2) return
    setLoadingCompare(true)
    setError(null)

    // Collect all tags from selected campaigns
    const selectedCampaigns = campaigns.filter((c) => selectedIds.has(c.id))
    const allTags = Array.from(new Set(selectedCampaigns.flatMap((c) => c.tags ?? [])))

    if (allTags.length === 0) {
      setError('As campanhas selecionadas nao possuem tags.')
      setLoadingCompare(false)
      return
    }

    try {
      const res = await fetchWithAccount(`/api/campaigns/compare?tags=${encodeURIComponent(allTags.join(','))}`)
      const json = await res.json() as { data?: CompareResponse }

      if (!res.ok) {
        throw new Error('Erro na API')
      }

      const result = json.data ?? (json as unknown as CompareResponse)
      // Filter to only selected campaigns
      const filtered = (result.campaigns ?? []).filter((c) => selectedIds.has(c.id))
      setCompared(filtered)
    } catch {
      setError('Erro ao comparar campanhas.')
    } finally {
      setLoadingCompare(false)
    }
  }, [selectedIds, campaigns])

  // ---------- Radar chart data ----------

  const radarData = (() => {
    if (compared.length === 0) return []

    const metricKeys: (keyof CampaignMetrics)[] = ['reach', 'likes', 'comments', 'saves', 'shares']

    // Normalize each metric to 0-100 for radar display
    const maxValues: Record<string, number> = {}
    for (const key of metricKeys) {
      maxValues[key] = Math.max(...compared.map((c) => c.metrics[key] as number), 1)
    }

    return metricKeys.map((key) => {
      const point: Record<string, string | number> = { metric: METRIC_LABELS[key] ?? key }
      for (const campaign of compared) {
        const raw = campaign.metrics[key] as number
        point[campaign.title] = Math.round((raw / maxValues[key]) * 100)
      }
      return point
    })
  })()

  // ---------- Render ----------

  if (loadingList) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comparar Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Selecione de 2 a 4 campanhas para comparar metricas
          </p>
        </div>
        <Link href="/dashboard/instagram/campaigns">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Campaign selector */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Selecionar Campanhas ({selectedIds.size}/4)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p>
          ) : (
            <div className="grid gap-2">
              {campaigns.map((campaign) => {
                const isSelected = selectedIds.has(campaign.id)
                const isDisabled = !isSelected && selectedIds.size >= 4

                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => toggleCampaign(campaign.id)}
                    disabled={isDisabled}
                    className={`flex items-center justify-between rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950'
                        : isDisabled
                          ? 'cursor-not-allowed border-muted opacity-50'
                          : 'border-border hover:border-indigo-300 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{campaign.title}</span>
                        {(campaign.tags ?? []).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{campaign.post_count} posts</span>
                        {campaign.start_date && (
                          <span>
                            Inicio: {new Date(campaign.start_date).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-4">
            <Button
              onClick={handleCompare}
              disabled={selectedIds.size < 2 || loadingCompare}
            >
              {loadingCompare ? 'Comparando...' : 'Comparar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loadingCompare && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      )}

      {!loadingCompare && compared.length >= 2 && (
        <>
          {/* Comparison Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Tabela Comparativa</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Metrica</th>
                    {compared.map((c, i) => (
                      <th key={c.id} className="text-right py-2 px-3 font-medium" style={{ color: RADAR_COLORS[i] }}>
                        {c.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    ['reach', 'likes', 'comments', 'saves', 'shares', 'engagement_rate_avg', 'total_media', 'posts_count', 'reels_count'] as (keyof CampaignMetrics)[]
                  ).map((key) => {
                    const values = compared.map((c) => c.metrics[key] as number)
                    const maxVal = Math.max(...values)

                    return (
                      <tr key={key} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-muted-foreground">
                          {METRIC_LABELS[key] ?? key}
                        </td>
                        {compared.map((c, i) => {
                          const val = c.metrics[key] as number
                          const isBest = val === maxVal && values.filter((v) => v === maxVal).length === 1
                          const display =
                            key === 'engagement_rate_avg'
                              ? `${val.toFixed(2)}%`
                              : formatNumber(val)

                          return (
                            <td
                              key={c.id}
                              className={`text-right py-2 px-3 tabular-nums ${isBest ? 'font-semibold' : ''}`}
                              style={isBest ? { color: RADAR_COLORS[i] } : undefined}
                            >
                              {display}
                              {isBest && (
                                <span className="ml-1 text-[10px] align-super" title="Melhor">
                                  ★
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Radar Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Grafico Comparativo</CardTitle>
              <p className="text-xs text-muted-foreground">
                Valores normalizados (0-100) para comparacao visual
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    {compared.map((c, i) => (
                      <Radar
                        key={c.id}
                        name={c.title}
                        dataKey={c.title}
                        stroke={RADAR_COLORS[i]}
                        fill={RADAR_COLORS[i]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!loadingCompare && compared.length === 1 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Apenas 1 campanha encontrada com as tags selecionadas. Selecione campanhas com tags em comum para comparar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
