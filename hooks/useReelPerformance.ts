'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePeriodFilter } from '@/hooks/usePeriodFilter'
import type { InstagramReel } from '@/types/instagram'

interface UseReelPerformanceParams {
  limit?: number
  offset?: number
  sortBy?: string
  order?: 'asc' | 'desc'
  contentScore?: string | null
}

interface UseReelPerformanceResult {
  reels: InstagramReel[]
  total: number
  isLoading: boolean
  error: string | null
}

export function useReelPerformance(
  params: UseReelPerformanceParams = {}
): UseReelPerformanceResult {
  const {
    limit = 20,
    offset = 0,
    sortBy = 'timestamp',
    order = 'desc',
    contentScore = null,
  } = params

  const { startDate, endDate } = usePeriodFilter()

  const [reels, setReels] = useState<InstagramReel[]>([])
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
      if (contentScore) searchParams.set('content_score', contentScore)
      if (startDate) searchParams.set('since', startDate)
      if (endDate) searchParams.set('until', endDate)

      const res = await fetch(`/api/instagram/reels?${searchParams}`)
      if (!res.ok) throw new Error('Erro ao buscar reels')
      const json = await res.json()
      setReels(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [limit, offset, sortBy, order, contentScore, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { reels, total, isLoading, error }
}
