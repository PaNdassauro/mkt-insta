'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent } from '@/lib/analytics'
import type { AccountSnapshot } from '@/types/instagram'

interface OverviewKPIsProps {
  current: AccountSnapshot | null
  previous: AccountSnapshot | null
  avgEngagementRate: number | null
  isLoading?: boolean
}

function calcDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const isPositive = delta >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        isPositive
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-700'
      }`}
    >
      {isPositive ? '↑' : '↓'}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

const KPI_CONFIG = [
  { key: 'followers', label: 'Seguidores', icon: '👥', color: 'from-indigo-500 to-indigo-600' },
  { key: 'reach', label: 'Alcance (7d)', icon: '👁', color: 'from-cyan-500 to-cyan-600' },
  { key: 'engagement', label: 'Engagement Rate', icon: '💬', color: 'from-amber-500 to-amber-600' },
  { key: 'profile_views', label: 'Visitas ao Perfil', icon: '👤', color: 'from-violet-500 to-violet-600' },
] as const

export default function OverviewKPIs({
  current,
  previous,
  avgEngagementRate,
  isLoading,
}: OverviewKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-5">
              <Skeleton className="mb-3 h-4 w-20" />
              <Skeleton className="mb-2 h-8 w-28" />
              <Skeleton className="h-5 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!current) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border/60 p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">Nenhum dado disponivel</p>
        <p className="mt-1 text-sm text-muted-foreground/70">Execute o sync para popular os dados.</p>
      </div>
    )
  }

  const kpis = [
    {
      ...KPI_CONFIG[0],
      value: current.followers_count,
      formatted: current.followers_count !== null ? formatNumber(current.followers_count) : '—',
      delta: calcDelta(current.followers_count, previous?.followers_count ?? null),
    },
    {
      ...KPI_CONFIG[1],
      value: current.reach_7d,
      formatted: current.reach_7d !== null ? formatNumber(current.reach_7d) : '—',
      delta: calcDelta(current.reach_7d, previous?.reach_7d ?? null),
    },
    {
      ...KPI_CONFIG[2],
      value: avgEngagementRate,
      formatted: avgEngagementRate !== null ? formatPercent(avgEngagementRate) : '—',
      delta: null,
    },
    {
      ...KPI_CONFIG[3],
      value: current.profile_views,
      formatted: current.profile_views !== null ? formatNumber(current.profile_views) : '—',
      delta: calcDelta(current.profile_views, previous?.profile_views ?? null),
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.key} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${kpi.color} text-white text-sm`}>
                {kpi.icon}
              </span>
            </div>
            <div className="text-2xl font-bold tracking-tight">{kpi.formatted}</div>
            <div className="mt-1">
              <DeltaBadge delta={kpi.delta} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
