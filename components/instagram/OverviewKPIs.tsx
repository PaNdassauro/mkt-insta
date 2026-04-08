'use client'

import { Users, Eye, Heart, UserCheck, ArrowUpRight, ArrowDownRight, BarChart3, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
        isPositive ? 'text-success' : 'text-destructive'
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
      {Math.abs(delta).toFixed(1)}%
      <span className="sr-only">{isPositive ? 'aumento' : 'queda'}</span>
    </span>
  )
}

interface KpiTileProps {
  label: string
  value: string
  delta: number | null
  icon: LucideIcon
}

function KpiTile({ label, value, delta, icon: Icon }: KpiTileProps) {
  return (
    <Card className="group border border-border bg-card shadow-none transition-colors hover:border-foreground/20">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <Icon
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>
        <div className="font-serif text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </div>
        <div className="min-h-[18px]">
          <DeltaBadge delta={delta} />
        </div>
      </CardContent>
    </Card>
  )
}

const KPI_CONFIG = [
  { key: 'followers', label: 'Seguidores', icon: Users },
  { key: 'reach', label: 'Alcance (7d)', icon: Eye },
  { key: 'engagement', label: 'Engagement Rate', icon: Heart },
  { key: 'profile_views', label: 'Visitas ao Perfil', icon: UserCheck },
] as const

// Fluid grid: 1 col on mobile, scales by intrinsic content width.
// On 4K screens this naturally becomes 5–6 columns without media queries.
const GRID_CLASSES = 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]'

export default function OverviewKPIs({
  current,
  previous,
  avgEngagementRate,
  isLoading,
}: OverviewKPIsProps) {
  if (isLoading) {
    return (
      <div className={GRID_CLASSES}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border border-border shadow-none">
            <CardContent className="flex flex-col gap-3 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-4 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <p className="font-serif text-lg font-medium">Nenhuma metrica coletada ainda</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Execute o sync para comecar a acompanhar seguidores, alcance e engajamento.
        </p>
      </div>
    )
  }

  const tiles: KpiTileProps[] = [
    {
      label: KPI_CONFIG[0].label,
      icon: KPI_CONFIG[0].icon,
      value: current.followers_count !== null ? formatNumber(current.followers_count) : '—',
      delta: calcDelta(current.followers_count, previous?.followers_count ?? null),
    },
    {
      label: KPI_CONFIG[1].label,
      icon: KPI_CONFIG[1].icon,
      value: current.reach_7d !== null ? formatNumber(current.reach_7d) : '—',
      delta: calcDelta(current.reach_7d, previous?.reach_7d ?? null),
    },
    {
      label: KPI_CONFIG[2].label,
      icon: KPI_CONFIG[2].icon,
      value: avgEngagementRate !== null ? formatPercent(avgEngagementRate) : '—',
      delta: null,
    },
    {
      label: KPI_CONFIG[3].label,
      icon: KPI_CONFIG[3].icon,
      value: current.profile_views !== null ? formatNumber(current.profile_views) : '—',
      delta: calcDelta(current.profile_views, previous?.profile_views ?? null),
    },
  ]

  return (
    <div className={GRID_CLASSES}>
      {tiles.map((tile) => (
        <KpiTile key={tile.label} {...tile} />
      ))}
    </div>
  )
}
