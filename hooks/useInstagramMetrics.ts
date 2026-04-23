'use client'

import { useState, useEffect } from 'react'
import { usePeriodFilter } from '@/hooks/usePeriodFilter'
import type { AccountSnapshot } from '@/types/instagram'

interface UseInstagramMetricsResult {
  snapshots: AccountSnapshot[]
  current: AccountSnapshot | null
  previous: AccountSnapshot | null
  isLoading: boolean
  error: string | null
}

/**
 * `fallbackDays` is used only when the period filter is set to "Tudo" (all-time)
 * — the /insights endpoint expects a `days` number, so callers provide a hint
 * of how far back to look (e.g. 365 for Growth, 90 for Overview).
 */
export function useInstagramMetrics(fallbackDays = 30): UseInstagramMetricsResult {
  const { days: periodDays } = usePeriodFilter()
  const days = periodDays ?? fallbackDays

  const [snapshots, setSnapshots] = useState<AccountSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/instagram/insights?days=${days}`)
        if (!res.ok) throw new Error('Erro ao buscar metricas')
        const json = await res.json()
        setSnapshots(json.data ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [days])

  const current = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null

  return { snapshots, current, previous, isLoading, error }
}
