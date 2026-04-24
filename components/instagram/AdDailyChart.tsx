'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/analytics'
import type { AdDailyPoint } from '@/lib/meta-ads-client'

interface Props {
  data: AdDailyPoint[]
  since: string // YYYY-MM-DD
  until: string // YYYY-MM-DD
  isLoading?: boolean
}

const SPEND_COLOR = '#4F46E5' // indigo
const REACH_COLOR = '#06B6D4' // cyan
const IMPRESSIONS_COLOR = '#10B981' // emerald

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Add 1 day to a YYYY-MM-DD string without touching JS Date's timezone trap. */
function nextDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const ts = Date.UTC(y, m - 1, d) + 86_400_000
  const dt = new Date(ts)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Gap-fill days with zero so the chart x-axis is continuous. */
function fillDays(
  data: AdDailyPoint[],
  since: string,
  until: string
): AdDailyPoint[] {
  const byDate = new Map<string, AdDailyPoint>()
  for (const p of data) byDate.set(p.date, p)

  const out: AdDailyPoint[] = []
  let cursor = since
  let guard = 0
  while (cursor <= until && guard < 400) {
    out.push(
      byDate.get(cursor) ?? {
        date: cursor,
        spend: 0,
        reach: 0,
        impressions: 0,
      }
    )
    cursor = nextDay(cursor)
    guard++
  }
  return out
}

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return `${d}/${m}`
}

export default function AdDailyChart({ data, since, until, isLoading }: Props) {
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

  const hasAnyValue = data.some(
    (p) => p.spend > 0 || p.reach > 0 || p.impressions > 0
  )

  const filled = fillDays(data, since, until)
  const chartData = filled.map((p) => ({
    date: p.date,
    label: shortDate(p.date),
    spend: p.spend,
    reach: p.reach,
    impressions: p.impressions,
  }))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Desempenho diario</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Gasto, alcance e impressoes por dia ({since} → {until})
        </p>
      </CardHeader>
      <CardContent>
        {!hasAnyValue ? (
          <div className="flex h-72 flex-col items-center justify-center rounded-lg bg-muted/30 text-center">
            <p className="text-2xl mb-2">📊</p>
            <p className="text-sm text-muted-foreground">Sem dados neste periodo.</p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="adDailySpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SPEND_COLOR} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={SPEND_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="adDailyReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={REACH_COLOR} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={REACH_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="adDailyImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={IMPRESSIONS_COLOR} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={IMPRESSIONS_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatBRL(Number(v))}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatNumber(Number(v))}
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
                  formatter={(value, name) => {
                    const n = Number(value)
                    if (name === 'spend') return [formatBRL(n), 'Gasto']
                    if (name === 'reach') return [formatNumber(n), 'Alcance']
                    if (name === 'impressions') return [formatNumber(n), 'Impressoes']
                    return [String(value ?? ''), String(name ?? '')]
                  }}
                  labelFormatter={(label) => `Dia: ${label}`}
                />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) => {
                    if (value === 'spend') return 'Gasto'
                    if (value === 'reach') return 'Alcance'
                    if (value === 'impressions') return 'Impressoes'
                    return value
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="spend"
                  stroke={SPEND_COLOR}
                  fill="url(#adDailySpend)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="reach"
                  stroke={REACH_COLOR}
                  fill="url(#adDailyReach)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="impressions"
                  stroke={IMPRESSIONS_COLOR}
                  fill="url(#adDailyImpressions)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
