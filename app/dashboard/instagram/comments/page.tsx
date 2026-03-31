'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import SentimentChart from '@/components/instagram/SentimentChart'
import type { InstagramComment } from '@/types/instagram'

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'unreplied', label: 'Sem resposta' },
  { value: 'questions', label: 'Perguntas' },
  { value: 'hidden', label: 'Ocultos' },
]

const SENTIMENT_BADGE: Record<string, { label: string; color: string }> = {
  POSITIVE: { label: 'Positivo', color: 'bg-green-50 text-green-600' },
  NEUTRAL: { label: 'Neutro', color: 'bg-gray-50 text-gray-500' },
  NEGATIVE: { label: 'Negativo', color: 'bg-red-50 text-red-500' },
  QUESTION: { label: 'Pergunta', color: 'bg-blue-50 text-blue-600' },
}

export default function CommentsPage() {
  const [comments, setComments] = useState<InstagramComment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState('unreplied')
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/instagram/comments?filter=${filter}`)
      if (res.ok) setComments(await res.json())
    } catch { toast.error('Erro ao carregar comentarios') }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { fetchComments() }, [fetchComments])

  async function syncComments() {
    setSyncing(true)
    try {
      const res = await fetch('/api/instagram/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      const data = await res.json()
      toast.success(`${data.synced} comentarios sincronizados`)
      await fetchComments()
    } catch { toast.error('Erro ao sincronizar') }
    finally { setSyncing(false) }
  }

  async function reply(commentId: string) {
    if (!replyText.trim()) return
    try {
      const res = await fetch('/api/instagram/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', comment_id: commentId, text: replyText }),
      })
      if (res.ok) {
        toast.success('Resposta enviada')
        setReplyingId(null)
        setReplyText('')
        await fetchComments()
      } else {
        const data = await res.json()
        toast.error(data.error)
      }
    } catch { toast.error('Erro ao responder') }
  }

  async function hideComment(commentId: string, hide: boolean) {
    await fetch('/api/instagram/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hide', comment_id: commentId, hide }),
    })
    toast.success(hide ? 'Comentario oculto' : 'Comentario visivel')
    await fetchComments()
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Deletar permanentemente este comentario?')) return
    await fetch('/api/instagram/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', comment_id: commentId }),
    })
    toast.success('Comentario deletado')
    await fetchComments()
  }

  const unrepliedCount = comments.filter((c) => !c.is_replied && !c.is_hidden).length
  const questionCount = comments.filter((c) => c.sentiment === 'QUESTION').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comentarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie comentarios — responda, oculte ou delete
          </p>
        </div>
        <Button size="sm" onClick={syncComments} disabled={syncing} aria-label="Sincronizar comentarios">
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <Badge variant="secondary" className="text-xs">
          {comments.length} comentarios
        </Badge>
        {unrepliedCount > 0 && (
          <Badge className="bg-yellow-50 text-yellow-600 border-0 text-xs">
            {unrepliedCount} sem resposta
          </Badge>
        )}
        {questionCount > 0 && (
          <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">
            {questionCount} perguntas
          </Badge>
        )}
      </div>

      {/* Sentiment Chart */}
      <SentimentChart />

      {/* Filters */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit" role="group" aria-label="Filtros de comentarios">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? 'default' : 'ghost'}
            className="h-8 text-xs"
            onClick={() => { setFilter(f.value); setLoading(true) }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="space-y-3" role="status" aria-label="Carregando comentarios">
          <span className="sr-only">Carregando comentarios...</span>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhum comentario encontrado</p>
            <p className="text-xs mt-1">Clique em Sincronizar para buscar comentarios das midias recentes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" aria-live="polite">
          {comments.map((comment) => {
            const sentCfg = SENTIMENT_BADGE[comment.sentiment ?? 'NEUTRAL']
            return (
              <Card key={comment.id} className={`border-0 shadow-sm ${comment.is_hidden ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">@{comment.username}</span>
                        <Badge className={`${sentCfg.color} border-0 text-[10px]`}>
                          {sentCfg.label}
                        </Badge>
                        {comment.is_replied && (
                          <Badge className="bg-green-50 text-green-600 border-0 text-[10px]">
                            Respondido
                          </Badge>
                        )}
                        {comment.is_hidden && (
                          <Badge className="bg-gray-50 text-gray-400 border-0 text-[10px]">
                            Oculto
                          </Badge>
                        )}
                        {comment.timestamp && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(comment.timestamp).toLocaleDateString('pt-BR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{comment.text}</p>

                      {comment.reply_text && (
                        <div className="mt-2 pl-3 border-l-2 border-primary/30">
                          <p className="text-xs text-primary">@welcomeweddings: {comment.reply_text}</p>
                        </div>
                      )}

                      {/* Reply form */}
                      {replyingId === comment.comment_id && (
                        <div className="mt-3 flex gap-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={2}
                            className="text-sm"
                            aria-label={`Resposta para @${comment.username}`}
                            placeholder="Escreva sua resposta..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                reply(comment.comment_id)
                              }
                            }}
                          />
                          <div className="flex flex-col gap-1">
                            <Button size="sm" onClick={() => reply(comment.comment_id)}>
                              Enviar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setReplyingId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      {!comment.is_replied && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          aria-label={`Responder comentario de @${comment.username}`}
                          onClick={() => { setReplyingId(comment.comment_id); setReplyText('') }}
                        >
                          Responder
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        aria-label={comment.is_hidden ? `Mostrar comentario de @${comment.username}` : `Ocultar comentario de @${comment.username}`}
                        onClick={() => hideComment(comment.comment_id, !comment.is_hidden)}
                      >
                        {comment.is_hidden ? 'Mostrar' : 'Ocultar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-red-500"
                        aria-label={`Deletar comentario de @${comment.username}`}
                        onClick={() => deleteComment(comment.comment_id)}
                      >
                        Deletar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
