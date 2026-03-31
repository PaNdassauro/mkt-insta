'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import dynamic from 'next/dynamic'

const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
)
const AreaChart = dynamic(
  () => import('recharts').then((m) => m.AreaChart),
  { ssr: false }
)
const Area = dynamic(
  () => import('recharts').then((m) => m.Area),
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
const Tooltip = dynamic(
  () => import('recharts').then((m) => m.Tooltip),
  { ssr: false }
)

interface SentimentData {
  series: Array<{
    week: string
    POSITIVE: number
    NEUTRAL: number
    NEGATIVE: number
    QUESTION: number
  }>
  totals: {
    POSITIVE: number
    NEUTRAL: number
    NEGATIVE: number
    QUESTION: number
  }
}

const SENTIMENT_COLORS = {
  POSITIVE: '#22c55e',
  NEUTRAL: '#94a3b8',
  NEGATIVE: '#ef4444',
  QUESTION: '#3b82f6',
}

const SENTIMENT_LABELS: Record<string, string> = {
  POSITIVE: 'Positivo',
  NEUTRAL: 'Neutro',
  NEGATIVE: 'Negativo',
  QUESTION: 'Pergunta',
}

export default function SentimentChart() {
  const [data, setData] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/instagram/comments/sentiment')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (!data || data.series.length === 0) return null

  const total = Object.values(data.totals).reduce((a, b) => a + b, 0)

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Sentimento (ultimos 3 meses)</h3>
          <div className="flex gap-3">
            {Object.entries(data.totals).map(([key, count]) => (
              <div key={key} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: SENTIMENT_COLORS[key as keyof typeof SENTIMENT_COLORS] }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {SENTIMENT_LABELS[key]} {total > 0 ? Math.round((count / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data.series}>
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: string) => {
                const d = new Date(v)
                return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              }}
            />
            <YAxis tick={{ fontSize: 10 }} width={30} />
            <Tooltip
              labelFormatter={(v) => {
                const d = new Date(String(v))
                return `Semana de ${d.toLocaleDateString('pt-BR')}`
              }}
              formatter={(value, name) => [Number(value), SENTIMENT_LABELS[String(name)] ?? name]}
            />
            <Area
              type="monotone"
              dataKey="POSITIVE"
              stackId="1"
              stroke={SENTIMENT_COLORS.POSITIVE}
              fill={SENTIMENT_COLORS.POSITIVE}
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="NEUTRAL"
              stackId="1"
              stroke={SENTIMENT_COLORS.NEUTRAL}
              fill={SENTIMENT_COLORS.NEUTRAL}
              fillOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="QUESTION"
              stackId="1"
              stroke={SENTIMENT_COLORS.QUESTION}
              fill={SENTIMENT_COLORS.QUESTION}
              fillOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="NEGATIVE"
              stackId="1"
              stroke={SENTIMENT_COLORS.NEGATIVE}
              fill={SENTIMENT_COLORS.NEGATIVE}
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
