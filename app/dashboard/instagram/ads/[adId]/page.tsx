'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PeriodSelector } from '@/components/PeriodSelector'
import { usePeriodFilter } from '@/hooks/usePeriodFilter'
import { formatNumber, formatPercent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import AdDailyChart from '@/components/instagram/AdDailyChart'
import AdBreakdownChart from '@/components/instagram/AdBreakdownChart'
import AdActivityHistory from '@/components/instagram/AdActivityHistory'
import type {
  AdRow,
  AdDailyPoint,
  AdBreakdownRow,
} from '@/lib/meta-ads-client'
import type { ActivityLogRow } from '@/lib/activity-queries'

interface AdDetailResponse {
  ad: AdRow
  daily: AdDailyPoint[]
  demographics: AdBreakdownRow[]
  platform: AdBreakdownRow[]
  history: ActivityLogRow[]
  meta: { partial: boolean; errors: string[]; since: string; until: string }
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  PAUSED: 'bg-gray-100 text-gray-700',
  DELETED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-red-50 text-red-700',
  CAMPAIGN_PAUSED: 'bg-gray-100 text-gray-700',
  ADSET_PAUSED: 'bg-gray-100 text-gray-700',
  IN_PROCESS: 'bg-blue-50 text-blue-700',
  PENDING_REVIEW: 'bg-yellow-50 text-yellow-700',
  DISAPPROVED: 'bg-red-50 text-red-700',
  WITH_ISSUES: 'bg-yellow-50 text-yellow-700',
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusClass(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'
}

function isParentPaused(status: string): boolean {
  return status === 'CAMPAIGN_PAUSED' || status === 'ADSET_PAUSED'
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

export default function AdDetailPage() {
  const params = useParams()
  const adId = params.adId as string
  const { startDate, endDate } = usePeriodFilter()

  const [detail, setDetail] = useState<AdDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (startDate) qs.set('since', startDate)
      if (endDate) qs.set('until', endDate)

      const res = await fetch(`/api/instagram/ads/${adId}?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar anuncio')
      setDetail(json as AdDetailResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }, [adId, startDate, endDate])

  useEffect(() => {
    // Debounce rapid date-range flips (e.g., user clicks 7d→30d→90d quickly).
    const timer = setTimeout(loadData, 300)
    return () => clearTimeout(timer)
  }, [loadData])

  const ad = detail?.ad ?? null
  const since = detail?.meta.since ?? startDate ?? ''
  const until = detail?.meta.until ?? endDate ?? ''

  return (
    <div className="space-y-6">
      {/* Top bar: back + period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/instagram/ads"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar para Ads
        </Link>
        <PeriodSelector />
      </div>

      {/* Header */}
      {loading && !detail ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      ) : ad ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              {ad.creative?.thumbnailUrl ? (
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-muted">
                  <Image
                    src={ad.creative.thumbnailUrl}
                    alt={ad.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded bg-muted text-xl text-muted-foreground/40">
                  📷
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold">{ad.name}</h1>
                  <Badge className={cn('border-0 text-[10px] font-medium', statusClass(ad.effectiveStatus))}>
                    {ad.effectiveStatus}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {ad.campaign && (
                    <span className="truncate">
                      <span className="text-muted-foreground/70">Campanha:</span> {ad.campaign.name}
                    </span>
                  )}
                  {ad.campaign && ad.adset && <span>•</span>}
                  {ad.adset && (
                    <span className="truncate">
                      <span className="text-muted-foreground/70">Conjunto:</span> {ad.adset.name}
                    </span>
                  )}
                </div>
                {isParentPaused(ad.effectiveStatus) && (
                  <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-900">
                    {ad.effectiveStatus === 'CAMPAIGN_PAUSED'
                      ? 'A campanha acima esta pausada. Reativar o anuncio direto nao surte efeito — reative a campanha.'
                      : 'O conjunto de anuncios esta pausado. Reativar o anuncio direto nao surte efeito — reative o conjunto.'}
                  </div>
                )}
              </div>
              <a
                href={`https://www.facebook.com/adsmanager/manage/ads?selected_ad_ids=${ad.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap text-xs text-primary underline-offset-2 hover:underline"
              >
                Abrir no Ads Manager
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Partial-failure banner */}
      {detail?.meta.partial && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-900">
          Algumas secoes nao puderam ser carregadas: {detail.meta.errors.join('; ')}.
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading && !detail ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-7 w-28" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : ad ? (
          <>
            <KpiCard label="Gasto no periodo" value={formatBRL(ad.insights.spend)} />
            <KpiCard label="Alcance" value={formatNumber(ad.insights.reach)} />
            <KpiCard label="Impressoes" value={formatNumber(ad.insights.impressions)} />
            <KpiCard
              label="CTR"
              value={ad.insights.ctr > 0 ? formatPercent(ad.insights.ctr) : '—'}
            />
          </>
        ) : null}
      </div>

      {/* Daily chart */}
      <AdDailyChart
        data={detail?.daily ?? []}
        since={since}
        until={until}
        isLoading={loading && !detail}
      />

      {/* Breakdowns: demographics + platform */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AdBreakdownChart
          title="Idade e genero"
          subtitle="Gasto por faixa etaria (empilhado por genero)"
          data={detail?.demographics ?? []}
          stackBySubKey
          metric="spend"
          isLoading={loading && !detail}
        />
        <AdBreakdownChart
          title="Plataforma"
          subtitle="Gasto por plataforma onde o anuncio foi entregue"
          data={detail?.platform ?? []}
          metric="spend"
          isLoading={loading && !detail}
        />
      </div>

      {/* Activity history */}
      <AdActivityHistory
        history={detail?.history ?? []}
        isLoading={loading && !detail}
      />
    </div>
  )
}
