import AdsDashboard from '@/components/instagram/AdsDashboard'

export default function AdsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Anúncios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Desempenho das campanhas no Meta Ads — gasto, alcance, impressões e CTR por anúncio.
        </p>
      </div>

      <AdsDashboard />
    </div>
  )
}
