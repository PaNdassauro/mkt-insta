'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/analytics'
import dynamic from 'next/dynamic'

const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
)
const LineChart = dynamic(
  () => import('recharts').then((m) => m.LineChart),
  { ssr: false }
)
const Line = dynamic(
  () => import('recharts').then((m) => m.Line),
  { ssr: false }
)
const XAxis = dynamic(
  () => import('recharts').then((m) => m.XAxis),
  { ssr: false }
)
const YAxis = dynamic(
  () => import('recharts').then((m) => m.YAxis),
  { ssr: false }
)
const CartesianGrid = dynamic(
  () => import('recharts').then((m) => m.CartesianGrid),
  { ssr: false }
)
const Tooltip = dynamic(
  () => import('recharts').then((m) => m.Tooltip),
  { ssr: false }
)
const Legend = dynamic(
  () => import('recharts').then((m) => m.Legend),
  { ssr: false }
)

const LINE_COLORS = [
  '#4F46E5', // indigo
  '#06B6D4', // cyan
  '#F59E0B', // amber
  '#EF4444', // red
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F97316', // orange
]

interface SnapshotRow {
  competitor_id: string
  date: string
  followers_count: number | null
}

interface CompetitorInfo {
  id: string
  username: string
}

interface CompetitorEvolutionChartProps {
  competitors: CompetitorInfo[]
}

export default function CompetitorEvolutionChart({ competitors }: CompetitorEvolutionChartProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const res = await fetchWithAccount('/api/instagram/competitor-snapshots')
        if (!res.ok) return
        const json = await res.json()
        setSnapshots(json.data ?? [])
      } catch {
        // silenciar
      } finally {
        setIsLoading(false)
      }
    }
    if (competitors.length > 0) {
      fetchSnapshots()
    } else {
      setIsLoading(false)
    }
  }, [competitors])

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-6 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-72 w-full rounded-lg" /></CardContent>
      </Card>
    )
  }

  // Only show chart if there are snapshots with follower data
  const validSnapshots = snapshots.filter((s) => s.followers_count !== null)
  if (validSnapshots.length === 0) return null

  // Build chart data: one row per date, one key per competitor
  const competitorMap = new Map(competitors.map((c) => [c.id, c.username]))

  // Group snapshots by date
  const dateMap = new Map<string, Record<string, number | null>>()
  for (const snap of validSnapshots) {
    const username = competitorMap.get(snap.competitor_id)
    if (!username) continue
    if (!dateMap.has(snap.date)) {
      dateMap.set(snap.date, {})
    }
    dateMap.get(snap.date)![username] = snap.followers_count
  }

  // Sort dates chronologically
  const sortedDates = Array.from(dateMap.keys()).sort()
  const chartData = sortedDates.map((date) => ({
    date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    ...dateMap.get(date),
  }))

  // Get unique usernames that appear in snapshots
  const activeUsernames = Array.from(
    new Set(validSnapshots.map((s) => competitorMap.get(s.competitor_id)).filter(Boolean))
  ) as string[]

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Evolucao de Seguidores</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Comparativo de crescimento dos concorrentes ao longo do tempo
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
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
                tickFormatter={(v) => formatNumber(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(value) => [formatNumber(Number(value)), '']}
                labelFormatter={(label) => `Data: ${String(label)}`}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              />
              {activeUsernames.map((username, i) => (
                <Line
                  key={username}
                  type="monotone"
                  dataKey={username}
                  name={`@${username}`}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
