'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ScheduleButtonProps {
  campaignId: string
  disabled?: boolean
  onScheduled?: () => void
}

export default function ScheduleButton({
  campaignId,
  disabled,
  onScheduled,
}: ScheduleButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ scheduled: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSchedule() {
    if (!confirm('Deseja agendar todos os posts aprovados no calendario editorial?')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetchWithAccount(`/api/campaigns/${campaignId}/schedule`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao agendar')
      }

      const data = await res.json()
      setResult(data)
      onScheduled?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao agendar')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <span>✓</span>
        <span>
          {result.scheduled} de {result.total} posts agendados no calendario
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleSchedule}
        disabled={disabled || loading}
        className="bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {loading ? 'Agendando...' : '📅 Agendar Campanha'}
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
