'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CHART_COLORS } from '@/lib/constants'
import type { InstagramPost } from '@/types/instagram'

interface EngagementChartProps {
  posts: InstagramPost[]
  isLoading?: boolean
}

export default function EngagementChart({ posts, isLoading }: EngagementChartProps) {
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

  if (!posts || posts.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Engajamento por Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-72 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
            Nenhum dado de post disponivel.
          </div>
        </CardContent>
      </Card>
    )
  }

  const weeklyMap = new Map<string, { total: number; count: number }>()

  for (const post of posts) {
    if (!post.timestamp || post.engagement_rate === null) continue
    const date = new Date(post.timestamp)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(date.setDate(diff))
    const key = weekStart.toISOString().split('T')[0]

    const existing = weeklyMap.get(key) ?? { total: 0, count: 0 }
    existing.total += post.engagement_rate
    existing.count++
    weeklyMap.set(key, existing)
  }

  const chartData = Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, { total, count }]) => ({
      semana: new Date(week).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      engagement: Number((total / count).toFixed(2)),
    }))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Engajamento Medio por Semana</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Taxa media de engagement dos posts</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientEngagement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.secondary} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={CHART_COLORS.secondary} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="semana"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
                formatter={(value) => [`${value}%`, 'Engagement Rate']}
                labelFormatter={(label) => `Semana: ${label}`}
              />
              <Bar
                dataKey="engagement"
                fill="url(#gradientEngagement)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
