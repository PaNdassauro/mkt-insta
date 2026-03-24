'use client'

import { useState } from 'react'
import ReelCard from '@/components/instagram/ReelCard'
import ExportButton from '@/components/instagram/ExportButton'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useReelPerformance } from '@/hooks/useReelPerformance'
import { formatNumber, formatPercent } from '@/lib/analytics'
import { ITEMS_PER_PAGE } from '@/lib/constants'

const SORT_OPTIONS = [
  { value: 'timestamp', label: 'Mais recentes' },
  { value: 'views', label: 'Mais visualizados' },
  { value: 'reach', label: 'Maior alcance' },
  { value: 'likes', label: 'Mais curtidos' },
  { value: 'completion_rate', label: 'Maior conclusao' },
]

const SCORE_FILTERS = [
  { value: 'all', label: 'Todos os scores' },
  { value: 'VIRAL', label: 'Viral' },
  { value: 'GOOD', label: 'Bom' },
  { value: 'AVERAGE', label: 'Medio' },
  { value: 'WEAK', label: 'Fraco' },
]

export default function ReelsPage() {
  const [sortBy, setSortBy] = useState('timestamp')
  const [contentScore, setContentScore] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const { reels, total, isLoading, error } = useReelPerformance({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    sortBy,
    order: 'desc',
    contentScore,
  })

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  const avgViews = reels.length > 0 ? reels.reduce((s, r) => s + r.views, 0) / reels.length : 0
  const avgReach = reels.length > 0 ? reels.reduce((s, r) => s + r.reach, 0) / reels.length : 0
  const avgEngagement = reels.length > 0
    ? reels.reduce((s, r) => s + (r.reach > 0 ? ((r.likes + r.comments + r.saves + r.shares) / r.reach) * 100 : 0), 0) / reels.length
    : 0

  const stats = [
    { label: 'Total de Reels', value: formatNumber(total), icon: '🎬' },
    { label: 'Media de Views', value: formatNumber(Math.round(avgViews)), icon: '▶' },
    { label: 'Media de Alcance', value: formatNumber(Math.round(avgReach)), icon: '👁' },
    { label: 'Engagement Medio', value: formatPercent(avgEngagement), icon: '💬' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance de Reels com views, alcance e taxa de conclusao
          </p>
        </div>
        <ExportButton type="reels" />
      </div>

      {!isLoading && reels.length > 0 && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-base">{stat.icon}</span>
                <div>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
        <Select value={sortBy} onValueChange={(v) => { if (v) setSortBy(v) }}>
          <SelectTrigger className="w-[180px] h-9 text-sm border-border/50"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={contentScore ?? 'all'} onValueChange={(v) => { setContentScore(v === 'all' ? null : v); setPage(0) }}>
          <SelectTrigger className="w-[160px] h-9 text-sm border-border/50"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            {SCORE_FILTERS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{total > 0 && `${total} reels`}</div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Erro ao carregar reels</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl bg-card shadow-sm">
              <Skeleton className="aspect-[9/16] max-h-[320px] w-full" />
              <div className="space-y-2 p-3.5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-16 w-full rounded-md" /></div>
            </div>
          ))}
        </div>
      ) : reels.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/60 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">Nenhum reel encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {reels.map((reel) => (<ReelCard key={reel.id} reel={reel} />))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-9 px-4">Anterior</Button>
          <span className="text-sm text-muted-foreground">{page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="h-9 px-4">Proxima</Button>
        </div>
      )}
    </div>
  )
}
