'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ActivityLogRow } from '@/lib/activity-queries'

interface Props {
  history: ActivityLogRow[]
  isLoading?: boolean
}

const ACTION_LABEL: Record<string, string> = {
  'instagram.ad.active': 'Reativou o anuncio',
  'instagram.ad.paused': 'Pausou o anuncio',
  'instagram.ad.deleted': 'Excluiu o anuncio',
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  PAUSED: 'bg-gray-100 text-gray-700',
  DELETED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-red-50 text-red-700',
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function describeAction(row: ActivityLogRow): string {
  const label = ACTION_LABEL[row.action]
  if (label) return label
  // Fallback: render the raw action verb (e.g. "instagram.ad.foo" → "foo")
  const parts = row.action.split('.')
  return parts[parts.length - 1] ?? row.action
}

function extractStatus(row: ActivityLogRow): string | null {
  const details = row.details
  if (!details || typeof details !== 'object') return null
  const status = (details as Record<string, unknown>).effective_status ??
    (details as Record<string, unknown>).status
  return typeof status === 'string' ? status : null
}

export default function AdActivityHistory({ history, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Historico de alteracoes</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Mudancas feitas por esta ferramenta (nao inclui alteracoes feitas direto no Ads Manager).
        </p>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Nenhuma alteracao registrada.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((row) => {
              const status = extractStatus(row)
              const statusClass = status ? STATUS_STYLES[status] : null
              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{describeAction(row)}</span>
                      {status && (
                        <Badge
                          className={cn(
                            'border-0 text-[10px] font-medium',
                            statusClass ?? 'bg-muted text-muted-foreground'
                          )}
                        >
                          {status}
                        </Badge>
                      )}
                    </div>
                    {row.user_email && (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">
                        {row.user_email}
                      </div>
                    )}
                  </div>
                  <div className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatTimestamp(row.created_at)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
