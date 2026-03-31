'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface StrategyChatPanelProps {
  campaignId: string
}

export default function StrategyChatPanel({ campaignId }: StrategyChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetchWithAccount(`/api/campaigns/${campaignId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro no chat')
      }

      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.message }])
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Erro: ${err instanceof Error ? err.message : 'Falha na conexao'}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="w-full border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
      >
        💬 Discutir estrategia com a IA
      </Button>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          💬 Chat Estrategico
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          onClick={() => setIsOpen(false)}
        >
          Fechar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="font-medium">Exemplos de perguntas:</p>
            <p>• Por que escolheu Reel para o post #3 em vez de Carrossel?</p>
            <p>• Acha que 15 posts em 15 dias nao e muito? Qual a frequencia ideal?</p>
            <p>• Os horarios fazem sentido para o publico de noivas?</p>
            <p>• Sugira alternativas para o post #5 com foco em saves</p>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="max-h-[400px] overflow-y-auto space-y-3 pr-1"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                Pensando...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Questione a estrategia, peca alternativas..."
            rows={2}
            className="text-sm resize-none"
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 self-end"
            size="sm"
          >
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
