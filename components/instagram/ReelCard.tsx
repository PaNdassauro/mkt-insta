'use client'

import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatPercent } from '@/lib/analytics'
import { CONTENT_SCORE_COLORS, CONTENT_SCORE_LABELS } from '@/lib/constants'
import type { InstagramReel } from '@/types/instagram'

interface ReelCardProps {
  reel: InstagramReel
}

export default function ReelCard({ reel }: ReelCardProps) {
  // Prefer Supabase Storage URL (persistent) over Instagram CDN URL (expires ~24h)
  const thumbnailUrl = reel.stored_thumbnail_url ?? reel.thumbnail_url
  const scoreColors = reel.content_score ? CONTENT_SCORE_COLORS[reel.content_score] : null
  const scoreLabel = reel.content_score ? CONTENT_SCORE_LABELS[reel.content_score] : null

  const engagementRate = reel.reach > 0
    ? ((reel.likes + reel.comments + reel.saves + reel.shares) / reel.reach) * 100
    : 0

  return (
    <Card className="group overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200">
      <a href={reel.permalink ?? '#'} target="_blank" rel="noopener noreferrer" className="block">
        <div className="relative aspect-[9/16] max-h-[320px] overflow-hidden bg-muted">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={reel.caption?.slice(0, 50) ?? 'Reel'}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-muted-foreground/30">
              🎬
            </div>
          )}
          {/* Badges */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
            <Badge variant="secondary" className="bg-black/60 text-white border-0 text-[10px] backdrop-blur-sm">
              Reel
            </Badge>
            {scoreColors && scoreLabel && (
              <Badge className={`${scoreColors.bg} ${scoreColors.text} border-0 text-[10px] font-semibold backdrop-blur-sm`}>
                {scoreLabel}
              </Badge>
            )}
          </div>
          {/* Views overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
            <div className="flex items-center gap-1.5 text-white">
              <span className="text-sm">▶</span>
              <span className="text-sm font-semibold">{formatNumber(reel.views)} views</span>
            </div>
          </div>
          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/40">
            <div className="flex gap-4 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="text-center">
                <div className="text-lg font-bold">{formatNumber(reel.likes)}</div>
                <div className="text-[10px] uppercase tracking-wider">Likes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{formatNumber(reel.comments)}</div>
                <div className="text-[10px] uppercase tracking-wider">Coment.</div>
              </div>
            </div>
          </div>
        </div>
      </a>

      <div className="p-3.5">
        {reel.caption && (
          <p className="mb-2.5 line-clamp-2 text-sm leading-snug text-foreground/80">
            {reel.caption}
          </p>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Alcance', value: formatNumber(reel.reach) },
            { label: 'Salvos', value: formatNumber(reel.saves) },
            { label: 'Engage', value: formatPercent(engagementRate) },
          ].map((metric) => (
            <div key={metric.label} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
              <div className="text-xs font-semibold">{metric.value}</div>
              <div className="text-[10px] text-muted-foreground">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Completion rate + shares */}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-md bg-indigo-50 px-2 py-1.5 text-center">
            <div className="text-xs font-semibold text-indigo-700">
              {reel.completion_rate !== null ? formatPercent(reel.completion_rate) : '—'}
            </div>
            <div className="text-[10px] text-indigo-500">Conclusao</div>
          </div>
          <div className="rounded-md bg-cyan-50 px-2 py-1.5 text-center">
            <div className="text-xs font-semibold text-cyan-700">{formatNumber(reel.shares)}</div>
            <div className="text-[10px] text-cyan-500">Shares</div>
          </div>
        </div>

        {reel.timestamp && (
          <div className="mt-2.5 text-[11px] text-muted-foreground">
            {new Date(reel.timestamp).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
