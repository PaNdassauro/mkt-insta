'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import PublishBoostModal from '@/components/instagram/PublishBoostModal'
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
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [publishBoostId, setPublishBoostId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAccount(`/api/instagram/calendar?month=${currentMonth}`, { cache: 'no-store' })
      const json = await res.json()
      setEntries(json.data ?? [])
    } catch { toast.error('Erro ao carregar calendario') }
    finally { setLoading(false) }
  }, [currentMonth])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Clear selection on filter or month change
  useEffect(() => { setSelectedIds(new Set()) }, [filter, currentMonth])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)))
    }
  }

  async function bulkApprove() {
    for (const id of Array.from(selectedIds)) {
      await fetchWithAccount('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'APPROVED' }),
      })
    }
    toast.success(`${selectedIds.size} entradas aprovadas`)
    setSelectedIds(new Set())
    await fetchEntries()
  }

  async function bulkDelete() {
    if (!confirm(`Excluir ${selectedIds.size} entradas? Esta acao nao pode ser desfeita.`)) return
    for (const id of Array.from(selectedIds)) {
      await fetchWithAccount(`/api/instagram/calendar?id=${id}`, { method: 'DELETE' })
    }
    toast.success(`${selectedIds.size} entradas excluidas`)
    setSelectedIds(new Set())
    await fetchEntries()
  }

  async function deleteEntry(id: string) {
    if (!confirm('Excluir esta entrada?')) return
    try {
      const res = await fetchWithAccount(`/api/instagram/calendar?id=${id}`, { method: 'DELETE' })
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
      await fetchWithAccount('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await fetchEntries()
    } catch { toast.error('Erro ao atualizar') }
  }

  async function publishEntry(id: string) {
    if (!confirm('Publicar este conteudo agora no Instagram?')) return
    setPublishingId(id)
    try {
      const res = await fetchWithAccount('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarEntryId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(`Erro ao publicar: ${data.error}`)
      } else {
        toast.success('Publicado no Instagram!')
      }
      await fetchEntries()
    } catch {
      toast.error('Erro de conexao ao publicar')
    } finally {
      setPublishingId(null)
    }
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
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-full sm:w-fit overflow-x-auto" role="group" aria-label="Filtros de status">
          {([['all', 'Todos'], ['DRAFT', 'Rascunho'], ['APPROVED', 'Aprovado'], ['PUBLISHED', 'Publicado'], ['CANCELLED', 'Cancelado']] as const).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? 'default' : 'ghost'}
              className="h-7 text-xs shrink-0"
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
          {selectedIds.size > 0 && (
            <div className="sticky top-0 z-10 bg-primary/10 px-4 py-2 flex items-center gap-3 border-b">
              <span className="text-sm font-medium">{selectedIds.size} selecionados</span>
              <Button size="sm" className="h-7 text-xs" onClick={bulkApprove}>
                Aprovar todos
              </Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={bulkDelete}>
                Excluir todos
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                Cancelar selecao
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-10 px-2 py-3">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                      className="rounded border-muted-foreground"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Formato</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Conteudo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Midia</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((entry) => {
                  const statusCfg = STATUS_CONFIG[entry.status as CalendarStatus] ?? STATUS_CONFIG.DRAFT
                  const date = new Date(entry.scheduled_for ?? new Date())
                  const icon = FORMAT_ICON[entry.content_type ?? 'IMAGE'] ?? '📄'

                  return (
                    <tr key={entry.id} className={`hover:bg-muted/20 transition-colors ${selectedIds.has(entry.id) ? 'bg-primary/5' : ''}`}>
                      <td className="w-10 px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          aria-label={`Selecionar entrada de ${entry.topic ?? 'sem titulo'}`}
                          className="rounded border-muted-foreground"
                        />
                      </td>
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
                      <td className="px-4 py-3 hidden md:table-cell">
                        {entry.media_url ? (
                          <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-600">
                            Com midia
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap gap-1 justify-end">
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
                          {entry.status === 'APPROVED' && (entry.media_url || (entry.carousel_urls && entry.carousel_urls.length > 0)) && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-emerald-600"
                                onClick={() => publishEntry(entry.id)}
                                disabled={publishingId === entry.id}
                              >
                                {publishingId === entry.id ? 'Publicando...' : 'Publicar'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-indigo-600"
                                onClick={() => setPublishBoostId(entry.id)}
                                title="Publicar no Instagram e criar campanha no Meta Ads em seguida"
                              >
                                Publicar + Impulsionar
                              </Button>
                            </>
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
          <div className="px-4 py-3 border-t bg-muted/10 text-xs text-muted-foreground flex flex-wrap gap-2 sm:gap-4">
            <span>{filtered.length} entradas</span>
            <span>{filtered.filter((e) => e.status === 'DRAFT').length} rascunhos</span>
            <span>{filtered.filter((e) => e.status === 'APPROVED').length} aprovados</span>
            <span>{filtered.filter((e) => e.status === 'PUBLISHED').length} publicados</span>
          </div>
        </Card>
      )}

      {publishBoostId && (
        <PublishBoostModal
          calendarEntryId={publishBoostId}
          open={Boolean(publishBoostId)}
          onOpenChange={(open) => {
            if (!open) setPublishBoostId(null)
          }}
          onSuccess={() => fetchEntries()}
        />
      )}
    </div>
  )
}
