import CompetitorTable from '@/components/instagram/CompetitorTable'

export default function CompetitorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Concorrentes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Benchmarking com perfis concorrentes — dados publicos
        </p>
      </div>

      <CompetitorTable />
    </div>
  )
}
