'use client'

import { useState, useEffect, useCallback } from 'react'
import type { InstagramPost } from '@/types/instagram'

interface UsePostPerformanceParams {
  limit?: number
  offset?: number
  sortBy?: string
  order?: 'asc' | 'desc'
  mediaType?: string | null
  contentScore?: string | null
}

interface UsePostPerformanceResult {
  posts: InstagramPost[]
  total: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function usePostPerformance(
  params: UsePostPerformanceParams = {}
): UsePostPerformanceResult {
  const {
    limit = 20,
    offset = 0,
    sortBy = 'timestamp',
    order = 'desc',
    mediaType = null,
    contentScore = null,
  } = params

  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const searchParams = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        sort_by: sortBy,
        order,
      })
      if (mediaType) searchParams.set('media_type', mediaType)
      if (contentScore) searchParams.set('content_score', contentScore)

      const res = await fetch(`/api/instagram/posts?${searchParams}`)
      if (!res.ok) throw new Error('Erro ao buscar posts')
      const json = await res.json()
      setPosts(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [limit, offset, sortBy, order, mediaType, contentScore])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { posts, total, isLoading, error, refetch: fetchData }
}
