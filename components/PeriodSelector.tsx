'use client'

import { cn } from '@/lib/utils'
import { type Period, usePeriodFilter } from '@/hooks/usePeriodFilter'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '365d', label: '1 ano' },
  { value: 'all', label: 'Tudo' },
]

export function PeriodSelector() {
  const { period, setPeriod } = usePeriodFilter()

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setPeriod(opt.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            period === opt.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
