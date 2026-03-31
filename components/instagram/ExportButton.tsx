'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  type: 'posts' | 'reels' | 'hashtags'
}

export default function ExportButton({ type }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await fetchWithAccount(`/api/instagram/export?type=${type}`)
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashig-${type}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // silenciar
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="h-9 gap-1.5"
    >
      {isExporting ? 'Exportando...' : '↓ CSV'}
    </Button>
  )
}
