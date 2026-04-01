'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface MonitoredHashtag {
  id: string
  hashtag: string
  ig_hashtag_id: string | null
  last_synced_at: string | null
  top_media_count: number
  recent_media_count: number
  is_active: boolean
  hashtag_snapshots: Array<{
    date: string
    top_media: Array<{ id: string; caption?: string; like_count?: number; comments_count?: number; permalink?: string }>
    recent_media: Array<{ id: string; caption?: string; like_count?: number; comments_count?: number; permalink?: string }>
  }>
}

export default function HashtagMonitorPage() {
  const [hashtags, setHashtags] = useState<MonitoredHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [newHashtag, setNewHashtag] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchHashtags = useCallback(async () => {
    try {
      const res = await fetchWithAccount('/api/instagram/hashtag-monitor')
      if (res.ok) setHashtags(await res.json())
    } catch { toast.error('Erro ao carregar hashtags') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchHashtags() }, [fetchHashtags])

  // Auto-selecionar primeira hashtag
  useEffect(() => {
    if (!selectedId && hashtags.length > 0) {
      setSelectedId(hashtags[0].id)
    }
  }, [hashtags, selectedId])

  async function addHashtag() {
    if (!newHashtag.trim()) return
    try {
      await fetchWithAccount('/api/instagram/hashtag-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', hashtag: newHashtag }),
      })
      toast.success(`#${newHashtag.replace(/^#/, '')} adicionada`)
      setNewHashtag('')
      await fetchHashtags()
    } catch { toast.error('Erro ao adicionar') }
  }

  async function syncAll() {
    setSyncing(true)
    try {
      const res = await fetchWithAccount('/api/instagram/hashtag-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      const data = await res.json()
      toast.success(`${data.synced} hashtags sincronizadas`)
      await fetchHashtags()
    } catch { toast.error('Erro ao sincronizar') }
    finally { setSyncing(false) }
  }

  async function removeHashtag(id: string) {
    await fetchWithAccount('/api/instagram/hashtag-monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', id }),
    })
    toast.success('Hashtag removida')
    await fetchHashtags()
  }

  const selected = hashtags.find((h) => h.id === selectedId)
  const latestSnapshot = selected?.hashtag_snapshots?.[0]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoramento de Hashtags</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe hashtags do setor — top posts e posts recentes (30 hashtags/semana)
          </p>
        </div>
        <Button size="sm" onClick={syncAll} disabled={syncing}>
          {syncing ? 'Sincronizando...' : 'Sincronizar Todas'}
        </Button>
      </div>

      {/* Add hashtag */}
      <div className="flex gap-2">
        <input
          value={newHashtag}
          onChange={(e) => setNewHashtag(e.target.value)}
          placeholder="Ex: destinationwedding"
          className="flex-1 max-w-xs rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
        />
        <Button size="sm" onClick={addHashtag} disabled={!newHashtag.trim()}>
          + Adicionar
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : hashtags.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-2xl mb-2">🏷</p>
            <p className="text-sm">Nenhuma hashtag monitorada</p>
            <p className="text-xs mt-1">Adicione hashtags para acompanhar o desempenho</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
          {/* Hashtag list */}
          <div className="space-y-2">
            {hashtags.map((ht) => (
              <Card
                key={ht.id}
                className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${selectedId === ht.id ? 'ring-2 ring-primary/30' : ''}`}
                onClick={() => setSelectedId(ht.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">#{ht.hashtag}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          Top: {ht.top_media_count}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Recentes: {ht.recent_media_count}
                        </span>
                      </div>
                      {ht.last_synced_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Sync: {new Date(ht.last_synced_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-red-400"
                      onClick={(e) => { e.stopPropagation(); removeHashtag(ht.id) }}
                    >
                      ✕
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail view */}
          {selected ? (
            <div className="space-y-4">
              {!latestSnapshot ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <p className="text-2xl mb-2">🔄</p>
                    <p className="text-sm">Nenhum snapshot para #{selected.hashtag}</p>
                    <p className="text-xs mt-1">Clique em &ldquo;Sincronizar Todas&rdquo; para buscar dados</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <MediaSection
                    title={`Top Posts — #${selected.hashtag}`}
                    media={latestSnapshot.top_media}
                    emptyMessage="A API do Instagram nao retornou top posts para esta hashtag"
                  />
                  <MediaSection
                    title={`Posts Recentes — #${selected.hashtag}`}
                    media={latestSnapshot.recent_media}
                    emptyMessage="A API do Instagram nao retornou posts recentes para esta hashtag"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    Dados de {new Date(latestSnapshot.date).toLocaleDateString('pt-BR')}
                  </p>
                </>
              )}
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-muted-foreground">
                <p className="text-sm">Selecione uma hashtag para ver os dados</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function MediaSection({ title, media, emptyMessage }: {
  title: string
  media: Array<{ id: string; caption?: string; like_count?: number; comments_count?: number; permalink?: string }>
  emptyMessage: string
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {media.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {media.slice(0, 10).map((post, i) => (
              <div key={post.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">
                    {i + 1}. {post.caption?.slice(0, 80) ?? '(sem caption)'}
                  </p>
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground shrink-0 ml-3">
                  <span>❤ {post.like_count ?? 0}</span>
                  <span>💬 {post.comments_count ?? 0}</span>
                  {post.permalink && (
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-primary">
                      Ver
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
