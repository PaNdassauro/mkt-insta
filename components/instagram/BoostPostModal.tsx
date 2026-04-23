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

interface BoostPostModalProps {
  postId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface BoostSuccess {
  adId: string
  campaignId: string
  manageUrl: string
  status: 'ACTIVE' | 'PAUSED'
}

export default function BoostPostModal({ postId, open, onOpenChange }: BoostPostModalProps) {
  const [state, setState] = useState<BoostFormState>(DEFAULT_BOOST_STATE)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<BoostSuccess | null>(null)

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
      const res = await fetch(`/api/instagram/posts/${postId}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boostFormToPayload(state)),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Falha ao impulsionar post')
        return
      }
      setSuccess({
        adId: json.adId,
        campaignId: json.campaignId,
        manageUrl: json.manageUrl,
        status: json.status,
      })
      toast.success(
        json.status === 'ACTIVE'
          ? 'Campanha ativa — já começou a veicular'
          : 'Campanha criada pausada — revise e ative no Ads Manager'
      )
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
          <DialogTitle>Impulsionar post</DialogTitle>
          <DialogDescription>
            Cria uma campanha no Meta Ads com o post atual como criativo.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-3 py-2">
            {success.status === 'ACTIVE' ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <div className="font-medium">Campanha ativa</div>
                <div className="mt-1 text-xs">Já começou a veicular no Meta Ads.</div>
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-medium">Campanha criada (pausada)</div>
                <div className="mt-1 text-xs">
                  Abra no Meta Ads Manager para revisar e ativar. Nenhum valor foi cobrado ainda.
                </div>
              </div>
            )}
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div>Ad ID: <span className="font-mono">{success.adId}</span></div>
              <div>Campaign ID: <span className="font-mono">{success.campaignId}</span></div>
            </div>
            <a
              href={success.manageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline"
            >
              Abrir no Meta Ads Manager
            </a>
          </div>
        ) : (
          <div className="py-2">
            <BoostConfigFields
              state={state}
              onChange={patch}
              showAdvanced={showAdvanced}
              onToggleAdvanced={() => setShowAdvanced((v) => !v)}
              idPrefix="boost"
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
                {submitting
                  ? 'Criando campanha...'
                  : state.launchImmediately
                    ? 'Impulsionar agora'
                    : 'Criar pausada'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
