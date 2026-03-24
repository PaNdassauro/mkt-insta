'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AudienceSnapshot, InstagramPost } from '@/types/instagram'

interface HeatmapPostingTimeProps {
  audience: AudienceSnapshot | null
  posts: InstagramPost[]
  isLoading?: boolean
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function getIntensityColor(value: number, max: number): string {
  if (max === 0) return 'bg-muted/30'
  const ratio = value / max
  if (ratio >= 0.8) return 'bg-indigo-600 text-white'
  if (ratio >= 0.6) return 'bg-indigo-500 text-white'
  if (ratio >= 0.4) return 'bg-indigo-400 text-white'
  if (ratio >= 0.2) return 'bg-indigo-200 text-indigo-900'
  if (ratio > 0) return 'bg-indigo-100 text-indigo-700'
  return 'bg-muted/30 text-muted-foreground'
}

export default function HeatmapPostingTime({ audience, posts, isLoading }: HeatmapPostingTimeProps) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-6 w-64" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full rounded-lg" /></CardContent>
      </Card>
    )
  }

  // Construir heatmap baseado em posts publicados (engagement por hora/dia)
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  const gridCount: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))

  for (const post of posts) {
    if (!post.timestamp || post.engagement_rate === null) continue
    const date = new Date(post.timestamp)
    const dayIndex = (date.getDay() + 6) % 7 // Segunda = 0
    const hour = date.getHours()
    grid[dayIndex][hour] += post.engagement_rate
    gridCount[dayIndex][hour]++
  }

  // Media de engagement por slot
  const avgGrid: number[][] = grid.map((row, d) =>
    row.map((val, h) => gridCount[d][h] > 0 ? val / gridCount[d][h] : 0)
  )

  // Se tem dados de audiencia, ponderar com active_hours
  if (audience?.active_hours) {
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const audienceWeight = audience.active_hours[String(h)] ?? 0
        const maxAudience = Math.max(...Object.values(audience.active_hours))
        const normalizedWeight = maxAudience > 0 ? audienceWeight / maxAudience : 0
        // Combinar: 60% engagement historico + 40% audiencia ativa
        avgGrid[d][h] = avgGrid[d][h] * 0.6 + normalizedWeight * 10 * 0.4
      }
    }
  }

  const maxVal = Math.max(...avgGrid.flat())

  // Top 3 melhores slots
  const slots: { day: number; hour: number; score: number }[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (avgGrid[d][h] > 0) slots.push({ day: d, hour: h, score: avgGrid[d][h] })
    }
  }
  slots.sort((a, b) => b.score - a.score)
  const top3 = slots.slice(0, 3)

  const hasData = posts.some(p => p.timestamp && p.engagement_rate !== null)

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Melhor Horario para Postar</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Baseado no engagement historico {audience ? '+ audiencia ativa' : ''}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
            Dados insuficientes para gerar o heatmap.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top 3 recomendacoes */}
            {top3.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {top3.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-indigo-900">
                      {DAYS[slot.day]} as {String(slot.hour).padStart(2, '0')}h
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                {/* Header horas */}
                <div className="flex">
                  <div className="w-10 shrink-0" />
                  {HOURS.filter((h) => h % 2 === 0).map((h) => (
                    <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground pb-1">
                      {String(h).padStart(2, '0')}h
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {DAYS.map((day, d) => (
                  <div key={day} className="flex items-center gap-0.5 mb-0.5">
                    <div className="w-10 shrink-0 text-[11px] font-medium text-muted-foreground">
                      {day}
                    </div>
                    {HOURS.map((h) => {
                      const isTop = top3.some((s) => s.day === d && s.hour === h)
                      return (
                        <div
                          key={h}
                          title={`${day} ${String(h).padStart(2, '0')}h — Score: ${avgGrid[d][h].toFixed(1)}`}
                          className={`flex-1 h-7 rounded-sm transition-all hover:ring-2 hover:ring-primary/30 ${getIntensityColor(avgGrid[d][h], maxVal)} ${isTop ? 'ring-2 ring-indigo-600' : ''}`}
                        />
                      )
                    })}
                  </div>
                ))}
                {/* Legenda */}
                <div className="mt-3 flex items-center justify-end gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Menos</span>
                  {['bg-muted/30', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-400', 'bg-indigo-500', 'bg-indigo-600'].map((color) => (
                    <div key={color} className={`h-3 w-5 rounded-sm ${color}`} />
                  ))}
                  <span className="text-[10px] text-muted-foreground">Mais</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
