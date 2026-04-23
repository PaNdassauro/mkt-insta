'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Pause, Play, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { formatNumber, formatPercent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { AdRow } from '@/lib/meta-ads-client'

type AdStatusUpdate = 'ACTIVE' | 'PAUSED' | 'DELETED'

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

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusClass(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'
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

      {/* Status filter chips + name search */}
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
        <div className="relative ml-auto w-full sm:w-72">
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
              {ads === null && (
                <>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={12}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}
              {ads !== null && filteredAds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="py-12 text-center text-sm text-muted-foreground">
                    Nenhum anuncio encontrado no periodo selecionado.
                  </TableCell>
                </TableRow>
              )}
              {filteredAds.map((ad) => (
                <AdTableRow
                  key={ad.id}
                  ad={ad}
                  mutating={mutatingIds.has(ad.id)}
                  onMutate={mutateAdStatus}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function AdTableRow({
  ad,
  mutating,
  onMutate,
}: {
  ad: AdRow
  mutating: boolean
  onMutate: (ad: AdRow, next: AdStatusUpdate) => void | Promise<void>
}) {
  const thumb = ad.creative?.thumbnailUrl
  // adAccountId isn't in AdRow; the deep link works with act_ stripped, and Meta accepts
  // the ad_id-only format too: clicking "Abrir" will still land on the ad.
  const manageUrl = `https://www.facebook.com/adsmanager/manage/ads?selected_ad_ids=${ad.id}`
  const isActive = ad.effectiveStatus === 'ACTIVE'
  // PAUSED (directo) pode ser reativado. CAMPAIGN_PAUSED/ADSET_PAUSED nao — o
  // bloqueio esta num nivel acima, reativar o ad sozinho nao surte efeito.
  const canActivate = ad.effectiveStatus === 'PAUSED'
  const canPause = isActive
  // Disapproved/deleted/archived nao devem aceitar mutate.
  const canDelete = !['DELETED', 'ARCHIVED'].includes(ad.effectiveStatus)

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell>
        <div className="relative h-10 w-10 overflow-hidden rounded bg-muted">
          {thumb ? (
            <Image
              src={thumb}
              alt={ad.name}
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40">
              📷
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[240px]">
        <div className="truncate text-sm font-medium">{ad.name}</div>
        {ad.campaign?.objective && (
          <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
            {ad.campaign.objective.replace(/^OUTCOME_/, '')}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge className={cn('border-0 text-[10px] font-medium', statusClass(ad.effectiveStatus))}>
          {ad.effectiveStatus}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[200px]">
        <div className="truncate text-sm text-muted-foreground">{ad.campaign?.name ?? '—'}</div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {ad.adset?.dailyBudgetBRL !== null && ad.adset?.dailyBudgetBRL !== undefined
          ? formatBRL(ad.adset.dailyBudgetBRL)
          : '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">{formatBRL(ad.insights.spend)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(ad.insights.reach)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(ad.insights.impressions)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {ad.insights.ctr > 0 ? formatPercent(ad.insights.ctr) : '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {ad.insights.cpm > 0 ? formatBRL(ad.insights.cpm) : '—'}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {mutating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {canPause && (
            <button
              type="button"
              onClick={() => onMutate(ad, 'PAUSED')}
              disabled={mutating}
              title="Pausar anuncio"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          )}
          {canActivate && (
            <button
              type="button"
              onClick={() => onMutate(ad, 'ACTIVE')}
              disabled={mutating}
              title="Ativar anuncio"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onMutate(ad, 'DELETED')}
              disabled={mutating}
              title="Excluir anuncio"
              className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <a
          href={manageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          Abrir
        </a>
      </TableCell>
    </TableRow>
  )
}
