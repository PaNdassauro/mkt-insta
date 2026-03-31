'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { EditorialEntry, CalendarStatus } from '@/types/instagram'

const COLUMNS: { status: CalendarStatus; label: string; color: string; bg: string }[] = [
  { status: 'DRAFT', label: 'Rascunho', color: 'border-slate-300', bg: 'bg-slate-50' },
  { status: 'APPROVED', label: 'Aprovado', color: 'border-blue-300', bg: 'bg-blue-50' },
  { status: 'PUBLISHED', label: 'Publicado', color: 'border-emerald-300', bg: 'bg-emerald-50' },
  { status: 'CANCELLED', label: 'Cancelado', color: 'border-red-300', bg: 'bg-red-50' },
]

const FORMAT_ICON: Record<string, string> = {
  REEL: '🎬',
  CAROUSEL: '📸',
  IMAGE: '🖼',
  STORY: '⏳',
}

export default function CalendarKanban() {
  const router = useRouter()
  const [entries, setEntries] = useState<EditorialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetchWithAccount('/api/instagram/calendar')
      const json = await res.json()
      setEntries(json.data ?? [])
    } catch {
      toast.error('Erro na operacao')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  async function moveToStatus(entryId: string, newStatus: CalendarStatus) {
    try {
      await fetchWithAccount('/api/instagram/calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId, status: newStatus }),
      })
      await fetchEntries()
    } catch {
      toast.error('Erro na operacao')
    }
  }

  function handleDragStart(e: React.DragEvent, entryId: string) {
    e.dataTransfer.setData('text/plain', entryId)
    setDraggingId(entryId)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDrop(e: React.DragEvent, status: CalendarStatus) {
    e.preventDefault()
    const entryId = e.dataTransfer.getData('text/plain')
    if (entryId) {
      moveToStatus(entryId, status)
    }
    setDraggingId(null)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <Skeleton key={col.status} className="h-96 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colEntries = entries
          .filter((e) => e.status === col.status)
          .sort((a, b) => {
            if (!a.scheduled_for || !b.scheduled_for) return 0
            return new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
          })

        return (
          <div
            key={col.status}
            className={`rounded-xl border-2 border-dashed ${col.color} ${col.bg} p-3 min-h-[400px] transition-colors ${
              draggingId ? 'border-solid' : ''
            }`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{col.label}</h3>
              <Badge variant="secondary" className="text-[10px]">
                {colEntries.length}
              </Badge>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {colEntries.map((entry) => (
                <Card
                  key={entry.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, entry.id)}
                  onClick={() =>
                    router.push(`/dashboard/instagram/calendar/${entry.id}`)
                  }
                  className={`border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                    draggingId === entry.id ? 'opacity-50' : ''
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-sm shrink-0">
                        {FORMAT_ICON[entry.content_type ?? ''] ?? '📝'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {entry.topic || entry.content_type || 'Post'}
                        </p>
                        {entry.scheduled_for && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(entry.scheduled_for).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                        {entry.caption_draft && (
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                            {entry.caption_draft.slice(0, 80)}
                          </p>
                        )}
                        <div className="flex gap-1 mt-1.5">
                          {entry.media_url && (
                            <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded">
                              📎 Midia
                            </span>
                          )}
                          {entry.auto_publish && (
                            <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded">
                              ⏰ Auto
                            </span>
                          )}
                          {entry.publish_error && (
                            <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded">
                              Erro
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {colEntries.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Arraste posts aqui
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
