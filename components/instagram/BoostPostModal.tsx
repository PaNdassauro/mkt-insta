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

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

const DEFAULT_BUDGET = 20
const DEFAULT_DURATION = 7

export default function BoostPostModal({ postId, open, onOpenChange }: BoostPostModalProps) {
  const [dailyBudgetBRL, setDailyBudgetBRL] = useState(DEFAULT_BUDGET)
  const [durationDays, setDurationDays] = useState(DEFAULT_DURATION)
  const [launchImmediately, setLaunchImmediately] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<BoostSuccess | null>(null)

  const total = dailyBudgetBRL * durationDays

  async function handleSubmit() {
    if (dailyBudgetBRL < 6) {
      toast.error('Orcamento diario minimo: R$ 6,00')
      return
    }
    if (durationDays < 1 || durationDays > 30) {
      toast.error('Duracao entre 1 e 30 dias')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/instagram/posts/${postId}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyBudgetBRL, durationDays, launchImmediately }),
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
          ? 'Campanha ativa — ja comecou a veicular'
          : 'Campanha criada pausada — revise e ative no Ads Manager'
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setSuccess(null)
      setDailyBudgetBRL(DEFAULT_BUDGET)
      setDurationDays(DEFAULT_DURATION)
      setLaunchImmediately(false)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Impulsionar post</DialogTitle>
          <DialogDescription>
            Cria uma campanha no Meta Ads com o post atual como criativo. Veiculacao apenas no Instagram, publico Brasil 18-65 anos.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-3 py-2">
            {success.status === 'ACTIVE' ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <div className="font-medium">Campanha ativa</div>
                <div className="mt-1 text-xs">Ja comecou a veicular no Meta Ads.</div>
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-medium">Campanha criada (pausada)</div>
                <div className="mt-1 text-xs">Abra no Meta Ads Manager para revisar e ativar. Nenhum valor foi cobrado ainda.</div>
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
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="boost-budget" className="text-sm font-medium">
                Orcamento diario (R$)
              </label>
              <input
                id="boost-budget"
                type="number"
                min={6}
                step={1}
                value={dailyBudgetBRL}
                onChange={(e) => setDailyBudgetBRL(Number(e.target.value))}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">Minimo R$ 6,00/dia (exigencia do Meta Ads BR).</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="boost-days" className="text-sm font-medium">
                Duracao (dias)
              </label>
              <input
                id="boost-days"
                type="number"
                min={1}
                max={30}
                step={1}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Investimento total estimado</span>
                <span className="font-semibold">
                  {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            <label
              htmlFor="boost-launch"
              className="flex items-start gap-2.5 rounded-md border border-input bg-background p-3 text-sm cursor-pointer hover:bg-muted/30"
            >
              <input
                id="boost-launch"
                type="checkbox"
                checked={launchImmediately}
                onChange={(e) => setLaunchImmediately(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-medium">Ativar imediatamente</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {launchImmediately
                    ? 'A campanha comeca a gastar logo apos a criacao.'
                    : 'Criar pausada — voce revisa no Ads Manager antes de ativar (recomendado).'}
                </div>
              </div>
            </label>
          </div>
        )}

        <DialogFooter>
          {success ? (
            <Button size="sm" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? 'Criando campanha...'
                  : launchImmediately
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
