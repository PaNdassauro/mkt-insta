'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import type { Conversation, Message, AutoReplyRule } from '@/types/instagram'

type ConversationWithLastMessage = Conversation & {
  last_message: { content: string | null; direction: string; timestamp: string; is_auto_reply: boolean } | null
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [rules, setRules] = useState<AutoReplyRule[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [showRules, setShowRules] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram/messages')
      if (res.ok) setConversations(await res.json())
    } catch { toast.error('Erro ao carregar conversas') }
    finally { setLoading(false) }
  }, [])

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/instagram/messages/${convId}`)
      if (res.ok) {
        setMessages(await res.json())
        // Scroll to bottom
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch { toast.error('Erro ao carregar mensagens') }
  }, [])

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/instagram/auto-reply')
      if (res.ok) setRules(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchConversations()
    fetchRules()
    // Poll for new messages every 15s
    const poller = setInterval(fetchConversations, 15000)
    return () => clearInterval(poller)
  }, [fetchConversations, fetchRules])

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId)
  }, [selectedId, fetchMessages])

  async function sendReply() {
    if (!replyText.trim() || !selectedId || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/instagram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selectedId, text: replyText.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Erro ao enviar')
        return
      }
      setReplyText('')
      await fetchMessages(selectedId)
      await fetchConversations()
    } catch {
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  async function saveRule(rule: Partial<AutoReplyRule> & { id?: string }) {
    const method = rule.id ? 'PUT' : 'POST'
    const res = await fetch('/api/instagram/auto-reply', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    })
    if (res.ok) {
      toast.success(rule.id ? 'Regra atualizada' : 'Regra criada')
      await fetchRules()
    } else {
      toast.error('Erro ao salvar regra')
    }
  }

  async function deleteRule(id: string) {
    await fetch(`/api/instagram/auto-reply?id=${id}`, { method: 'DELETE' })
    toast.success('Regra removida')
    await fetchRules()
  }

  const selectedConv = conversations.find((c) => c.id === selectedId)
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Mensagens
            {totalUnread > 0 && (
              <Badge className="ml-2 bg-red-500 text-white border-0">{totalUnread}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            DMs do Instagram — responda casais e gerencie auto-replies
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={async () => {
              try {
                const res = await fetch('/api/instagram/messages/enrich', { method: 'POST' })
                if (res.ok) {
                  const data = await res.json()
                  toast.success(`${data.enriched} nomes atualizados`)
                  await fetchConversations()
                } else {
                  toast.error('Erro ao buscar nomes')
                }
              } catch { toast.error('Erro de conexao') }
            }}
          >
            Atualizar nomes
          </Button>
          <Button
            size="sm"
            variant={showRules ? 'default' : 'outline'}
            onClick={() => setShowRules(!showRules)}
          >
            {showRules ? 'Ver Conversas' : 'Auto-Reply Rules'}
          </Button>
        </div>
      </div>

      {showRules ? (
        <AutoReplyManager rules={rules} onSave={saveRule} onDelete={deleteRule} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px,1fr] min-h-[600px]">
          {/* Conversation list */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-2xl mb-2">💬</p>
                  <p className="text-sm">Nenhuma conversa ainda</p>
                  <p className="text-xs mt-1">
                    Configure o webhook no Meta App para receber DMs
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedId(conv.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                        selectedId === conv.id ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(conv.username ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">
                              {conv.username ?? conv.ig_user_id.slice(0, 8)}
                            </p>
                            {conv.unread_count > 0 && (
                              <Badge className="bg-red-500 text-white border-0 text-[10px] shrink-0">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                          {conv.last_message && (
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.last_message.direction === 'OUTGOING' && 'Voce: '}
                              {conv.last_message.content ?? '(midia)'}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat view */}
          <Card className="border-0 shadow-sm flex flex-col">
            {selectedConv ? (
              <>
                <CardHeader className="pb-2 border-b shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                      {(selectedConv.username ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-sm">
                        {selectedConv.username ?? selectedConv.ig_user_id}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[450px]">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          msg.direction === 'OUTGOING'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/70'
                        }`}
                      >
                        {msg.content && <p className="text-sm">{msg.content}</p>}
                        {msg.media_url && (
                          <img
                            src={msg.media_url}
                            alt=""
                            className="max-w-full rounded-lg mt-1"
                          />
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] opacity-60">
                            {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.is_auto_reply && (
                            <span className="text-[10px] opacity-60">• Auto</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply input */}
                <div className="p-4 border-t shrink-0">
                  <div className="flex gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendReply()
                        }
                      }}
                      placeholder="Digite sua resposta..."
                      rows={2}
                      className="text-sm resize-none"
                      disabled={sending}
                    />
                    <Button
                      onClick={sendReply}
                      disabled={!replyText.trim() || sending}
                      className="shrink-0 self-end"
                    >
                      {sending ? '...' : 'Enviar'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-sm">Selecione uma conversa</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function AutoReplyManager({
  rules,
  onSave,
  onDelete,
}: {
  rules: AutoReplyRule[]
  onSave: (rule: Partial<AutoReplyRule> & { id?: string }) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    keywords: '',
    match_type: 'contains' as const,
    reply_text: '',
    priority: 0,
  })

  function handleSave() {
    if (!form.name || !form.keywords || !form.reply_text) {
      toast.error('Preencha todos os campos')
      return
    }
    onSave({
      name: form.name,
      keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      match_type: form.match_type,
      reply_text: form.reply_text,
      priority: form.priority,
    })
    setForm({ name: '', keywords: '', match_type: 'contains', reply_text: '', priority: 0 })
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Regras de Auto-Reply</h2>
        <Button size="sm" onClick={() => setEditing(!editing)}>
          {editing ? 'Cancelar' : '+ Nova Regra'}
        </Button>
      </div>

      {editing && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Resposta sobre precos"
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Keywords (virgula)
                </label>
                <input
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="preco, quanto custa, valor, orcamento"
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Resposta automatica
              </label>
              <Textarea
                value={form.reply_text}
                onChange={(e) => setForm({ ...form, reply_text: e.target.value })}
                rows={3}
                className="text-sm"
                placeholder="Oi! Obrigada pelo interesse! Nossos pacotes comecam a partir de..."
              />
            </div>
            <Button size="sm" onClick={handleSave}>Salvar Regra</Button>
          </CardContent>
        </Card>
      )}

      {rules.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma regra configurada</p>
            <p className="text-xs mt-1">
              Crie regras para responder automaticamente perguntas frequentes
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{rule.name}</p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${rule.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}
                      >
                        {rule.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {rule.usage_count}x usada
                      </span>
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {rule.keywords.map((k) => (
                        <Badge key={k} variant="secondary" className="text-[10px]">
                          {k}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {rule.reply_text}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onSave({ id: rule.id, is_active: !rule.is_active })
                      }
                    >
                      {rule.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500"
                      onClick={() => onDelete(rule.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
