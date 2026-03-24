'use client'

import { useState } from 'react'
import PostCard from './PostCard'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { usePostPerformance } from '@/hooks/usePostPerformance'
import { ITEMS_PER_PAGE } from '@/lib/constants'

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

  const { posts, total, isLoading, error } = usePostPerformance({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    sortBy,
    order: 'desc',
    mediaType,
    contentScore,
  })

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Erro ao carregar posts</p>
        <p className="mt-1 text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
        <Select value={sortBy} onValueChange={(v) => { if (v) setSortBy(v) }}>
          <SelectTrigger className="w-[180px] h-9 text-sm border-border/50">
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
            setPage(0)
          }}
        >
          <SelectTrigger className="w-[160px] h-9 text-sm border-border/50">
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
            setPage(0)
          }}
        >
          <SelectTrigger className="w-[160px] h-9 text-sm border-border/50">
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
          {total > 0 && `${total} posts`}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      ) : posts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/60 p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">Nenhum post encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Tente ajustar os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="h-9 px-4"
          >
            Anterior
          </Button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum = page <= 2 ? i : page - 2 + i
              if (pageNum >= totalPages) return null
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors ${
                    pageNum === page
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {pageNum + 1}
                </button>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="h-9 px-4"
          >
            Proxima
          </Button>
        </div>
      )}
    </div>
  )
}
