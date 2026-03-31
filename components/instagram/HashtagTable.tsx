'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent } from '@/lib/analytics'

interface HashtagData {
  hashtag: string
  count: number
  avg_reach: number
  avg_engagement: number
  trend: number
  impact: number
}

export default function HashtagTable() {
  const [hashtags, setHashtags] = useState<HashtagData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortField, setSortField] = useState<keyof HashtagData>('impact')

  useEffect(() => {
    fetchWithAccount('/api/instagram/hashtags')
      .then((r) => r.json())
      .then((json) => setHashtags(json.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-64 w-full rounded-lg" /></CardContent>
      </Card>
    )
  }

  const sorted = [...hashtags].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    if (typeof aVal === 'number' && typeof bVal === 'number') return bVal - aVal
    return 0
  })

  const sortableHeader = (field: keyof HashtagData, label: string) => (
    <button
      onClick={() => setSortField(field)}
      className={`text-left font-medium transition-colors hover:text-foreground ${
        sortField === field ? 'text-primary' : ''
      }`}
    >
      {label} {sortField === field && '↓'}
    </button>
  )

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Hashtag Intelligence</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Performance agregada por hashtag — ordenado por impacto estimado
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {hashtags.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">
            Nenhuma hashtag encontrada nos posts. Verifique se os posts possuem hashtags nas legendas.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[200px]">Hashtag</TableHead>
                  <TableHead>{sortableHeader('count', 'Uso')}</TableHead>
                  <TableHead>{sortableHeader('avg_reach', 'Alcance medio')}</TableHead>
                  <TableHead>{sortableHeader('avg_engagement', 'Engage medio')}</TableHead>
                  <TableHead>{sortableHeader('trend', 'Trend 4sem')}</TableHead>
                  <TableHead>{sortableHeader('impact', 'Impacto')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 50).map((h, i) => (
                  <TableRow key={h.hashtag}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="font-medium text-sm">#{h.hashtag}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {h.count}x
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{formatNumber(h.avg_reach)}</TableCell>
                    <TableCell className="font-medium">{formatPercent(h.avg_engagement)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                        h.trend > 0 ? 'text-emerald-600' : h.trend < 0 ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {h.trend > 0 ? '↑' : h.trend < 0 ? '↓' : '→'}
                        {Math.abs(h.trend)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden max-w-[80px]">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.min((h.impact / (sorted[0]?.impact || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{formatNumber(h.impact)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
