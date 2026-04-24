'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Pause, Play, Trash2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatNumber, formatPercent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import type { AdRow } from '@/lib/meta-ads-client'

export type AdStatusUpdate = 'ACTIVE' | 'PAUSED' | 'DELETED'

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

interface Props {
  ad: AdRow
  mutating: boolean
  onMutate: (ad: AdRow, next: AdStatusUpdate) => void | Promise<void>
  /** Quando true, exibe a coluna "Campanha". Grouped view oculta — a campanha ja esta no header. */
  showCampaignCell?: boolean
  /** Padding esquerdo extra (em px) para indentar em view grouped. */
  indentPx?: number
}

export default function AdTableRow({
  ad,
  mutating,
  onMutate,
  showCampaignCell = true,
  indentPx,
}: Props) {
  const thumb = ad.creative?.thumbnailUrl
  const manageUrl = `https://www.facebook.com/adsmanager/manage/ads?selected_ad_ids=${ad.id}`
  const isActive = ad.effectiveStatus === 'ACTIVE'
  // PAUSED (direto) pode ser reativado. CAMPAIGN_PAUSED/ADSET_PAUSED nao — o
  // bloqueio esta num nivel acima, reativar o ad sozinho nao surte efeito.
  const canActivate = ad.effectiveStatus === 'PAUSED'
  const canPause = isActive
  const canDelete = !['DELETED', 'ARCHIVED'].includes(ad.effectiveStatus)
  const detailHref = `/dashboard/instagram/ads/${ad.id}`

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell style={indentPx ? { paddingLeft: indentPx } : undefined}>
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
        <Link
          href={detailHref}
          className="block min-w-0 hover:underline"
          title="Ver detalhes"
        >
          <div className="truncate text-sm font-medium">{ad.name}</div>
          {ad.campaign?.objective && (
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {ad.campaign.objective.replace(/^OUTCOME_/, '')}
            </div>
          )}
        </Link>
      </TableCell>
      <TableCell>
        <Badge className={cn('border-0 text-[10px] font-medium', statusClass(ad.effectiveStatus))}>
          {ad.effectiveStatus}
        </Badge>
      </TableCell>
      {showCampaignCell && (
        <TableCell className="max-w-[200px]">
          <div className="truncate text-sm text-muted-foreground">{ad.campaign?.name ?? '—'}</div>
        </TableCell>
      )}
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
