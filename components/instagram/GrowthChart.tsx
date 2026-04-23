'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CHART_COLORS } from '@/lib/constants'
import { formatNumber } from '@/lib/analytics'
import type { AccountSnapshot } from '@/types/instagram'

interface GrowthChartProps {
  data: AccountSnapshot[]
  isLoading?: boolean
}

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'Tudo', days: Infinity },
] as const

export default function GrowthChart({ data, isLoading }: GrowthChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(1)

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Crescimento de Seguidores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-72 flex-col items-center justify-center rounded-lg bg-muted/30 text-center">
            <p className="text-2xl mb-2">📈</p>
            <p className="text-sm text-muted-foreground">Nenhum dado historico disponivel.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Execute o sync para comecar a rastrear o crescimento de seguidores.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const period = PERIODS[selectedPeriod]
  const filteredData = period.days === Infinity ? data : data.slice(-period.days)

  const chartData = filteredData.map((s) => ({
    date: new Date(s.date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
    seguidores: s.followers_count ?? 0,
  }))

  // Zoom Y-axis to the actual follower range so small variations are visible.
  // Rounds bounds to a nice multiple of 100 with ~20% headroom above/below the series.
  const series = chartData.map((d) => d.seguidores).filter((v) => v > 0)
  const yDomain: [number, number] | undefined = (() => {
    if (series.length === 0) return undefined
    const min = Math.min(...series)
    const max = Math.max(...series)
    const range = Math.max(max - min, 1)
    const pad = Math.max(Math.ceil(range * 0.2), 50)
    return [
      Math.max(0, Math.floor((min - pad) / 100) * 100),
      Math.ceil((max + pad) / 100) * 100,
    ]
  })()

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Crescimento de Seguidores</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Evolucao ao longo do tempo</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setSelectedPeriod(i)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                selectedPeriod === i
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientFollowers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v)}
                domain={yDomain ?? [0, 'auto']}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(value) => [formatNumber(Number(value)), 'Seguidores']}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="seguidores"
                stroke={CHART_COLORS.primary}
                fill="url(#gradientFollowers)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
