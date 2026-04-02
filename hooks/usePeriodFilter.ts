'use client'

import { useState, useCallback, useMemo } from 'react'

export type Period = '7d' | '30d' | '90d' | '365d' | 'all'

const STORAGE_KEY = 'dashig_period'
const DEFAULT_PERIOD: Period = '30d'

const PERIOD_DAYS: Record<Period, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
  'all': null,
}

function getStoredPeriod(): Period {
  if (typeof window === 'undefined') return DEFAULT_PERIOD
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && stored in PERIOD_DAYS) return stored as Period
  return DEFAULT_PERIOD
}

export function usePeriodFilter() {
  const [period, setPeriodState] = useState<Period>(getStoredPeriod)

  const setPeriod = useCallback((p: Period) => {
    setPeriodState(p)
    localStorage.setItem(STORAGE_KEY, p)
  }, [])

  const { startDate, endDate } = useMemo(() => {
    const end = new Date()
    const days = PERIOD_DAYS[period]
    const start = days !== null
      ? new Date(end.getTime() - days * 86_400_000)
      : null
    return {
      startDate: start ? start.toISOString().split('T')[0] : null,
      endDate: end.toISOString().split('T')[0],
    }
  }, [period])

  const days = PERIOD_DAYS[period]

  return { period, setPeriod, startDate, endDate, days }
}
