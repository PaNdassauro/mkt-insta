'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/analytics'
import type { AdBreakdownRow } from '@/lib/meta-ads-client'

interface Props {
  title: string
  subtitle?: string
  data: AdBreakdownRow[]
  /**
   * Quando true, soma por `key` e separa por `subKey` em series distintas
   * (uso: breakdown por idade+genero — barras empilhadas por genero).
   * Quando false, agrega por `key` apenas.
   */
  stackBySubKey?: boolean
  /** Metrica a plotar: default spend. */
  metric?: 'spend' | 'reach' | 'impressions'
  isLoading?: boolean
}

const COLORS = ['#4F46E5', '#EC4899', '#10B981', '#F59E0B', '#06B6D4', '#8B5CF6']

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMetric(v: number, metric: 'spend' | 'reach' | 'impressions'): string {
  if (metric === 'spend') return formatBRL(v)
  return formatNumber(v)
}

function genderLabel(g: string | undefined): string {
  if (g === 'male') return 'Masculino'
  if (g === 'female') return 'Feminino'
  if (g === 'unknown' || !g) return 'Desconhecido'
  return g
}

function platformLabel(p: string): string {
  if (p === 'facebook') return 'Facebook'
  if (p === 'instagram') return 'Instagram'
  if (p === 'audience_network') return 'Audience Network'
  if (p === 'messenger') return 'Messenger'
  return p
}

export default function AdBreakdownChart({
  title,
  subtitle,
  data,
  stackBySubKey = false,
  metric = 'spend',
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-56 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </CardHeader>
        <CardContent>
          <div className="flex h-56 flex-col items-center justify-center rounded-lg bg-muted/30 text-center">
            <p className="text-sm text-muted-foreground">Sem dados disponiveis.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Build chart data. When stackBySubKey, pivot: one row per key, one field per subKey.
  type ChartRow = { key: string; [series: string]: string | number }
  let chartData: ChartRow[]
  let seriesKeys: string[]

  if (stackBySubKey) {
    const pivot = new Map<string, ChartRow>()
    const allSubKeys = new Set<string>()
    for (const row of data) {
      const sub = row.subKey ?? 'unknown'
      allSubKeys.add(sub)
      const existing = pivot.get(row.key) ?? { key: row.key }
      const cur = (existing[sub] as number | undefined) ?? 0
      existing[sub] = cur + row[metric]
      pivot.set(row.key, existing)
    }
    chartData = Array.from(pivot.values()).sort((a, b) =>
      String(a.key).localeCompare(String(b.key))
    )
    seriesKeys = Array.from(allSubKeys).sort()
  } else {
    const agg = new Map<string, number>()
    for (const row of data) {
      agg.set(row.key, (agg.get(row.key) ?? 0) + row[metric])
    }
    chartData = Array.from(agg.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value)
    seriesKeys = ['value']
  }

  const labelForSeries = (k: string): string => (stackBySubKey ? genderLabel(k) : k)
  const labelForKey = (k: string): string => {
    // Heuristic: if keys look like "facebook"/"instagram", pretty-print as platforms
    if (!stackBySubKey && chartData.length > 0 && chartData.length <= 8) {
      return platformLabel(k)
    }
    return k
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="key"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={labelForKey}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatMetric(Number(v), metric)}
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
                formatter={(value, name) => [
                  formatMetric(Number(value), metric),
                  labelForSeries(String(name ?? '')),
                ]}
                labelFormatter={(label) => labelForKey(String(label ?? ''))}
              />
              {stackBySubKey && (
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) => labelForSeries(String(value))}
                />
              )}
              {seriesKeys.map((sk, i) => (
                <Bar
                  key={sk}
                  dataKey={sk}
                  stackId={stackBySubKey ? 'stack' : undefined}
                  fill={COLORS[i % COLORS.length]}
                  radius={stackBySubKey ? 0 : [4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
