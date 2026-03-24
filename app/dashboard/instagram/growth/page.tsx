'use client'

import GrowthChart from '@/components/instagram/GrowthChart'
import { useInstagramMetrics } from '@/hooks/useInstagramMetrics'
import { Card, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/analytics'

export default function GrowthPage() {
  const { snapshots, current, previous, isLoading } = useInstagramMetrics(365)

  const followersDelta =
    current?.followers_count && previous?.followers_count
      ? current.followers_count - previous.followers_count
      : null

  const stats = [
    {
      label: 'Seguidores Atuais',
      value: current?.followers_count ? formatNumber(current.followers_count) : '—',
      icon: '👥',
    },
    {
      label: 'Variacao (1d)',
      value: followersDelta !== null
        ? `${followersDelta >= 0 ? '+' : ''}${formatNumber(followersDelta)}`
        : '—',
      icon: followersDelta !== null && followersDelta >= 0 ? '📈' : '📉',
      color: followersDelta !== null && followersDelta >= 0 ? 'text-emerald-600' : 'text-red-500',
    },
    {
      label: 'Dias Rastreados',
      value: snapshots.length > 0 ? formatNumber(snapshots.length) : '—',
      icon: '📅',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crescimento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historico de seguidores e metricas de alcance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-lg">
                {stat.icon}
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color ?? ''}`}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <GrowthChart data={snapshots} isLoading={isLoading} />
    </div>
  )
}
