'use client'

import { useState } from 'react'
import EditorialCalendar from '@/components/instagram/EditorialCalendar'
import CalendarKanban from '@/components/instagram/CalendarKanban'
import { Button } from '@/components/ui/button'

export default function CalendarPage() {
  const [view, setView] = useState<'calendar' | 'kanban'>('calendar')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario Editorial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planejamento de conteudo — agende, aprove e acompanhe publicacoes
          </p>
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          <Button
            size="sm"
            variant={view === 'calendar' ? 'default' : 'ghost'}
            className="h-8 text-xs"
            onClick={() => setView('calendar')}
          >
            📅 Calendario
          </Button>
          <Button
            size="sm"
            variant={view === 'kanban' ? 'default' : 'ghost'}
            className="h-8 text-xs"
            onClick={() => setView('kanban')}
          >
            📋 Kanban
          </Button>
        </div>
      </div>

      {view === 'calendar' ? <EditorialCalendar /> : <CalendarKanban />}
    </div>
  )
}
