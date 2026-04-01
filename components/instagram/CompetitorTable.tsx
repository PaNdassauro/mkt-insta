'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/analytics'
import type { Competitor, CompetitorSnapshot } from '@/types/instagram'

interface CompetitorWithSnapshot extends Competitor {
  latest_snapshot: CompetitorSnapshot | null
}

export default function CompetitorTable() {
  const [competitors, setCompetitors] = useState<CompetitorWithSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newUsername, setNewUsername] = useState('')
  const [adding, setAdding] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)

  const syncCompetitors = async () => {
    setSyncingAll(true)
    try {
      // Re-adicionar cada concorrente para buscar dados via Business Discovery
      for (const comp of competitors) {
        await fetchWithAccount('/api/instagram/competitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: comp.username }),
        })
      }
      toast.success('Dados de concorrentes atualizados')
      await fetchData()
    } catch {
      toast.error('Erro ao sincronizar concorrentes')
    } finally {
      setSyncingAll(false)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const res = await fetchWithAccount('/api/instagram/competitors')
      const json = await res.json()
      setCompetitors(json.data ?? [])
    } catch {
      // silenciar
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const addCompetitor = async () => {
    if (!newUsername.trim()) return
    setAdding(true)
    try {
      await fetchWithAccount('/api/instagram/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim() }),
      })
      setNewUsername('')
      await fetchData()
    } catch {
      // silenciar
    } finally {
      setAdding(false)
    }
  }

  const removeCompetitor = async (id: string) => {
    try {
      await fetchWithAccount(`/api/instagram/competitors?id=${id}`, { method: 'DELETE' })
      await fetchData()
    } catch {
      // silenciar
    }
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-48 w-full rounded-lg" /></CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Concorrentes Monitorados</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Benchmarking via Instagram Business Discovery</p>
          </div>
          <div>
            {competitors.length > 0 && (
              <Button size="sm" variant="outline" onClick={syncCompetitors} disabled={syncingAll}>
                {syncingAll ? 'Sincronizando...' : 'Atualizar dados'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Adicionar concorrente */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
              placeholder="username do concorrente"
              className="w-full rounded-lg border border-border/50 bg-background pl-7 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button
            onClick={addCompetitor}
            disabled={adding || !newUsername.trim()}
            size="sm"
            className="h-9 px-4"
          >
            {adding ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>

        {competitors.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border/60 p-10 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="font-medium text-muted-foreground">Nenhum concorrente cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground/70">Adicione perfis concorrentes acima para acompanhar metricas e comparar performance.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Perfil</TableHead>
                  <TableHead>Seguidores</TableHead>
                  <TableHead>Posts (30d)</TableHead>
                  <TableHead>Reels (30d)</TableHead>
                  <TableHead>Media Likes</TableHead>
                  <TableHead>Media Coment.</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((comp) => {
                  const snap = comp.latest_snapshot
                  return (
                    <TableRow key={comp.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-[10px] font-bold">
                            {comp.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">@{comp.username}</p>
                            {comp.display_name && comp.display_name !== comp.username && (
                              <p className="text-[11px] text-muted-foreground">{comp.display_name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {snap?.followers_count ? formatNumber(snap.followers_count) : '—'}
                      </TableCell>
                      <TableCell>{snap?.posts_last_30d ?? '—'}</TableCell>
                      <TableCell>{snap?.reels_last_30d ?? '—'}</TableCell>
                      <TableCell>{snap?.avg_likes_last_10 ? formatNumber(snap.avg_likes_last_10) : '—'}</TableCell>
                      <TableCell>{snap?.avg_comments_last_10 ? formatNumber(snap.avg_comments_last_10) : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(comp.added_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => removeCompetitor(comp.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Remover"
                        >
                          ✕
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {competitors.length > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Os dados de concorrentes sao coletados semanalmente via dados publicos. Aguarde o proximo sync para metricas.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
