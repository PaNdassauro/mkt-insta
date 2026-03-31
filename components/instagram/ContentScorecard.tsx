'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent, calcQEI } from '@/lib/analytics'
import { CONTENT_SCORE_COLORS, CONTENT_SCORE_LABELS } from '@/lib/constants'
import type { InstagramPost, InstagramReel, ContentScore } from '@/types/instagram'

interface ContentScorecardProps {
  posts: InstagramPost[]
  reels: InstagramReel[]
  isLoading?: boolean
}

type ContentItem = {
  id: string
  type: 'Post' | 'Reel'
  caption: string
  timestamp: string
  likes: number
  comments: number
  saves: number
  shares: number
  reach: number
  engagementRate: number
  qei: number
  contentScore: ContentScore | null
  permalink: string | null
}

export default function ContentScorecard({ posts, reels, isLoading }: ContentScorecardProps) {
  const [sortField, setSortField] = useState<'engagementRate' | 'qei' | 'reach' | 'timestamp'>('engagementRate')

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full rounded-lg" /></CardContent>
      </Card>
    )
  }

  const items: ContentItem[] = [
    ...posts.map((p): ContentItem => ({
      id: p.id,
      type: 'Post',
      caption: p.caption ?? '',
      timestamp: p.timestamp ?? '',
      likes: p.likes,
      comments: p.comments,
      saves: p.saves,
      shares: p.shares,
      reach: p.reach,
      engagementRate: p.engagement_rate ?? 0,
      qei: calcQEI(p.likes, p.comments, p.saves, p.shares, p.reach),
      contentScore: p.content_score,
      permalink: p.permalink,
    })),
    ...reels.map((r): ContentItem => ({
      id: r.id,
      type: 'Reel',
      caption: r.caption ?? '',
      timestamp: r.timestamp ?? '',
      likes: r.likes,
      comments: r.comments,
      saves: r.saves,
      shares: r.shares,
      reach: r.reach,
      engagementRate: r.reach > 0 ? ((r.likes + r.comments + r.saves + r.shares) / r.reach) * 100 : 0,
      qei: calcQEI(r.likes, r.comments, r.saves, r.shares, r.reach),
      contentScore: r.content_score,
      permalink: r.permalink,
    })),
  ]

  items.sort((a, b) => {
    if (sortField === 'timestamp') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    return b[sortField] - a[sortField]
  })

  // Contagem por tier
  const tierCounts = items.reduce((acc, item) => {
    if (item.contentScore) acc[item.contentScore] = (acc[item.contentScore] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortableHeader = (field: typeof sortField, label: string) => (
    <button
      onClick={() => setSortField(field)}
      className={`text-left font-medium transition-colors hover:text-foreground ${
        sortField === field ? 'text-primary' : ''
      }`}
    >
      {label} {sortField === field && '↓'}
    </button>
  )

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Content Scorecard</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Classificacao de todo conteudo por performance</p>
          </div>
          <div className="flex gap-2">
            {(['VIRAL', 'GOOD', 'AVERAGE', 'WEAK'] as ContentScore[]).map((tier) => {
              const colors = CONTENT_SCORE_COLORS[tier]
              return (
                <Badge key={tier} className={`${colors.bg} ${colors.text} border-0 text-[10px]`}>
                  {CONTENT_SCORE_LABELS[tier]}: {tierCounts[tier] ?? 0}
                </Badge>
              )
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-2xl mb-2">🏆</p>
            <p className="text-sm text-muted-foreground">Nenhum conteudo avaliado ainda.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Os scores aparecerao apos a sincronizacao dos posts e reels.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[40%]">Conteudo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>{sortableHeader('engagementRate', 'Engage')}</TableHead>
                  <TableHead>{sortableHeader('qei', 'QEI')}</TableHead>
                  <TableHead>{sortableHeader('reach', 'Alcance')}</TableHead>
                  <TableHead>{sortableHeader('timestamp', 'Data')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.slice(0, 30).map((item) => {
                  const scoreColors = item.contentScore ? CONTENT_SCORE_COLORS[item.contentScore] : null
                  const scoreLabel = item.contentScore ? CONTENT_SCORE_LABELS[item.contentScore] : null
                  return (
                    <TableRow key={item.id} className="group">
                      <TableCell>
                        <a
                          href={item.permalink ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-1 text-sm hover:text-primary transition-colors"
                        >
                          {item.caption.slice(0, 80) || 'Sem legenda'}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {scoreColors && scoreLabel && (
                          <Badge className={`${scoreColors.bg} ${scoreColors.text} border-0 text-[10px]`}>
                            {scoreLabel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatPercent(item.engagementRate)}</TableCell>
                      <TableCell className="font-medium">{formatPercent(item.qei)}</TableCell>
                      <TableCell>{formatNumber(item.reach)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {item.timestamp ? new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
