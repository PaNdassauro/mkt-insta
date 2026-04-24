'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PeriodSelector } from '@/components/PeriodSelector'
import { usePeriodFilter } from '@/hooks/usePeriodFilter'
import { formatNumber } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import AdTableRow, { type AdStatusUpdate } from '@/components/instagram/AdTableRow'
import AdsGroupedTable from '@/components/instagram/AdsGroupedTable'
import type { AdRow } from '@/lib/meta-ads-client'

const VIEW_STORAGE_KEY = 'dashig_ads_view'
type AdsView = 'grouped' | 'flat'

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'OTHER'
type SortKey = 'name' | 'status' | 'campaign' | 'dailyBudget' | 'spend' | 'reach' | 'impressions' | 'ctr' | 'cpm'
type SortDir = 'asc' | 'desc'

function compareAds(a: AdRow, b: AdRow, key: SortKey): number {
  switch (key) {
    case 'name': return a.name.localeCompare(b.name, 'pt-BR')
    case 'status': return a.effectiveStatus.localeCompare(b.effectiveStatus)
    case 'campaign': return (a.campaign?.name ?? '').localeCompare(b.campaign?.name ?? '', 'pt-BR')
    case 'dailyBudget': return (a.adset?.dailyBudgetBRL ?? 0) - (b.adset?.dailyBudgetBRL ?? 0)
    case 'spend': return a.insights.spend - b.insights.spend
    case 'reach': return a.insights.reach - b.insights.reach
    case 'impressions': return a.insights.impressions - b.insights.impressions
    case 'ctr': return a.insights.ctr - b.insights.ctr
    case 'cpm': return a.insights.cpm - b.insights.cpm
  }
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'PAUSED', label: 'Pausados' },
  { value: 'OTHER', label: 'Outros' },
]

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function matchesStatus(ad: AdRow, filter: StatusFilter): boolean {
  if (filter === 'ALL') return true
  if (filter === 'ACTIVE') return ad.effectiveStatus === 'ACTIVE'
  if (filter === 'PAUSED') {
    return (
      ad.effectiveStatus === 'PAUSED' ||
      ad.effectiveStatus === 'CAMPAIGN_PAUSED' ||
      ad.effectiveStatus === 'ADSET_PAUSED'
    )
  }
  return (
    ad.effectiveStatus !== 'ACTIVE' &&
    ad.effectiveStatus !== 'PAUSED' &&
    ad.effectiveStatus !== 'CAMPAIGN_PAUSED' &&
    ad.effectiveStatus !== 'ADSET_PAUSED'
  )
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  active: SortKey
  dir: SortDir
  onClick: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const isActive = active === sortKey
  const arrow = isActive ? (dir === 'asc' ? '↑' : '↓') : ''
  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 select-none hover:text-foreground transition-colors',
          align === 'right' && 'flex-row-reverse',
          isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
        )}
      >
        <span>{label}</span>
        <span className="text-[10px] w-2 inline-block">{arrow}</span>
      </button>
    </TableHead>
  )
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

export default function AdsDashboard() {
  const { startDate, endDate } = usePeriodFilter()
  const [ads, setAds] = useState<AdRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [nameQuery, setNameQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set())
  // Default 'grouped'. Resolve localStorage override in useEffect (SSR safety).
  const [view, setView] = useState<AdsView>('grouped')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === 'grouped' || stored === 'flat') setView(stored)
  }, [])

  const handleViewChange = useCallback((next: AdsView) => {
    setView(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next)
    }
  }, [])

  const applyAdUpdate = useCallback((adId: string, patch: Partial<AdRow>) => {
    setAds((prev) =>
      prev ? prev.map((ad) => (ad.id === adId ? { ...ad, ...patch } : ad)) : prev
    )
  }, [])

  const removeAd = useCallback((adId: string) => {
    setAds((prev) => (prev ? prev.filter((ad) => ad.id !== adId) : prev))
  }, [])

  const mutateAdStatus = useCallback(
    async (ad: AdRow, nextStatus: AdStatusUpdate) => {
      if (nextStatus === 'DELETED') {
        const ok = window.confirm(
          `Excluir o anuncio "${ad.name}"? Ele sera arquivado no Ads Manager.`
        )
        if (!ok) return
      }

      setMutatingIds((s) => new Set(s).add(ad.id))
      const prevStatus = ad.effectiveStatus
      if (nextStatus !== 'DELETED') {
        applyAdUpdate(ad.id, { effectiveStatus: nextStatus, status: nextStatus })
      }

      try {
        const res = await fetch(`/api/instagram/ads/${ad.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Falha ao atualizar anuncio')

        if (nextStatus === 'DELETED') {
          removeAd(ad.id)
          toast.success('Anuncio excluido')
        } else {
          applyAdUpdate(ad.id, {
            effectiveStatus: json.effective_status ?? nextStatus,
            status: json.status ?? nextStatus,
          })
          toast.success(nextStatus === 'ACTIVE' ? 'Anuncio ativado' : 'Anuncio pausado')
        }
      } catch (err) {
        if (nextStatus !== 'DELETED') {
          applyAdUpdate(ad.id, { effectiveStatus: prevStatus, status: prevStatus })
        }
        toast.error(err instanceof Error ? err.message : 'Erro inesperado')
      } finally {
        setMutatingIds((s) => {
          const next = new Set(s)
          next.delete(ad.id)
          return next
        })
      }
    },
    [applyAdUpdate, removeAd]
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'status' || key === 'campaign' ? 'asc' : 'desc')
    }
  }

  useEffect(() => {
    let cancelled = false
    setAds(null)
    setError(null)

    const params = new URLSearchParams()
    if (startDate) params.set('since', startDate)
    if (endDate) params.set('until', endDate)

    fetch(`/api/instagram/ads?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar anuncios')
        return json as { data: AdRow[]; total: number }
      })
      .then((body) => {
        if (!cancelled) setAds(body.data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro inesperado')
      })

    return () => {
      cancelled = true
    }
  }, [startDate, endDate])

  const filteredAds = useMemo(() => {
    const q = nameQuery.trim().toLowerCase()
    const filtered = (ads ?? []).filter((ad) => {
      if (!matchesStatus(ad, statusFilter)) return false
      if (!q) return true
      return (
        ad.name.toLowerCase().includes(q) ||
        (ad.campaign?.name ?? '').toLowerCase().includes(q)
      )
    })
    const sorted = [...filtered].sort((a, b) => compareAds(a, b, sortKey))
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [ads, statusFilter, nameQuery, sortKey, sortDir])

  const kpis = useMemo(() => {
    const source = ads ?? []
    return {
      spend: source.reduce((acc, ad) => acc + ad.insights.spend, 0),
      reach: source.reduce((acc, ad) => acc + ad.insights.reach, 0),
      impressions: source.reduce((acc, ad) => acc + ad.insights.impressions, 0),
      active: source.filter((ad) => ad.effectiveStatus === 'ACTIVE').length,
    }
  }, [ads])

  const statusCounts = useMemo(() => {
    const source = ads ?? []
    return {
      ALL: source.length,
      ACTIVE: source.filter((ad) => matchesStatus(ad, 'ACTIVE')).length,
      PAUSED: source.filter((ad) => matchesStatus(ad, 'PAUSED')).length,
      OTHER: source.filter((ad) => matchesStatus(ad, 'OTHER')).length,
    }
  }, [ads])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector />
        <div className="text-xs text-muted-foreground">
          {startDate && endDate ? `${startDate} → ${endDate}` : 'Periodo: tudo'}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ads === null ? (
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
        ) : (
          <>
            <KpiCard label="Total investido" value={formatBRL(kpis.spend)} />
            <KpiCard label="Alcance" value={formatNumber(kpis.reach)} />
            <KpiCard label="Impressoes" value={formatNumber(kpis.impressions)} />
            <KpiCard label="Ads ativos" value={String(kpis.active)} />
          </>
        )}
      </div>

      {/* Status filter chips + view toggle + name search */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === opt.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
            <span className="ml-1.5 text-[10px] opacity-70">({statusCounts[opt.value]})</span>
          </button>
        ))}
        <div className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={() => handleViewChange('grouped')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              view === 'grouped'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Agrupado
          </button>
          <button
            type="button"
            onClick={() => handleViewChange('flat')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              view === 'flat'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Lista plana
          </button>
        </div>
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Buscar por nome do anuncio ou campanha..."
            className="h-9 w-full rounded-md border border-input bg-background pl-3 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          {nameQuery && (
            <button
              type="button"
              onClick={() => setNameQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {ads === null ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Anuncio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Orc./dia</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Alcance</TableHead>
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={12}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : view === 'grouped' ? (
            <AdsGroupedTable
              ads={filteredAds}
              mutatingIds={mutatingIds}
              onMutate={mutateAdStatus}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[60px]"></TableHead>
                  <SortHeader label="Anuncio" sortKey="name" active={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Status" sortKey="status" active={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Campanha" sortKey="campaign" active={sortKey} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="Orc./dia" sortKey="dailyBudget" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <SortHeader label="Gasto" sortKey="spend" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <SortHeader label="Alcance" sortKey="reach" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <SortHeader label="Impr." sortKey="impressions" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <SortHeader label="CTR" sortKey="ctr" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <SortHeader label="CPM" sortKey="cpm" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <TableHead className="text-right">Acoes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-sm text-muted-foreground">
                      Nenhum anuncio encontrado no periodo selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAds.map((ad) => (
                    <AdTableRow
                      key={ad.id}
                      ad={ad}
                      mutating={mutatingIds.has(ad.id)}
                      onMutate={mutateAdStatus}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
