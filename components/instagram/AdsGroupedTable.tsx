'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import AdTableRow, { type AdStatusUpdate } from '@/components/instagram/AdTableRow'
import { groupAds } from '@/lib/ads-grouping'
import type { AdRow } from '@/lib/meta-ads-client'

interface Props {
  ads: AdRow[]
  mutatingIds: Set<string>
  onMutate: (ad: AdRow, next: AdStatusUpdate) => void | Promise<void>
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  PAUSED: 'bg-gray-100 text-gray-700',
  DELETED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-red-50 text-red-700',
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusClass(status: string | null): string {
  if (!status) return 'bg-muted text-muted-foreground'
  return STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'
}

const AD_ROW_COL_COUNT = 11 // thumb + name + status + daily + spend + reach + impressions + ctr + cpm + acoes + abrir

export default function AdsGroupedTable({ ads, mutatingIds, onMutate }: Props) {
  const groups = useMemo(() => groupAds(ads), [ads])

  // Default-expand everything when there are few groups; collapse all otherwise.
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(() => {
    if (groups.length <= 3) return new Set(groups.map((g) => g.id))
    return new Set()
  })
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set())

  function toggleCampaign(id: string) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAdset(id: string) {
    setExpandedAdsets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30">
          <TableHead className="w-[60px]"></TableHead>
          <TableHead>Anuncio / Conjunto / Campanha</TableHead>
          <TableHead>Status</TableHead>
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
        {groups.length === 0 && (
          <TableRow>
            <TableCell colSpan={AD_ROW_COL_COUNT} className="py-12 text-center text-sm text-muted-foreground">
              Nenhum anuncio encontrado no periodo selecionado.
            </TableCell>
          </TableRow>
        )}

        {groups.map((campaign) => {
          const campaignOpen = expandedCampaigns.has(campaign.id)
          return (
            <Fragment key={`c-${campaign.id}`}>
              {/* Campaign header row */}
              <TableRow
                className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                onClick={() => toggleCampaign(campaign.id)}
              >
                <TableCell className="pl-3">
                  {campaignOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="max-w-[340px]">
                  <div className="truncate text-sm font-semibold">{campaign.name}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {campaign.objective && <span>{campaign.objective.replace(/^OUTCOME_/, '')}</span>}
                    <span>•</span>
                    <span>
                      {campaign.totals.adsetCount} conjunto{campaign.totals.adsetCount === 1 ? '' : 's'}, {campaign.totals.adCount} anuncio{campaign.totals.adCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {campaign.status && (
                    <Badge className={cn('border-0 text-[10px] font-medium', statusClass(campaign.status))}>
                      {campaign.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {formatBRL(campaign.totals.spend)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatNumber(campaign.totals.impressions)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">—</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">—</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>

              {/* Adsets under this campaign */}
              {campaignOpen &&
                campaign.adsets.map((adset) => {
                  const adsetKey = `${campaign.id}::${adset.id}`
                  const adsetOpen = expandedAdsets.has(adsetKey)
                  return (
                    <Fragment key={`a-${adsetKey}`}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/20"
                        onClick={() => toggleAdset(adsetKey)}
                      >
                        <TableCell style={{ paddingLeft: 36 }}>
                          {adsetOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <div className="truncate text-sm font-medium">{adset.name}</div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {adset.totals.adCount} anuncio{adset.totals.adCount === 1 ? '' : 's'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {adset.status && (
                            <Badge className={cn('border-0 text-[10px] font-medium', statusClass(adset.status))}>
                              {adset.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatBRL(adset.totals.spend)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(adset.totals.impressions)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">—</TableCell>
                        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">—</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>

                      {/* Ads under this adset */}
                      {adsetOpen &&
                        adset.ads.map((ad) => (
                          <AdTableRow
                            key={ad.id}
                            ad={ad}
                            mutating={mutatingIds.has(ad.id)}
                            onMutate={onMutate}
                            showCampaignCell={false}
                            indentPx={64}
                          />
                        ))}
                    </Fragment>
                  )
                })}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}
