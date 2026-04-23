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
import { cn } from '@/lib/utils'

interface PublishBoostModalProps {
  calendarEntryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type Objective = 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT'
type Gender = 'ALL' | 'MALE' | 'FEMALE'
type Placement = 'stream' | 'story' | 'explore' | 'reels'
type Cta =
  | 'LEARN_MORE'
  | 'SHOP_NOW'
  | 'SIGN_UP'
  | 'CONTACT_US'
  | 'BOOK_TRAVEL'
  | 'GET_OFFER'
  | 'SEND_MESSAGE'
  | 'APPLY_NOW'

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

const OBJECTIVE_OPTIONS: { value: Objective; label: string; desc: string }[] = [
  {
    value: 'AWARENESS',
    label: 'Alcance',
    desc: 'Mostrar o post para o máximo de pessoas. Mais barato, sem URL.',
  },
  {
    value: 'TRAFFIC',
    label: 'Tráfego',
    desc: 'Levar pessoas para um site. Requer URL + chamada para ação.',
  },
  {
    value: 'ENGAGEMENT',
    label: 'Engajamento',
    desc: 'Otimizar para curtidas, comentários, saves. Requer URL + CTA.',
  },
]

const CTA_OPTIONS: { value: Cta; label: string }[] = [
  { value: 'LEARN_MORE', label: 'Saiba mais' },
  { value: 'SHOP_NOW', label: 'Comprar agora' },
  { value: 'BOOK_TRAVEL', label: 'Reservar' },
  { value: 'SIGN_UP', label: 'Cadastre-se' },
  { value: 'CONTACT_US', label: 'Entre em contato' },
  { value: 'GET_OFFER', label: 'Ver oferta' },
  { value: 'SEND_MESSAGE', label: 'Enviar mensagem' },
  { value: 'APPLY_NOW', label: 'Inscrever-se' },
]

const PLACEMENT_OPTIONS: { value: Placement; label: string }[] = [
  { value: 'stream', label: 'Feed' },
  { value: 'story', label: 'Stories' },
  { value: 'reels', label: 'Reels' },
  { value: 'explore', label: 'Explore' },
]

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

const DEFAULT_BUDGET = 20
const DEFAULT_DURATION = 7

export default function PublishBoostModal({
  calendarEntryId,
  open,
  onOpenChange,
  onSuccess,
}: PublishBoostModalProps) {
  const [dailyBudgetBRL, setDailyBudgetBRL] = useState(DEFAULT_BUDGET)
  const [durationDays, setDurationDays] = useState(DEFAULT_DURATION)
  const [launchImmediately, setLaunchImmediately] = useState(false)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [objective, setObjective] = useState<Objective>('AWARENESS')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [cta, setCta] = useState<Cta>('LEARN_MORE')
  const [ageMin, setAgeMin] = useState(18)
  const [ageMax, setAgeMax] = useState(65)
  const [gender, setGender] = useState<Gender>('ALL')
  const [countriesText, setCountriesText] = useState('BR')
  const [placements, setPlacements] = useState<Placement[]>(['stream', 'story', 'explore', 'reels'])

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<PublishBoostSuccess | null>(null)

  const total = dailyBudgetBRL * durationDays
  const needsUrl = objective !== 'AWARENESS'

  function togglePlacement(p: Placement) {
    setPlacements((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  function resetFields() {
    setDailyBudgetBRL(DEFAULT_BUDGET)
    setDurationDays(DEFAULT_DURATION)
    setLaunchImmediately(false)
    setShowAdvanced(false)
    setObjective('AWARENESS')
    setDestinationUrl('')
    setCta('LEARN_MORE')
    setAgeMin(18)
    setAgeMax(65)
    setGender('ALL')
    setCountriesText('BR')
    setPlacements(['stream', 'story', 'explore', 'reels'])
  }

  async function handleSubmit() {
    if (dailyBudgetBRL < 6) {
      toast.error('Orçamento diário mínimo: R$ 6,00')
      return
    }
    if (durationDays < 1 || durationDays > 30) {
      toast.error('Duração entre 1 e 30 dias')
      return
    }
    if (ageMin < 13 || ageMax > 65 || ageMin > ageMax) {
      toast.error('Faixa etária deve estar entre 13 e 65 (mín ≤ máx)')
      return
    }
    if (placements.length === 0) {
      toast.error('Selecione ao menos um posicionamento')
      return
    }
    const countries = countriesText
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)
    if (countries.length === 0) {
      toast.error('Informe ao menos um país (ex: BR)')
      return
    }
    for (const c of countries) {
      if (!/^[A-Z]{2}$/.test(c)) {
        toast.error(`País inválido: ${c}. Use ISO de 2 letras.`)
        return
      }
    }
    if (needsUrl && !destinationUrl.trim()) {
      toast.error(`Objetivo ${objective === 'TRAFFIC' ? 'Tráfego' : 'Engajamento'} exige URL de destino`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/instagram/calendar/${calendarEntryId}/publish-boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boost: {
            dailyBudgetBRL,
            durationDays,
            launchImmediately,
            objective,
            destinationUrl: needsUrl ? destinationUrl.trim() : undefined,
            cta: needsUrl ? cta : undefined,
            audience: {
              countries,
              ageMin,
              ageMax,
              gender,
              placements,
            },
          },
        }),
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setSuccess(null)
      resetFields()
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
              <div className="mt-1 text-xs">Media ID: <span className="font-mono">{success.publishedMediaId}</span></div>
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
                <div className="mt-1 text-xs">{success.boostError ?? 'Erro desconhecido ao criar campanha Meta Ads.'}</div>
                <div className="mt-1 text-xs">O post foi publicado normalmente. Você pode impulsionar manualmente pela aba Posts.</div>
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
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="pb-budget" className="text-sm font-medium">
                  Orçamento diário (R$)
                </label>
                <input
                  id="pb-budget"
                  type="number"
                  min={6}
                  step={1}
                  value={dailyBudgetBRL}
                  onChange={(e) => setDailyBudgetBRL(Number(e.target.value))}
                  className={inputClass}
                />
                <p className="text-[11px] text-muted-foreground">Mínimo R$ 6,00/dia.</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pb-days" className="text-sm font-medium">
                  Duração (dias)
                </label>
                <input
                  id="pb-days"
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className={inputClass}
                />
                <p className="text-[11px] text-muted-foreground">1 a 30 dias.</p>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Investimento total estimado</span>
                <span className="font-semibold">
                  {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? '▾' : '▸'} Opções avançadas
            </button>

            {showAdvanced && (
              <div className="space-y-4 rounded-md border border-border/80 bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Objetivo</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {OBJECTIVE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm transition-colors',
                          objective === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/40'
                        )}
                      >
                        <input
                          type="radio"
                          name="pb-objective"
                          checked={objective === opt.value}
                          onChange={() => setObjective(opt.value)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {needsUrl && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
                    <div className="space-y-1.5">
                      <label htmlFor="pb-url" className="text-sm font-medium">
                        URL de destino *
                      </label>
                      <input
                        id="pb-url"
                        type="url"
                        placeholder="https://..."
                        value={destinationUrl}
                        onChange={(e) => setDestinationUrl(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="pb-cta" className="text-sm font-medium">
                        CTA
                      </label>
                      <select
                        id="pb-cta"
                        value={cta}
                        onChange={(e) => setCta(e.target.value as Cta)}
                        className={inputClass}
                      >
                        {CTA_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="pb-age-min" className="text-sm font-medium">Idade mín</label>
                    <input
                      id="pb-age-min"
                      type="number"
                      min={13}
                      max={65}
                      value={ageMin}
                      onChange={(e) => setAgeMin(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="pb-age-max" className="text-sm font-medium">Idade máx</label>
                    <input
                      id="pb-age-max"
                      type="number"
                      min={13}
                      max={65}
                      value={ageMax}
                      onChange={(e) => setAgeMax(Number(e.target.value))}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="pb-gender" className="text-sm font-medium">Gênero</label>
                    <select
                      id="pb-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className={inputClass}
                    >
                      <option value="ALL">Todos</option>
                      <option value="FEMALE">Mulheres</option>
                      <option value="MALE">Homens</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="pb-countries" className="text-sm font-medium">
                    Países (ISO-2, separados por vírgula)
                  </label>
                  <input
                    id="pb-countries"
                    type="text"
                    placeholder="BR, US, PT"
                    value={countriesText}
                    onChange={(e) => setCountriesText(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Posicionamentos</span>
                  <div className="flex flex-wrap gap-2">
                    {PLACEMENT_OPTIONS.map((p) => {
                      const active = placements.includes(p.value)
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => togglePlacement(p.value)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <label
              htmlFor="pb-launch"
              className="flex items-start gap-2.5 rounded-md border border-input bg-background p-3 text-sm cursor-pointer hover:bg-muted/30"
            >
              <input
                id="pb-launch"
                type="checkbox"
                checked={launchImmediately}
                onChange={(e) => setLaunchImmediately(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-medium">Ativar campanha imediatamente</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {launchImmediately
                    ? 'A campanha começa a gastar assim que a publicação for concluída.'
                    : 'Campanha é criada pausada — revise no Ads Manager antes de ativar (recomendado).'}
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
                {submitting ? 'Publicando + Impulsionando...' : 'Publicar e impulsionar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
