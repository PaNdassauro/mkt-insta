'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import PostCard from './PostCard'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePostPerformance } from '@/hooks/usePostPerformance'
import { ITEMS_PER_PAGE } from '@/lib/constants'
import type { InstagramPost } from '@/types/instagram'

const SORT_OPTIONS = [
  { value: 'timestamp', label: 'Mais recentes' },
  { value: 'engagement_rate', label: 'Maior engagement' },
  { value: 'reach', label: 'Maior alcance' },
  { value: 'likes', label: 'Mais curtidos' },
]

const MEDIA_FILTERS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'IMAGE', label: 'Fotos' },
  { value: 'VIDEO', label: 'Videos' },
  { value: 'CAROUSEL_ALBUM', label: 'Carrosseis' },
]

const SCORE_FILTERS = [
  { value: 'all', label: 'Todos os scores' },
  { value: 'VIRAL', label: 'Viral' },
  { value: 'GOOD', label: 'Bom' },
  { value: 'AVERAGE', label: 'Medio' },
  { value: 'WEAK', label: 'Fraco' },
]

export default function PostGrid() {
  const [sortBy, setSortBy] = useState('timestamp')
  const [mediaType, setMediaType] = useState<string | null>(null)
  const [contentScore, setContentScore] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [allPosts, setAllPosts] = useState<InstagramPost[]>([])

  // Track filter values to detect changes and reset accumulated posts
  const filtersRef = useRef({ sortBy, mediaType, contentScore })

  const { posts, total, isLoading, error } = usePostPerformance({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    sortBy,
    order: 'desc',
    mediaType,
    contentScore,
  })

  const hasMore = allPosts.length < total

  // When filters change, reset accumulated posts and go back to page 0
  useEffect(() => {
    const prev = filtersRef.current
    if (
      prev.sortBy !== sortBy ||
      prev.mediaType !== mediaType ||
      prev.contentScore !== contentScore
    ) {
      filtersRef.current = { sortBy, mediaType, contentScore }
      setAllPosts([])
      setPage(0)
    }
  }, [sortBy, mediaType, contentScore])

  // Append newly fetched posts to accumulated list
  useEffect(() => {
    if (posts.length === 0) return

    setAllPosts((prev) => {
      if (page === 0) {
        // First page (or after filter reset): replace entirely
        return posts
      }
      // Append, deduplicating by id just in case
      const existingIds = new Set(prev.map((p) => p.id))
      const newPosts = posts.filter((p) => !existingIds.has(p.id))
      return [...prev, ...newPosts]
    })
  }, [posts, page])

  // IntersectionObserver for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0]
      if (entry?.isIntersecting && !isLoading && hasMore) {
        setPage((p) => p + 1)
      }
    },
    [isLoading, hasMore]
  )

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '200px',
    })

    const sentinel = sentinelRef.current
    if (sentinel) {
      observerRef.current.observe(sentinel)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [handleIntersect])

  if (error && allPosts.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Erro ao carregar posts</p>
        <p className="mt-1 text-sm text-red-600">{error}</p>
      </div>
    )
  }

  const showInitialLoading = isLoading && allPosts.length === 0
  const showLoadingMore = isLoading && allPosts.length > 0

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 shadow-sm" role="group" aria-label="Filtros de posts">
        <Select
          value={sortBy}
          onValueChange={(v) => {
            if (v) setSortBy(v)
          }}
        >
          <SelectTrigger className="w-[180px] h-9 text-sm border-border/50" aria-label="Ordenar por">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={mediaType ?? 'all'}
          onValueChange={(v) => {
            setMediaType(v === 'all' ? null : v)
          }}
        >
          <SelectTrigger className="w-[160px] h-9 text-sm border-border/50" aria-label="Filtrar por tipo de midia">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {MEDIA_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={contentScore ?? 'all'}
          onValueChange={(v) => {
            setContentScore(v === 'all' ? null : v)
          }}
        >
          <SelectTrigger className="w-[160px] h-9 text-sm border-border/50" aria-label="Filtrar por score de conteudo">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            {SCORE_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground">
          {total > 0 && `${allPosts.length} de ${total} posts`}
        </div>
      </div>

      {/* Grid */}
      {showInitialLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Carregando posts">
          <span className="sr-only">Carregando posts...</span>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl bg-card shadow-sm">
              <Skeleton className="aspect-square w-full" />
              <div className="space-y-2 p-3.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="grid grid-cols-3 gap-1.5">
                  <Skeleton className="h-10 rounded-md" />
                  <Skeleton className="h-10 rounded-md" />
                  <Skeleton className="h-10 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : allPosts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/60 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">Nenhum post encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Tente ajustar os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="list" aria-label="Lista de posts">
          {allPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* Loading more spinner */}
      {showLoadingMore && (
        <div className="flex items-center justify-center gap-2 py-4" role="status" aria-live="polite">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Carregando mais posts...</span>
        </div>
      )}

      {/* Sentinel element for IntersectionObserver */}
      {hasMore && !showInitialLoading && (
        <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      )}

      {/* End-of-list indicator */}
      {!hasMore && allPosts.length > 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Todos os {total} posts foram carregados.
        </p>
      )}
    </div>
  )
}
