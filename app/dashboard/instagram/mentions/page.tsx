'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { InstagramMention } from '@/types/instagram'

export default function MentionsPage() {
  const [mentions, setMentions] = useState<InstagramMention[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  const fetchMentions = useCallback(async () => {
    try {
      const url = showSaved ? '/api/instagram/mentions?saved=true' : '/api/instagram/mentions'
      const res = await fetch(url)
      if (res.ok) setMentions(await res.json())
    } catch { toast.error('Erro ao carregar mencoes') }
    finally { setLoading(false) }
  }, [showSaved])

  useEffect(() => { fetchMentions() }, [fetchMentions])

  async function syncMentions() {
    setSyncing(true)
    try {
      const res = await fetch('/api/instagram/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      const data = await res.json()
      toast.success(`${data.synced} mencoes sincronizadas`)
      await fetchMentions()
    } catch { toast.error('Erro ao sincronizar') }
    finally { setSyncing(false) }
  }

  async function toggleSave(mention: InstagramMention) {
    await fetch('/api/instagram/mentions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: mention.is_saved ? 'unsave' : 'save',
        id: mention.id,
      }),
    })
    toast.success(mention.is_saved ? 'Removido do UGC' : 'Salvo como UGC')
    await fetchMentions()
  }

  const savedCount = mentions.filter((m) => m.is_saved).length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mencoes e Tags</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conteudo onde @welcomeweddings foi mencionada ou tagueada
          </p>
        </div>
        <Button size="sm" onClick={syncMentions} disabled={syncing}>
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        <Button
          size="sm"
          variant={!showSaved ? 'default' : 'ghost'}
          className="h-8 text-xs"
          onClick={() => { setShowSaved(false); setLoading(true) }}
        >
          Todas ({mentions.length})
        </Button>
        <Button
          size="sm"
          variant={showSaved ? 'default' : 'ghost'}
          className="h-8 text-xs"
          onClick={() => { setShowSaved(true); setLoading(true) }}
        >
          UGC Salvo ({savedCount})
        </Button>
      </div>

      {/* Mentions grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : mentions.length === 0 ? (
        <Card className="border-2 border-dashed border-border/60 shadow-sm">
          <CardContent className="p-10 text-center">
            <p className="text-3xl mb-3">📷</p>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma mencao encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">Sincronize para buscar posts que mencionaram ou taguearam @welcomeweddings.</p>
            <Button size="sm" className="mt-4" onClick={syncMentions} disabled={syncing}>
              {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mentions.map((mention) => (
            <Card key={mention.id} className="border-0 shadow-sm overflow-hidden">
              {/* Media preview */}
              {mention.media_url && (
                <div className="aspect-square bg-muted/30 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mention.media_url}
                    alt={`Post de @${mention.username}`}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {mention.is_saved && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-yellow-400 text-yellow-900 border-0 text-[10px]">
                        UGC
                      </Badge>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2">
                    <Badge className="bg-black/60 text-white border-0 text-[10px]">
                      @{mention.username}
                    </Badge>
                  </div>
                </div>
              )}

              <CardContent className="p-4">
                {!mention.media_url && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">@{mention.username}</span>
                    {mention.is_saved && (
                      <Badge className="bg-yellow-50 text-yellow-600 border-0 text-[10px]">UGC</Badge>
                    )}
                  </div>
                )}

                {mention.caption && (
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-2">
                    {mention.caption}
                  </p>
                )}

                {mention.timestamp && (
                  <p className="text-[10px] text-muted-foreground mb-3">
                    {new Date(mention.timestamp).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={mention.is_saved ? 'default' : 'outline'}
                    className="text-xs flex-1"
                    onClick={() => toggleSave(mention)}
                  >
                    {mention.is_saved ? '★ Salvo' : '☆ Salvar UGC'}
                  </Button>
                  {mention.permalink && (
                    <a
                      href={mention.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center"
                    >
                      Ver no IG
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
