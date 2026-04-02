'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EditorialEntry, ContentType, CalendarStatus } from '@/types/instagram'

const CONTENT_TYPES: { value: ContentType; label: string; icon: string }[] = [
  { value: 'REEL', label: 'Reel', icon: '🎬' },
  { value: 'CAROUSEL', label: 'Carrossel', icon: '📸' },
  { value: 'IMAGE', label: 'Foto', icon: '🖼' },
  { value: 'STORY', label: 'Story', icon: '⏳' },
]

const STATUS_CONFIG: Record<CalendarStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  APPROVED: { label: 'Aprovado', color: 'bg-blue-50 text-blue-700' },
  PUBLISHED: { label: 'Publicado', color: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-50 text-red-500' },
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

export default function EditorialCalendar() {
  const router = useRouter()
  const [entries, setEntries] = useState<EditorialEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [showForm, setShowForm] = useState(false)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    scheduled_for: '',
    content_type: 'REEL' as ContentType,
    topic: '',
    caption_draft: '',
    recurrence: '' as '' | 'weekly' | 'biweekly' | 'monthly',
    recurrence_end: '',
  })

  const fetchEntries = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchWithAccount(`/api/instagram/calendar?month=${currentMonth}`, { cache: 'no-store' })
      const json = await res.json()
      setEntries(json.data ?? [])
    } catch { toast.error('Erro ao carregar calendario') }
    finally { setIsLoading(false) }
  }, [currentMonth])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const addEntry = async () => {
    if (!form.scheduled_for) {
      toast.error('Selecione uma data e hora para o agendamento')
      return
    }
    const scheduledDate = new Date(form.scheduled_for)
    if (scheduledDate <= new Date()) {
      toast.error('A data de agendamento deve ser no futuro')
      return
    }
    if (!form.content_type) {
      toast.error('Selecione o tipo de conteudo')
      return
    }
    try {
      const payload: Record<string, unknown> = {
        scheduled_for: form.scheduled_for,
        content_type: form.content_type,
        topic: form.topic,
        caption_draft: form.caption_draft,
      }
      if (form.recurrence) {
        payload.recurrence = form.recurrence
        if (form.recurrence_end) payload.recurrence_end = form.recurrence_end
      }
      await fetchWithAccount('/api/instagram/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setForm({ scheduled_for: '', content_type: 'REEL', topic: '', caption_draft: '', recurrence: '', recurrence_end: '' })
      setShowForm(false)
      await fetchEntries()
    } catch { toast.error('Erro na operacao') }
  }

  const updateStatus = async (id: string, status: CalendarStatus) => {
    try {
      await fetchWithAccount('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await fetchEntries()
    } catch { toast.error('Erro na operacao') }
  }

  const deleteEntry = async (id: string) => {
    if (!confirm('Excluir esta entrada do calendario?')) return
    try {
      const res = await fetchWithAccount(`/api/instagram/calendar?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Entrada excluida')
        await fetchEntries()
      } else {
        const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
        toast.error(`Erro ao excluir: ${data.error}`)
      }
    } catch { toast.error('Erro de conexao ao excluir') }
  }

  const setMediaUrl = async (id: string) => {
    const url = prompt('Cole a URL publica da imagem ou video:')
    if (!url) return
    try {
      await fetchWithAccount('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, media_url: url }),
      })
      await fetchEntries()
    } catch { toast.error('Erro na operacao') }
  }

  const toggleAutoPublish = async (entry: EditorialEntry) => {
    try {
      await fetchWithAccount('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, auto_publish: !entry.auto_publish }),
      })
      await fetchEntries()
    } catch { toast.error('Erro na operacao') }
  }

  const publishEntry = async (entry: EditorialEntry) => {
    if (!entry.media_url && !entry.carousel_urls?.length) {
      const url = prompt('Cole a URL publica da imagem ou video para publicar:')
      if (!url) return
      await fetchWithAccount('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, media_url: url }),
      })
    }
    if (!confirm('Publicar este post no Instagram da @welcomeweddings?')) return

    setPublishingId(entry.id)
    try {
      const res = await fetchWithAccount('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarEntryId: entry.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(`Erro ao publicar: ${json.error}`)
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

  // Navegar meses
  const changeMonth = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // Gerar grid do calendario
  const [year, month] = currentMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDow = firstDay.getDay()
  const monthLabel = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const calendarDays: (number | null)[] = []
  for (let i = 0; i < startDow; i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d)

  const getEntriesForDay = (day: number) =>
    entries.filter((e) => {
      if (!e.scheduled_for) return false
      const d = new Date(e.scheduled_for)
      return d.getDate() === day && d.getMonth() === month - 1 && d.getFullYear() === year
    })

  return (
    <div className="space-y-6">
      {/* Header com navegacao */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => changeMonth(-1)} className="rounded-lg p-2 hover:bg-muted transition-colors text-lg" aria-label="Mes anterior">←</button>
          <h2 className="text-lg font-semibold capitalize min-w-[200px] text-center">{monthLabel}</h2>
          <button onClick={() => changeMonth(1)} className="rounded-lg p-2 hover:bg-muted transition-colors text-lg" aria-label="Proximo mes">→</button>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="h-9">
          {showForm ? 'Cancelar' : '+ Novo conteudo'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data/Hora</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_for}
                  onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                <Select value={form.content_type} onValueChange={(v) => { if (v) setForm({ ...form, content_type: v as ContentType }) }}>
                  <SelectTrigger className="h-9 text-sm border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tema</label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  placeholder="Ex: Casamento em Toscana"
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Recorrencia</label>
                <Select value={form.recurrence || 'none'} onValueChange={(v) => setForm({ ...form, recurrence: v === 'none' ? '' : v as 'weekly' | 'biweekly' | 'monthly', recurrence_end: v === 'none' ? '' : form.recurrence_end })}>
                  <SelectTrigger className="h-9 text-sm border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unica vez</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.recurrence && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim da recorrencia</label>
                  <input
                    type="date"
                    value={form.recurrence_end}
                    onChange={(e) => setForm({ ...form, recurrence_end: e.target.value })}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
              <div className="flex items-end">
                <Button onClick={addEntry} size="sm" className="h-9 w-full" disabled={!form.scheduled_for}>
                  Adicionar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendario grid */}
      {isLoading ? (
        <div role="status" aria-label="Carregando calendario">
          <span className="sr-only">Carregando calendario...</span>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Dias da semana */}
            <div className="grid grid-cols-7 border-b bg-muted/30">
              {DAYS.map((d) => (
                <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const dayEntries = day ? getEntriesForDay(day) : []
                const isToday = day === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear()
                return (
                  <div
                    key={i}
                    className={`min-h-[100px] border-b border-r p-1.5 ${
                      day ? 'bg-background' : 'bg-muted/20'
                    } ${isToday ? 'ring-2 ring-inset ring-primary/30' : ''}`}
                  >
                    {day && (
                      <>
                        <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {dayEntries.map((entry) => {
                            const typeConfig = CONTENT_TYPES.find((t) => t.value === entry.content_type)
                            const statusConfig = STATUS_CONFIG[entry.status]
                            return (
                              <div
                                key={entry.id}
                                onClick={() => router.push(`/dashboard/instagram/calendar/${entry.id}`)}
                                className="group relative rounded-md bg-muted/50 px-1.5 py-1 hover:bg-muted transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px]">{typeConfig?.icon}</span>
                                  <span className="text-[10px] font-medium truncate flex-1">
                                    {entry.topic || typeConfig?.label}
                                  </span>
                                </div>
                                <Badge className={`${statusConfig.color} border-0 text-[8px] px-1 py-0 mt-0.5`} aria-label={`Status: ${statusConfig.label}`}>
                                  {statusConfig.label}
                                </Badge>
                                {/* Actions on hover */}
                                {entry.publish_error && (
                                  <div className="text-[8px] text-red-500 mt-0.5 truncate" title={entry.publish_error}>
                                    Erro: {entry.publish_error.substring(0, 30)}...
                                  </div>
                                )}
                                {entry.media_url && (
                                  <div className="text-[8px] text-emerald-600 mt-0.5">📎 Midia</div>
                                )}
                                {entry.auto_publish && entry.status === 'APPROVED' && (
                                  <div className="text-[8px] text-indigo-500 mt-0.5">⏰ Auto</div>
                                )}
                                {entry.collaborators?.length ? (
                                  <div className="text-[8px] text-blue-500 mt-0.5">👥 Collab</div>
                                ) : null}
                                {/* Actions on hover */}
                                <div className="absolute right-0.5 top-0.5 hidden gap-0.5 group-hover:flex">
                                  {entry.status === 'DRAFT' && (
                                    <button
                                      onClick={() => updateStatus(entry.id, 'APPROVED')}
                                      className="rounded bg-blue-500 px-1 py-0.5 text-[8px] text-white"
                                      title="Aprovar"
                                      aria-label="Aprovar conteudo"
                                    >✓</button>
                                  )}
                                  {entry.status === 'APPROVED' && (
                                    <button
                                      onClick={() => setMediaUrl(entry.id)}
                                      className="rounded bg-gray-500 px-1 py-0.5 text-[8px] text-white"
                                      title="Adicionar URL de midia"
                                      aria-label="Adicionar URL de midia"
                                    >📎</button>
                                  )}
                                  {entry.status === 'APPROVED' && (
                                    <button
                                      onClick={() => toggleAutoPublish(entry)}
                                      className={`rounded px-1 py-0.5 text-[8px] text-white ${entry.auto_publish ? 'bg-indigo-500' : 'bg-gray-400'}`}
                                      title={entry.auto_publish ? 'Desativar auto-publish' : 'Ativar auto-publish'}
                                      aria-label={entry.auto_publish ? 'Desativar auto-publish' : 'Ativar auto-publish'}
                                    >⏰</button>
                                  )}
                                  {entry.status === 'APPROVED' && (
                                    <button
                                      onClick={() => publishEntry(entry)}
                                      disabled={publishingId === entry.id}
                                      className="rounded bg-emerald-500 px-1 py-0.5 text-[8px] text-white disabled:opacity-50"
                                      title="Publicar no Instagram agora"
                                      aria-label="Publicar no Instagram agora"
                                    >{publishingId === entry.id ? '...' : '▶'}</button>
                                  )}
                                  <button
                                    onClick={() => deleteEntry(entry.id)}
                                    className="rounded bg-red-500 px-1 py-0.5 text-[8px] text-white"
                                    title="Remover"
                                    aria-label="Remover conteudo"
                                  >✕</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty month message */}
      {!isLoading && entries.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border/60 p-8 text-center">
          <p className="text-2xl mb-2">📅</p>
          <p className="text-sm font-medium text-muted-foreground">Nenhum conteudo agendado para este mes.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Clique em &quot;+ Novo conteudo&quot; para planejar suas publicacoes.</p>
          <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
            + Novo conteudo
          </Button>
        </div>
      )}

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <Badge className={`${config.color} border-0 text-[10px]`}>{config.label}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}
