'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const CompetitorEvolutionChart = dynamic(
  () => import('@/components/instagram/CompetitorEvolutionChart'),
  { ssr: false }
)

interface CompetitorInfo {
  id: string
  username: string
}

export default function CompetitorEvolutionWrapper() {
  const [competitors, setCompetitors] = useState<CompetitorInfo[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function fetchCompetitors() {
      try {
        const res = await fetch('/api/instagram/competitors')
        if (!res.ok) return
        const json = await res.json()
        const list = (json.data ?? []) as Array<{ id: string; username: string }>
        setCompetitors(list.map((c) => ({ id: c.id, username: c.username })))
      } catch {
        // silenciar
      } finally {
        setLoaded(true)
      }
    }
    fetchCompetitors()
  }, [])

  if (!loaded || competitors.length === 0) return null

  return <CompetitorEvolutionChart competitors={competitors} />
}
