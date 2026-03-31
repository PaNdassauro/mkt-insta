'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { EditorialEntry, CalendarStatus } from '@/types/instagram'

const STATUS_CONFIG: Record<CalendarStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  APPROVED: { label: 'Aprovado', color: 'bg-blue-50 text-blue-700' },
  PUBLISHED: { label: 'Publicado', color: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-50 text-red-500' },
}

const FORMAT_ICON: Record<string, string> = {
  REEL: '🎬',
  CAROUSEL: '📸',
  IMAGE: '🖼',
  STORY: '⏳',
}

export default function CalendarTable() {
  const router = useRouter()
  const [entries, setEntries] = useState<EditorialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | CalendarStatus>('all')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/instagram/calendar?month=${currentMonth}`, { cache: 'no-store' })
      const json = await res.json()
      setEntries(json.data ?? [])
    } catch { toast.error('Erro ao carregar calendario') }
    finally { setLoading(false) }
  }, [currentMonth])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  async function deleteEntry(id: string) {
    if (!confirm('Excluir esta entrada?')) return
    try {
      const res = await fetch(`/api/instagram/calendar?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Entrada excluida')
        await fetchEntries()
      } else {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        toast.error(`Erro: ${data.error}`)
      }
    } catch { toast.error('Erro de conexao') }
  }

  async function updateStatus(id: string, status: CalendarStatus) {
    try {
      await fetch('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await fetchEntries()
    } catch { toast.error('Erro ao atualizar') }
  }

  function changeMonth(delta: number) {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter)

  const [year, month] = currentMonth.split('-').map(Number)
  const monthName = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Month nav + filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={() => changeMonth(-1)} aria-label="Mes anterior">&larr;</Button>
          <span className="text-sm font-semibold capitalize min-w-[160px] text-center">{monthName}</span>
          <Button size="sm" variant="ghost" onClick={() => changeMonth(1)} aria-label="Proximo mes">&rarr;</Button>
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit" role="group" aria-label="Filtros de status">
          {([['all', 'Todos'], ['DRAFT', 'Rascunho'], ['APPROVED', 'Aprovado'], ['PUBLISHED', 'Publicado'], ['CANCELLED', 'Cancelado']] as const).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? 'default' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setFilter(value as typeof filter)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma entrada encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Formato</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Conteudo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Midia</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((entry) => {
                  const statusCfg = STATUS_CONFIG[entry.status as CalendarStatus] ?? STATUS_CONFIG.DRAFT
                  const date = new Date(entry.scheduled_for ?? new Date())
                  const icon = FORMAT_ICON[entry.content_type ?? 'IMAGE'] ?? '📄'

                  return (
                    <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium">
                          {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                          {' '}
                          {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-base" aria-hidden="true">{icon}</span>
                        <span className="ml-1 text-xs">{entry.content_type}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[300px]">
                        {entry.topic && (
                          <p className="text-sm font-medium truncate">{entry.topic}</p>
                        )}
                        {entry.caption_draft && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.caption_draft}</p>
                        )}
                        {!entry.topic && !entry.caption_draft && (
                          <span className="text-xs text-muted-foreground italic">Sem conteudo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${statusCfg.color} border-0`}>
                          {statusCfg.label}
                        </Badge>
                        {entry.publish_error && (
                          <p className="text-[10px] text-red-500 mt-0.5 truncate max-w-[120px]" title={entry.publish_error}>
                            Erro: {entry.publish_error}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.media_url ? (
                          <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-600">
                            Com midia
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => router.push(`/dashboard/instagram/calendar/${entry.id}`)}
                          >
                            Editar
                          </Button>
                          {entry.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-blue-600"
                              onClick={() => updateStatus(entry.id, 'APPROVED')}
                            >
                              Aprovar
                            </Button>
                          )}
                          {entry.status === 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-yellow-600"
                              onClick={() => updateStatus(entry.id, 'DRAFT')}
                            >
                              Rascunho
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-500"
                            onClick={() => deleteEntry(entry.id)}
                            aria-label={`Excluir entrada de ${entry.topic ?? 'sem titulo'}`}
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Summary */}
          <div className="px-4 py-3 border-t bg-muted/10 text-xs text-muted-foreground flex gap-4">
            <span>{filtered.length} entradas</span>
            <span>{filtered.filter((e) => e.status === 'DRAFT').length} rascunhos</span>
            <span>{filtered.filter((e) => e.status === 'APPROVED').length} aprovados</span>
            <span>{filtered.filter((e) => e.status === 'PUBLISHED').length} publicados</span>
          </div>
        </Card>
      )}
    </div>
  )
}
