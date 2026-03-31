'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ActivityEntry {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ENTITY_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'campaign', label: 'Campanha' },
  { value: 'post', label: 'Post' },
  { value: 'calendar', label: 'Calendario' },
  { value: 'settings', label: 'Config' },
]

const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '30', label: 'Ultimos 30 dias' },
  { value: '90', label: 'Ultimos 90 dias' },
]

const PAGE_SIZE = 50

function getActionIcon(action: string): string {
  if (action.startsWith('campaign.created')) return '🚀'
  if (action.startsWith('campaign.approved')) return '✅'
  if (action.startsWith('campaign.scheduled')) return '📅'
  if (action.startsWith('post.updated')) return '✏️'
  if (action.startsWith('post.approved')) return '👍'
  if (action.startsWith('settings')) return '⚙️'
  if (action.startsWith('user')) return '👤'
  return '📋'
}

function getActionDescription(entry: ActivityEntry): string {
  const details = entry.details ?? {}
  const title = (details.title as string) ?? ''
  const count = details.count as number | undefined

  switch (entry.action) {
    case 'campaign.created':
      return title ? `criou campanha "${title}"` : 'criou uma campanha'
    case 'campaign.approved':
      return title
        ? `aprovou campanha "${title}" (${count ?? 0} posts)`
        : 'aprovou uma campanha'
    case 'campaign.scheduled':
      return title
        ? `agendou campanha "${title}" (${count ?? 0} posts)`
        : 'agendou uma campanha'
    case 'post.updated':
      return `editou post #${entry.entity_id?.substring(0, 8) ?? '?'}`
    case 'post.approved':
      return `aprovou post #${entry.entity_id?.substring(0, 8) ?? '?'}`
    case 'settings.updated':
      return 'atualizou configuracoes'
    case 'user.login':
      return 'fez login'
    default:
      return entry.action
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `ha ${diffMin} min`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `ha ${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'ha 1 dia'
  if (diffDays < 30) return `ha ${diffDays} dias`

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return 'ha 1 mes'
  return `ha ${diffMonths} meses`
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [entityFilter, setEntityFilter] = useState('all')
  const [dateRange, setDateRange] = useState('30')
  const [offset, setOffset] = useState(0)

  const fetchActivities = useCallback(
    async (currentOffset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      try {
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - parseInt(dateRange, 10))
        const since = sinceDate.toISOString().split('T')[0]

        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
          since,
        })

        if (entityFilter !== 'all') {
          params.set('entity_type', entityFilter)
        }

        const res = await fetchWithAccount(`/api/settings/activity?${params}`)
        if (!res.ok) throw new Error('Falha ao carregar atividades')

        const data = await res.json()

        if (append) {
          setEntries((prev) => [...prev, ...data.items])
        } else {
          setEntries(data.items)
        }
        setTotal(data.total)
      } catch {
        toast.error('Erro ao carregar log de atividades')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [entityFilter, dateRange]
  )

  useEffect(() => {
    setOffset(0)
    fetchActivities(0, false)
  }, [fetchActivities])

  function handleLoadMore() {
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    fetchActivities(newOffset, true)
  }

  const hasMore = entries.length < total

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log de Atividades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historico de acoes realizadas no DashIG
          </p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log de Atividades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historico de acoes realizadas no DashIG
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de entidade" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="h-10 px-3 flex items-center">
          {total} {total === 1 ? 'registro' : 'registros'}
        </Badge>
      </div>

      {/* Lista de atividades */}
      {entries.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg font-medium text-muted-foreground">
              Nenhuma atividade encontrada
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              As acoes realizadas no DashIG aparecerrao aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <span className="text-xl mt-0.5 shrink-0">
                  {getActionIcon(entry.action)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {entry.user_email ?? 'Sistema'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {getActionDescription(entry)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(entry.created_at)}
                    </span>
                    {entry.entity_type && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {entry.entity_type}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Carregar mais */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Carregando...' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  )
}
