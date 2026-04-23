'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import BoostConfigFields, {
  DEFAULT_BOOST_STATE,
  boostFormToPayload,
  validateBoostForm,
  type BoostFormState,
} from '@/components/instagram/BoostConfigFields'

interface PublishBoostModalProps {
  calendarEntryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface PublishBoostSuccess {
  publishedMediaId: string
  boost: {
    adId: string
    campaignId: string
    manageUrl: string
    status: 'ACTIVE' | 'PAUSED'
  } | null
  boostError?: string
}

export default function PublishBoostModal({
  calendarEntryId,
  open,
  onOpenChange,
  onSuccess,
}: PublishBoostModalProps) {
  const [state, setState] = useState<BoostFormState>(DEFAULT_BOOST_STATE)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<PublishBoostSuccess | null>(null)

  function patch(p: Partial<BoostFormState>) {
    setState((prev) => ({ ...prev, ...p }))
  }

  async function handleSubmit() {
    const err = validateBoostForm(state)
    if (err) {
      toast.error(err)
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/instagram/calendar/${calendarEntryId}/publish-boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boost: boostFormToPayload(state) }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Falha ao publicar e impulsionar')
        return
      }
      setSuccess({
        publishedMediaId: json.publish.mediaId,
        boost: json.boost,
        boostError: json.boostError,
      })
      if (json.boost) {
        toast.success(
          json.boost.status === 'ACTIVE'
            ? 'Publicado e campanha ativa'
            : 'Publicado e campanha criada pausada'
        )
      } else {
        toast.warning('Publicado, mas boost falhou')
      }
      onSuccess?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setSuccess(null)
      setState(DEFAULT_BOOST_STATE)
      setShowAdvanced(false)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publicar e impulsionar</DialogTitle>
          <DialogDescription>
            Publica a entrada no Instagram e imediatamente cria uma campanha no Meta Ads usando o post publicado como criativo.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <div className="font-medium">Publicado no Instagram</div>
              <div className="mt-1 text-xs">
                Media ID: <span className="font-mono">{success.publishedMediaId}</span>
              </div>
            </div>

            {success.boost ? (
              success.boost.status === 'ACTIVE' ? (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                  <div className="font-medium">Campanha ativa</div>
                  <div className="mt-1 text-xs">Já começou a veicular no Meta Ads.</div>
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-medium">Campanha criada (pausada)</div>
                  <div className="mt-1 text-xs">Abra no Meta Ads Manager para revisar e ativar.</div>
                </div>
              )
            ) : (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <div className="font-medium">Boost falhou</div>
                <div className="mt-1 text-xs">
                  {success.boostError ?? 'Erro desconhecido ao criar campanha Meta Ads.'}
                </div>
                <div className="mt-1 text-xs">
                  O post foi publicado normalmente. Você pode impulsionar manualmente pela aba Posts.
                </div>
              </div>
            )}

            {success.boost && (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div>Ad ID: <span className="font-mono">{success.boost.adId}</span></div>
                <div>Campaign ID: <span className="font-mono">{success.boost.campaignId}</span></div>
                <a
                  href={success.boost.manageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-sm text-primary underline"
                >
                  Abrir no Meta Ads Manager
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2">
            <BoostConfigFields
              state={state}
              onChange={patch}
              showAdvanced={showAdvanced}
              onToggleAdvanced={() => setShowAdvanced((v) => !v)}
              idPrefix="pb"
            />
          </div>
        )}

        <DialogFooter>
          {success ? (
            <Button size="sm" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Publicando + Impulsionando...' : 'Publicar e impulsionar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
