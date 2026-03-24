'use client'

import { useState, useEffect } from 'react'
import type { AccountSnapshot } from '@/types/instagram'

interface UseInstagramMetricsResult {
  snapshots: AccountSnapshot[]
  current: AccountSnapshot | null
  previous: AccountSnapshot | null
  isLoading: boolean
  error: string | null
}

export function useInstagramMetrics(days = 30): UseInstagramMetricsResult {
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
