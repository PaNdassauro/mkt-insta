'use client'

import { fetchWithAccount } from '@/lib/fetch-with-account'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface GenerationMetadata {
  campaign_id: string
  posts_created: number
  generation_time_ms: number
  chunks_used: number
}

export default function GeneratingScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaignId = searchParams.get('id')

  const [status, setStatus] = useState<'generating' | 'done' | 'error'>('generating')
  const [metadata, setMetadata] = useState<GenerationMetadata | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [pollFailures, setPollFailures] = useState(0)

  const TIMEOUT_SECONDS = 120 // 2 minutos
  const MAX_POLL_FAILURES = 5

  // Poll campaign status with backoff
  const pollStatus = useCallback(async () => {
    if (!campaignId) return

    try {
      const res = await fetchWithAccount(`/api/campaigns/${campaignId}`)
      if (!res.ok) {
        setPollFailures((prev) => prev + 1)
        return
      }

      setPollFailures(0) // Reset on success

      const campaign = await res.json()
      if (!campaign || campaign.error) return

      if (campaign.status === 'REVIEW') {
        setStatus('done')
        setMetadata({
          campaign_id: campaign.id,
          posts_created: campaign.post_count ?? 0,
          generation_time_ms: campaign.generation_time_ms ?? elapsed * 1000,
          chunks_used: campaign.context_chunks_used ?? 0,
        })
      } else if (campaign.status === 'DRAFT') {
        setStatus('error')
        setErrorMsg('A geracao falhou. A campanha voltou para rascunho.')
      }
    } catch {
      setPollFailures((prev) => prev + 1)
    }
  }, [campaignId, elapsed])

  useEffect(() => {
    if (status !== 'generating') return

    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
        // Hard timeout
        if (next >= TIMEOUT_SECONDS) {
          setStatus('error')
          setErrorMsg(`Tempo limite de ${TIMEOUT_SECONDS / 60} minutos excedido. A geracao pode ainda estar em andamento — verifique a lista de campanhas.`)
        }
        return next
      })
    }, 1000)

    // Backoff: 3s base, doubles after each failure (max 15s)
    const pollInterval = Math.min(3000 * Math.pow(2, pollFailures), 15000)
    const poller = setInterval(pollStatus, pollInterval)

    // Max poll failures
    if (pollFailures >= MAX_POLL_FAILURES) {
      setStatus('error')
      setErrorMsg('Erro de conexao ao verificar o status. Verifique sua internet e tente novamente.')
    }

    return () => {
      clearInterval(timer)
      clearInterval(poller)
    }
  }, [status, pollStatus, pollFailures])

  if (!campaignId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        ID da campanha nao encontrado.
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      {status === 'generating' && (
        <>
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold">Gerando campanha...</h2>
            <p className="text-sm text-muted-foreground">
              A IA esta analisando seus dados e criando a campanha.
              <br />
              Isso pode levar de 30 a 60 segundos.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {formatTime(elapsed)} decorridos
              {elapsed > 60 && (
                <span className="text-yellow-600"> · tempo limite em {formatTime(TIMEOUT_SECONDS - elapsed)}</span>
              )}
            </p>
            {/* Progress bar */}
            <div className="w-48 mx-auto mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${Math.min((elapsed / TIMEOUT_SECONDS) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Indicadores de progresso */}
          <Card className="border-0 shadow-sm w-full max-w-md">
            <CardContent className="p-4 space-y-3">
              <ProgressStep
                done={elapsed >= 2}
                label="Buscando contexto na Knowledge Base"
              />
              <ProgressStep
                done={elapsed >= 5}
                label="Carregando metricas do perfil"
              />
              <ProgressStep
                done={elapsed >= 8}
                label="Montando prompt com 3 camadas"
              />
              <ProgressStep
                done={elapsed >= 12}
                active={elapsed >= 8 && elapsed < 50}
                label="Gerando campanha com IA"
              />
              <ProgressStep
                done={false}
                label="Validando e salvando posts"
              />
            </CardContent>
          </Card>
        </>
      )}

      {status === 'done' && metadata && (
        <>
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold">Campanha gerada!</h2>
            <p className="text-sm text-muted-foreground">
              {metadata.posts_created} posts criados em{' '}
              {(metadata.generation_time_ms / 1000).toFixed(0)}s
              {metadata.chunks_used > 0 &&
                ` · ${metadata.chunks_used} fontes de contexto usadas`}
            </p>
          </div>
          <Button
            onClick={() =>
              router.push(`/dashboard/instagram/campaigns/${campaignId}`)
            }
          >
            Revisar Campanha
          </Button>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold">Erro na geracao</h2>
            <p className="text-sm text-red-600">
              {errorMsg || 'Erro desconhecido'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStatus('generating')
                setElapsed(0)
                setErrorMsg(null)
                setPollFailures(0)
              }}
            >
              Tentar novamente
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push('/dashboard/instagram/campaigns/new')
              }
            >
              Voltar ao briefing
            </Button>
            <Button
              onClick={() => router.push('/dashboard/instagram/campaigns')}
            >
              Ver campanhas
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function ProgressStep({
  done,
  active,
  label,
}: {
  done: boolean
  active?: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <svg
            className="h-3 w-3 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      ) : active ? (
        <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
      ) : (
        <Skeleton className="h-5 w-5 rounded-full shrink-0" />
      )}
      <span
        className={`text-sm ${done ? 'text-foreground' : 'text-muted-foreground'}`}
      >
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
