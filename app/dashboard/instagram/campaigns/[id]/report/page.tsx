'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

interface ReportData {
  campaign: {
    title: string
    status: string
    theme: string | null
    objective: string | null
    campaign_summary: string | null
    tags: string[]
    start_date: string | null
    duration_days: number | null
  }
  campaign_posts: Array<{
    post_order: number
    format: string
    status: string
    caption: string | null
  }>
  linked_media: {
    posts: Array<{
      media_id: string
      caption: string | null
      likes: number
      comments: number
      saves: number
      shares: number
      reach: number
      engagement_rate: number
      content_score: string | null
      permalink: string | null
    }>
    reels: Array<{
      media_id: string
      caption: string | null
      views: number
      likes: number
      comments: number
      saves: number
      shares: number
      reach: number
      content_score: string | null
      permalink: string | null
    }>
  }
  totals: {
    reach: number
    likes: number
    comments: number
    saves: number
    shares: number
    views: number
    engagement_rate_avg: number
    posts_count: number
    reels_count: number
    total_media: number
  }
  score_distribution: Record<string, number>
  post_status: Record<string, number>
  report_type: 'PARTIAL' | 'FINAL'
}

export default function CampaignReportPage() {
  const params = useParams()
  const campaignId = params.id as string
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}/report`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [campaignId])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-center py-12 text-muted-foreground">Campanha nao encontrada.</div>
  }

  const { campaign, totals, score_distribution, linked_media, report_type } = data
  const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n)
  const fmtPct = (n: number) => n.toFixed(2) + '%'

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/instagram/campaigns/${campaignId}`}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        ← Voltar para campanha
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Relatorio: {campaign.title}
            </h1>
            <Badge className={report_type === 'FINAL' ? 'bg-green-50 text-green-700 border-0' : 'bg-yellow-50 text-yellow-700 border-0'}>
              {report_type === 'FINAL' ? 'Final' : 'Parcial'}
            </Badge>
          </div>
          {campaign.theme && (
            <p className="text-sm text-muted-foreground mt-1">{campaign.theme}</p>
          )}
          {campaign.tags?.length > 0 && (
            <div className="flex gap-1 mt-1">
              {campaign.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Alcance Total" value={fmt(totals.reach)} />
        <KpiCard label="Likes" value={fmt(totals.likes)} />
        <KpiCard label="Comentarios" value={fmt(totals.comments)} />
        <KpiCard label="Saves" value={fmt(totals.saves)} />
        <KpiCard label="Shares" value={fmt(totals.shares)} />
        <KpiCard label="Eng. Rate Medio" value={fmtPct(totals.engagement_rate_avg)} />
      </div>

      {totals.views > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard label="Views (Reels)" value={fmt(totals.views)} />
          <KpiCard label="Total Midias" value={String(totals.total_media)} />
          <KpiCard label="Posts / Reels" value={`${totals.posts_count} / ${totals.reels_count}`} />
        </div>
      )}

      {/* Content Score Distribution */}
      {totals.total_media > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribuicao de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {Object.entries(score_distribution).map(([score, count]) => {
                const colors: Record<string, string> = {
                  VIRAL: 'bg-orange-500',
                  GOOD: 'bg-green-500',
                  AVERAGE: 'bg-yellow-500',
                  WEAK: 'bg-red-400',
                }
                const pct = totals.total_media > 0 ? (count / totals.total_media) * 100 : 0
                return (
                  <div key={score} className="flex-1 text-center">
                    <div className="h-20 bg-muted/30 rounded-lg relative overflow-hidden flex items-end justify-center">
                      <div
                        className={`w-full ${colors[score] ?? 'bg-gray-400'} transition-all rounded-t`}
                        style={{ height: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                    <p className="text-xs font-medium mt-1">{score}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {count} ({pct.toFixed(0)}%)
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Linked Media Detail */}
      {linked_media.posts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Posts Vinculados ({linked_media.posts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linked_media.posts.map((p) => (
                <div
                  key={p.media_id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">
                      {p.caption?.slice(0, 80) ?? '(sem caption)'}
                    </p>
                    {p.permalink && (
                      <a
                        href={p.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline"
                      >
                        Ver no Instagram
                      </a>
                    )}
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground shrink-0 ml-3">
                    <span>❤ {fmt(p.likes)}</span>
                    <span>💬 {fmt(p.comments)}</span>
                    <span>🔖 {fmt(p.saves)}</span>
                    <span>📊 {fmtPct(p.engagement_rate)}</span>
                    {p.content_score && (
                      <Badge variant="secondary" className="text-[8px]">
                        {p.content_score}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {linked_media.reels.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Reels Vinculados ({linked_media.reels.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linked_media.reels.map((r) => (
                <div
                  key={r.media_id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">
                      {r.caption?.slice(0, 80) ?? '(sem caption)'}
                    </p>
                    {r.permalink && (
                      <a
                        href={r.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline"
                      >
                        Ver no Instagram
                      </a>
                    )}
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground shrink-0 ml-3">
                    <span>👁 {fmt(r.views)}</span>
                    <span>❤ {fmt(r.likes)}</span>
                    <span>🔖 {fmt(r.saves)}</span>
                    {r.content_score && (
                      <Badge variant="secondary" className="text-[8px]">
                        {r.content_score}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {totals.total_media === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma midia vinculada a esta campanha ainda.</p>
            <p className="text-xs mt-1">
              Vincule posts e reels existentes na pagina da campanha para gerar metricas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
