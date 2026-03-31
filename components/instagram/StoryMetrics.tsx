'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/analytics'
import type { InstagramStory } from '@/types/instagram'

// ---------------------------------------------------------------------------
// Hook: useIntersectionObserver
// Returns a ref to attach to a DOM element and a boolean indicating visibility.
// ---------------------------------------------------------------------------
function useIntersectionObserver(
  options: IntersectionObserverInit = {},
): [React.RefCallback<HTMLElement>, boolean] {
  const [isVisible, setIsVisible] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const ref = useCallback(
    (node: HTMLElement | null) => {
      // Cleanup previous observer
      if (observerRef.current) {
        observerRef.current.disconnect()
        observerRef.current = null
      }

      if (!node) return

      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          // Once visible, stop observing (load once)
          observerRef.current?.disconnect()
          observerRef.current = null
        }
      }, options)

      observerRef.current.observe(node)
    },
    // Intentionally stable — options rarely change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.rootMargin, options.threshold],
  )

  return [ref, isVisible]
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function StoryMetrics() {
  const [stories, setStories] = useState<InstagramStory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchWithAccount('/api/instagram/stories?limit=100')
      .then((r) => r.json())
      .then((json) => setStories(json.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border/60 p-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">Nenhum story rastreado</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          O sync de stories roda diariamente e captura stories ativos antes de expirarem.
        </p>
      </div>
    )
  }

  // Stats
  const totalStories = stories.length
  const avgReach = Math.round(stories.reduce((s, st) => s + st.reach, 0) / totalStories)
  const totalReplies = stories.reduce((s, st) => s + st.replies, 0)
  const totalFollows = stories.reduce((s, st) => s + (st.follows ?? 0), 0)

  const stats = [
    { label: 'Stories Rastreados', value: formatNumber(totalStories), icon: '⏳' },
    { label: 'Alcance Medio', value: formatNumber(avgReach), icon: '👁' },
    { label: 'Respostas', value: formatNumber(totalReplies), icon: '💬' },
    { label: 'Novos Seguidores', value: formatNumber(totalFollows), icon: '👥' },
  ]

  // Agrupar por dia
  const dayGroups = new Map<string, InstagramStory[]>()
  for (const story of stories) {
    if (!story.timestamp) continue
    const day = new Date(story.timestamp).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    })
    const group = dayGroups.get(day) ?? []
    group.push(story)
    dayGroups.set(day, group)
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-base">
                {stat.icon}
              </span>
              <div>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stories por dia — each group lazy-loaded via IntersectionObserver */}
      {Array.from(dayGroups.entries()).map(([day, dayStories]) => (
        <DayGroup key={day} day={day} stories={dayStories} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DayGroup: observed per-group; renders placeholder until visible
// ---------------------------------------------------------------------------
const DAY_GROUP_OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: '200px 0px',
}

function DayGroup({ day, stories }: { day: string; stories: InstagramStory[] }) {
  const [ref, isVisible] = useIntersectionObserver(DAY_GROUP_OBSERVER_OPTIONS)

  return (
    <div ref={ref}>
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {day}
      </h3>
      {isVisible ? (
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : (
        // Placeholder that approximates the same height
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {stories.map((story) => (
            <Skeleton key={story.id} className="aspect-[9/16] w-full rounded-xl" />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// StoryCard
// ---------------------------------------------------------------------------
const CARD_OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: '100px 0px',
}

function StoryCard({ story }: { story: InstagramStory }) {
  const [showVideo, setShowVideo] = useState(false)
  const [cardRef, isCardVisible] = useIntersectionObserver(CARD_OBSERVER_OPTIONS)

  const thumbUrl = story.stored_media_url ?? story.media_url
  const videoUrl = story.stored_video_url ?? (story.media_type === 'VIDEO' ? story.media_url : null)
  const isExpired = story.expires_at ? new Date(story.expires_at) < new Date() : true
  const isVideo = story.media_type === 'VIDEO'

  return (
    <div className="group block" ref={cardRef}>
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200">
        {/* Media */}
        <div
          className="relative aspect-[9/16] overflow-hidden bg-muted cursor-pointer"
          onClick={() => {
            if (isVideo && videoUrl) {
              setShowVideo(!showVideo)
            } else if (story.permalink) {
              window.open(story.permalink, '_blank')
            }
          }}
        >
          {showVideo && videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : isCardVisible && thumbUrl ? (
            <Image
              src={thumbUrl}
              alt="Story"
              fill
              loading="lazy"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 16vw, 12vw"
            />
          ) : !isCardVisible && thumbUrl ? (
            // Placeholder while not yet in viewport
            <div className="h-full w-full bg-muted animate-pulse" />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl text-muted-foreground/30">
              {isVideo ? '🎬' : '📷'}
            </div>
          )}

          {/* Play button para videos */}
          {isVideo && videoUrl && !showVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                <span className="ml-0.5 text-sm">▶</span>
              </div>
            </div>
          )}

          {/* Status + type badges */}
          {!showVideo && (
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
              <Badge
                variant="secondary"
                className={`text-[8px] border-0 backdrop-blur-sm ${
                  isExpired ? 'bg-black/50 text-white/70' : 'bg-emerald-500/80 text-white'
                }`}
              >
                {isExpired ? 'Expirado' : 'Ativo'}
              </Badge>
              {isVideo && (
                <Badge variant="secondary" className="bg-black/50 text-white border-0 text-[8px] backdrop-blur-sm">
                  Video
                </Badge>
              )}
            </div>
          )}

          {/* Metrics overlay */}
          {!showVideo && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
              <div className="flex items-center justify-between text-[10px] text-white">
                <span className="font-semibold">{formatNumber(story.reach)} alcance</span>
                {(story.navigation ?? 0) > 0 && (
                  <span className="opacity-80">{formatNumber(story.navigation ?? 0)} nav</span>
                )}
              </div>
            </div>
          )}

          {/* Hover overlay com metricas detalhadas */}
          {!showVideo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 transition-all duration-200 group-hover:bg-black/60">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {[
                  { label: 'Alcance', value: story.reach },
                  { label: 'Navegacao', value: story.navigation ?? 0 },
                  { label: 'Respostas', value: story.replies },
                  { label: 'Shares', value: story.shares ?? 0 },
                { label: 'Follows', value: story.follows ?? 0 },
                { label: 'Perfil', value: story.profile_visits ?? 0 },
              ].map((m) => (
                <div key={m.label} className="text-center">
                  <div className="text-xs font-bold">{formatNumber(m.value)}</div>
                  <div className="text-[8px] uppercase tracking-wider opacity-70">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* Horario */}
        <div className="p-1.5 text-center">
          <p className="text-[10px] text-muted-foreground">
            {story.timestamp
              ? new Date(story.timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </p>
        </div>
      </Card>
    </div>
  )
}
