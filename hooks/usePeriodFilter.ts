'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type Period = '7d' | '30d' | '90d' | '365d' | 'all'

const STORAGE_KEY = 'dashig_period'
const EVENT_NAME = 'dashig:period-change'
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

/**
 * Single shared source of truth for the period filter. Every consumer subscribes
 * to the same custom event, so clicking the selector in the header re-fetches
 * data in every page that uses this hook. Also honors `storage` events so
 * changes in another tab sync back.
 */
export function usePeriodFilter() {
  const [period, setPeriodState] = useState<Period>(getStoredPeriod)

  useEffect(() => {
    function onLocalChange(event: Event) {
      const detail = (event as CustomEvent<{ period: Period }>).detail
      if (detail?.period && detail.period in PERIOD_DAYS) {
        setPeriodState(detail.period)
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && event.newValue && event.newValue in PERIOD_DAYS) {
        setPeriodState(event.newValue as Period)
      }
    }
    window.addEventListener(EVENT_NAME, onLocalChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENT_NAME, onLocalChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setPeriod = useCallback((p: Period) => {
    setPeriodState(p)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, p)
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { period: p } }))
    }
  }, [])

  const { startDate, endDate, days } = useMemo(() => {
    const end = new Date()
    const d = PERIOD_DAYS[period]
    const start = d !== null ? new Date(end.getTime() - d * 86_400_000) : null
    return {
      startDate: start ? start.toISOString().split('T')[0] : null,
      endDate: end.toISOString().split('T')[0],
      days: d,
    }
  }, [period])

  return { period, setPeriod, startDate, endDate, days }
}
