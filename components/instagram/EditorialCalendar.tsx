'use client'

import { useState, useEffect, useCallback } from 'react'
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
  const [entries, setEntries] = useState<EditorialEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    scheduled_for: '',
    content_type: 'REEL' as ContentType,
    topic: '',
    caption_draft: '',
  })

  const fetchEntries = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/instagram/calendar?month=${currentMonth}`)
      const json = await res.json()
      setEntries(json.data ?? [])
    } catch { /* silenciar */ }
    finally { setIsLoading(false) }
  }, [currentMonth])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const addEntry = async () => {
    if (!form.scheduled_for || !form.content_type) return
    try {
      await fetch('/api/instagram/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setForm({ scheduled_for: '', content_type: 'REEL', topic: '', caption_draft: '' })
      setShowForm(false)
      await fetchEntries()
    } catch { /* silenciar */ }
  }

  const updateStatus = async (id: string, status: CalendarStatus) => {
    try {
      await fetch('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await fetchEntries()
    } catch { /* silenciar */ }
  }

  const deleteEntry = async (id: string) => {
    try {
      await fetch(`/api/instagram/calendar?id=${id}`, { method: 'DELETE' })
      await fetchEntries()
    } catch { /* silenciar */ }
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
          <button onClick={() => changeMonth(-1)} className="rounded-lg p-2 hover:bg-muted transition-colors text-lg">←</button>
          <h2 className="text-lg font-semibold capitalize min-w-[200px] text-center">{monthLabel}</h2>
          <button onClick={() => changeMonth(1)} className="rounded-lg p-2 hover:bg-muted transition-colors text-lg">→</button>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="h-9">
          {showForm ? 'Cancelar' : '+ Novo conteudo'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <Skeleton className="h-96 w-full rounded-xl" />
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
                                className="group relative rounded-md bg-muted/50 px-1.5 py-1 hover:bg-muted transition-colors cursor-default"
                              >
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px]">{typeConfig?.icon}</span>
                                  <span className="text-[10px] font-medium truncate flex-1">
                                    {entry.topic || typeConfig?.label}
                                  </span>
                                </div>
                                <Badge className={`${statusConfig.color} border-0 text-[8px] px-1 py-0 mt-0.5`}>
                                  {statusConfig.label}
                                </Badge>
                                {/* Actions on hover */}
                                <div className="absolute right-0.5 top-0.5 hidden gap-0.5 group-hover:flex">
                                  {entry.status === 'DRAFT' && (
                                    <button
                                      onClick={() => updateStatus(entry.id, 'APPROVED')}
                                      className="rounded bg-blue-500 px-1 py-0.5 text-[8px] text-white"
                                      title="Aprovar"
                                    >✓</button>
                                  )}
                                  {entry.status === 'APPROVED' && (
                                    <button
                                      onClick={() => updateStatus(entry.id, 'PUBLISHED')}
                                      className="rounded bg-emerald-500 px-1 py-0.5 text-[8px] text-white"
                                      title="Marcar publicado"
                                    >✓</button>
                                  )}
                                  <button
                                    onClick={() => deleteEntry(entry.id)}
                                    className="rounded bg-red-500 px-1 py-0.5 text-[8px] text-white"
                                    title="Remover"
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
