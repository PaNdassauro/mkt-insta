'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { PostFormat } from '@/types/instagram'

const FORMAT_OPTIONS: { value: PostFormat; label: string }[] = [
  { value: 'REEL', label: 'Reel' },
  { value: 'CAROUSEL', label: 'Carrossel' },
  { value: 'IMAGE', label: 'Imagem' },
  { value: 'STORY', label: 'Story' },
]

type GenerationPhase = 'idle' | 'context' | 'generating' | 'saving' | 'done' | 'error'

export default function BriefingForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<GenerationPhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [generatedText, setGeneratedText] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [theme, setTheme] = useState('')
  const [toneNotes, setToneNotes] = useState('')
  const [durationDays, setDurationDays] = useState(7)
  const [startDate, setStartDate] = useState(getDefaultStartDate())
  const [formats, setFormats] = useState<PostFormat[]>(['REEL', 'CAROUSEL', 'IMAGE'])

  function toggleFormat(format: PostFormat) {
    setFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    )
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startTimer() {
    setElapsed(0)
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim() || !objective.trim() || !theme.trim()) {
      setError('Titulo, objetivo e tema sao obrigatorios.')
      return
    }

    if (formats.length === 0) {
      setError('Selecione pelo menos um formato.')
      return
    }

    setLoading(true)
    setError(null)
    setPhase('context')
    setGeneratedText('')
    startTimer()

    try {
      const res = await fetchWithAccount('/api/campaigns/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          objective: objective.trim(),
          target_audience: targetAudience.trim(),
          theme: theme.trim(),
          tone_notes: toneNotes.trim() || undefined,
          duration_days: durationDays,
          start_date: startDate,
          preferred_formats: formats,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao iniciar geracao')
      }

      const campaignId = res.headers.get('X-Campaign-Id')
      setPhase('generating')

      // Consumir stream inline
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          fullText += chunk

          // Checar se recebemos metadata de conclusao
          if (fullText.includes('---METADATA---')) {
            setPhase('saving')
            const metaPart = fullText.split('---METADATA---')[1]?.trim()
            if (metaPart) {
              try {
                const meta = JSON.parse(metaPart)
                if (meta.__done) {
                  stopTimer()
                  setPhase('done')

                  // Redirecionar para a campanha gerada
                  const targetId = meta.campaign_id || campaignId
                  setTimeout(() => {
                    router.push(`/dashboard/instagram/campaigns/${targetId}`)
                  }, 1500)
                  return
                }
              } catch {
                // metadata incompleta ainda, continuar lendo
              }
            }
          }

          // Checar se recebemos erro
          if (fullText.includes('---ERROR---')) {
            const errorPart = fullText.split('---ERROR---')[1]?.trim()
            if (errorPart) {
              try {
                const errData = JSON.parse(errorPart)
                throw new Error(errData.error || 'Erro na geracao')
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue
                throw parseErr
              }
            }
          }

          // Atualizar texto exibido (sem metadata markers)
          const displayText = fullText.split('---METADATA---')[0].split('---ERROR---')[0]
          setGeneratedText(displayText)

          // Atualizar fase baseado no tamanho do texto recebido
          if (fullText.length > 50) {
            setPhase('generating')
          }
        }
      }

      // Se chegou aqui sem metadata, tentar redirect pelo campaignId
      if (campaignId && phase !== 'done') {
        stopTimer()
        setPhase('done')
        setTimeout(() => {
          router.push(`/dashboard/instagram/campaigns/${campaignId}`)
        }, 1500)
      }
    } catch (err) {
      stopTimer()
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setLoading(false)
    }
  }

  // Se estamos gerando, mostra a tela de progresso
  if (phase !== 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
        {(phase === 'context' || phase === 'generating' || phase === 'saving') && (
          <>
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold">Gerando campanha...</h2>
              <p className="text-sm text-muted-foreground">
                A IA esta analisando seus dados e criando a campanha.
                <br />
                Isso pode levar de 30 a 60 segundos.
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTime(elapsed)} decorridos
              </p>
            </div>

            <Card className="border-0 shadow-sm w-full max-w-md">
              <CardContent className="p-4 space-y-3">
                <ProgressStep done={phase !== 'context'} active={phase === 'context'} label="Buscando contexto na Knowledge Base" />
                <ProgressStep done={phase === 'generating' || phase === 'saving'} active={phase === 'context'} label="Carregando metricas do perfil" />
                <ProgressStep done={phase === 'generating' || phase === 'saving'} active={phase === 'context'} label="Montando prompt com 3 camadas" />
                <ProgressStep done={phase === 'saving'} active={phase === 'generating'} label="Gerando campanha com IA" />
                <ProgressStep done={false} active={phase === 'saving'} label="Validando e salvando posts" />
              </CardContent>
            </Card>

            {generatedText.length > 100 && (
              <Card className="border-0 shadow-sm w-full max-w-md">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Preview da geracao:</p>
                  <pre className="text-xs text-foreground/70 whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {generatedText.substring(0, 300)}...
                  </pre>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold">Campanha gerada!</h2>
              <p className="text-sm text-muted-foreground">
                Redirecionando para revisao...
              </p>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold">Erro na geracao</h2>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <Button variant="outline" onClick={() => { setPhase('idle'); setLoading(false); setError(null) }}>
              Voltar ao briefing
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Briefing da Campanha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Titulo */}
          <div>
            <label className="text-sm font-medium">
              Titulo da campanha *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Campanha Dia dos Namorados 2026"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Objetivo */}
          <div>
            <label className="text-sm font-medium">Objetivo *</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={2}
              placeholder="Ex: Gerar leads para casamentos em destinos de praia no verao 2027"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Tema */}
          <div>
            <label className="text-sm font-medium">Tema *</label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex: Casamento na praia, destination wedding, lua de mel"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Publico-alvo */}
          <div>
            <label className="text-sm font-medium">Publico-alvo</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Ex: Noivas 25-35 anos, classe AB, grandes capitais"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Tom */}
          <div>
            <label className="text-sm font-medium">Notas de tom (opcional)</label>
            <input
              type="text"
              value={toneNotes}
              onChange={(e) => setToneNotes(e.target.value)}
              placeholder="Ex: Mais emocional, foco em depoimentos reais"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Duracao */}
            <div>
              <label className="text-sm font-medium">Duracao (dias)</label>
              <input
                type="number"
                value={durationDays}
                onChange={(e) =>
                  setDurationDays(Math.max(1, parseInt(e.target.value) || 7))
                }
                min={1}
                max={60}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            {/* Data inicio */}
            <div>
              <label className="text-sm font-medium">Data de inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Formatos */}
          <div>
            <label className="text-sm font-medium">Formatos preferidos</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleFormat(opt.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    formats.includes(opt.value)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Gerando campanha...' : 'Gerar Campanha com IA'}
      </Button>
    </form>
  )
}

function ProgressStep({ done, active, label }: { done: boolean; active?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : active ? (
        <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
      ) : (
        <Skeleton className="h-5 w-5 rounded-full shrink-0" />
      )}
      <span className={`text-sm ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function getDefaultStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.toISOString().split('T')[0]
}

