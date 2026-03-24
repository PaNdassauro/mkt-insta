import EditorialCalendar from '@/components/instagram/EditorialCalendar'

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendario Editorial</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Planejamento de conteudo — agende, aprove e acompanhe publicacoes
        </p>
      </div>

      <EditorialCalendar />
    </div>
  )
}
