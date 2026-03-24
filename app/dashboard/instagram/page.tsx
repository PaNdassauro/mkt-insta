'use client'

import { useState, useEffect } from 'react'
import OverviewKPIs from '@/components/instagram/OverviewKPIs'
import GrowthChart from '@/components/instagram/GrowthChart'
import EngagementChart from '@/components/instagram/EngagementChart'
import ContentScorecard from '@/components/instagram/ContentScorecard'
import HeatmapPostingTime from '@/components/instagram/HeatmapPostingTime'
import { useInstagramMetrics } from '@/hooks/useInstagramMetrics'
import { usePostPerformance } from '@/hooks/usePostPerformance'
import { useReelPerformance } from '@/hooks/useReelPerformance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatPercent, calcQEI } from '@/lib/analytics'
import { CONTENT_SCORE_COLORS, CONTENT_SCORE_LABELS } from '@/lib/constants'
import type { InstagramPost, AudienceSnapshot } from '@/types/instagram'

function TopPostCard({ post, rank }: { post: InstagramPost; rank: number }) {
  const scoreColors = post.content_score ? CONTENT_SCORE_COLORS[post.content_score] : null
  const scoreLabel = post.content_score ? CONTENT_SCORE_LABELS[post.content_score] : null
  const qei = calcQEI(post.likes, post.comments, post.saves, post.shares, post.reach)

  return (
    <div className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium">
          {post.caption?.slice(0, 60) ?? 'Sem legenda'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatNumber(post.likes)} likes</span>
          <span>·</span>
          <span>{formatNumber(post.reach)} alcance</span>
          <span>·</span>
          <span>{post.engagement_rate !== null ? formatPercent(post.engagement_rate) : '—'} eng.</span>
          <span>·</span>
          <span className="text-indigo-600 font-medium">QEI {formatPercent(qei)}</span>
          {scoreColors && scoreLabel && (
            <Badge className={`${scoreColors.bg} ${scoreColors.text} border-0 text-[10px] px-1.5 py-0`}>
              {scoreLabel}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const { snapshots, current, previous, isLoading: metricsLoading } =
    useInstagramMetrics(90)
  const { posts, isLoading: postsLoading } = usePostPerformance({
    limit: 100,
    sortBy: 'timestamp',
    order: 'desc',
  })
  const { reels, isLoading: reelsLoading } = useReelPerformance({
    limit: 100,
    sortBy: 'timestamp',
    order: 'desc',
  })

  const [audience, setAudience] = useState<AudienceSnapshot | null>(null)
  useEffect(() => {
    fetch('/api/instagram/audience')
      .then((r) => r.json())
      .then((json) => setAudience(json.data))
      .catch(() => {})
  }, [])

  const avgEngagementRate =
    posts.length > 0
      ? posts.reduce((sum, p) => sum + (p.engagement_rate ?? 0), 0) / posts.length
      : null

  const topPosts = [...posts]
    .filter((p) => p.engagement_rate !== null)
    .sort((a, b) => (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visao Geral</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performance do Instagram — @welcomeweddings
        </p>
      </div>

      {/* KPIs */}
      <OverviewKPIs
        current={current}
        previous={previous}
        avgEngagementRate={avgEngagementRate}
        isLoading={metricsLoading}
      />

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthChart data={snapshots} isLoading={metricsLoading} />
        <EngagementChart posts={posts} isLoading={postsLoading} />
      </div>

      {/* Heatmap */}
      <HeatmapPostingTime audience={audience} posts={posts} isLoading={postsLoading} />

      {/* Content Scorecard */}
      <ContentScorecard posts={posts} reels={reels} isLoading={postsLoading || reelsLoading} />

      {/* Top posts */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Top Posts por Engagement</CardTitle>
          <p className="text-xs text-muted-foreground">Posts com maior taxa de engajamento (incluindo QEI)</p>
        </CardHeader>
        <CardContent className="pt-0">
          {postsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : topPosts.length > 0 ? (
            <div className="divide-y divide-border/50">
              {topPosts.map((post, i) => (
                <TopPostCard key={post.id} post={post} rank={i + 1} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum post disponivel.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
