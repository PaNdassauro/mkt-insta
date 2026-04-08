'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber, formatPercent } from '@/lib/analytics'
import { CONTENT_SCORE_COLORS, CONTENT_SCORE_LABELS } from '@/lib/constants'
import { CATEGORY_LABELS, type ContentCategory } from '@/lib/content-classifier'
import type { InstagramPost } from '@/types/instagram'

interface PostCardProps {
  post: InstagramPost
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  IMAGE: 'Foto',
  VIDEO: 'Video',
  CAROUSEL_ALBUM: 'Carrossel',
}

export default function PostCard({ post }: PostCardProps) {
  const [imgError, setImgError] = useState(false)
  // Prefer Supabase Storage URL (persistent) over Instagram CDN URL (expires ~24h)
  const thumbnailUrl = post.stored_thumbnail_url ?? post.thumbnail_url
  const scoreColors = post.content_score
    ? CONTENT_SCORE_COLORS[post.content_score]
    : null
  const scoreLabel = post.content_score
    ? CONTENT_SCORE_LABELS[post.content_score]
    : null

  return (
    <Card role="listitem" className="group overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Thumbnail */}
      <a
        href={post.permalink ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="relative aspect-square overflow-hidden bg-muted">
          {thumbnailUrl && !imgError ? (
            <Image
              src={thumbnailUrl}
              alt={post.caption?.slice(0, 50) ?? 'Post'}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground/40">
              <span className="text-3xl">📷</span>
              <span className="text-[9px]">Imagem expirada</span>
            </div>
          )}
          {/* Overlay com badges */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="bg-black/60 text-white border-0 text-[10px] backdrop-blur-sm">
                {MEDIA_TYPE_LABELS[post.media_type] ?? post.media_type}
              </Badge>
              {post.category && post.category !== 'other' && (
                <Badge variant="secondary" className="bg-purple-600/80 text-white border-0 text-[10px] backdrop-blur-sm">
                  {CATEGORY_LABELS[post.category as ContentCategory] ?? post.category}
                </Badge>
              )}
            </div>
            {scoreColors && scoreLabel && (
              <Badge className={`${scoreColors.bg} ${scoreColors.text} border-0 text-[10px] font-semibold backdrop-blur-sm`}>
                {scoreLabel}
              </Badge>
            )}
          </div>
          {/* Engagement overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/40">
            <div className="flex gap-4 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="text-center">
                <div className="text-lg font-bold">{formatNumber(post.likes)}</div>
                <div className="text-[10px] uppercase tracking-wider">Likes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{formatNumber(post.comments)}</div>
                <div className="text-[10px] uppercase tracking-wider">Coment.</div>
              </div>
            </div>
          </div>
        </div>
      </a>

      {/* Info */}
      <div className="p-3.5">
        {post.caption && (
          <p className="mb-2.5 line-clamp-2 text-sm leading-snug text-foreground/80">
            {post.caption}
          </p>
        )}

        {/* Metricas */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Alcance', value: formatNumber(post.reach) },
            { label: 'Salvos', value: formatNumber(post.saves) },
            { label: 'Engage', value: post.engagement_rate !== null ? formatPercent(post.engagement_rate) : '—' },
          ].map((metric) => (
            <div key={metric.label} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
              <div className="text-xs font-semibold">{metric.value}</div>
              <div className="text-[10px] text-muted-foreground">{metric.label}</div>
            </div>
          ))}
        </div>

        {/* Data */}
        {post.timestamp && (
          <div className="mt-2.5 text-[11px] text-muted-foreground">
            {new Date(post.timestamp).toLocaleDateString('pt-BR', {
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
