'use client'

import { useEffect, useState } from 'react'
import TargetingSearch, { type SearchOption } from '@/components/instagram/TargetingSearch'
import { cn } from '@/lib/utils'

export interface CustomAudienceOption {
  id: string
  name: string
  approximateCount: number | null
  subtype: string | null
}

const MIN_CUSTOM_AUDIENCE_COUNT = 100

export type Objective = 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT'
export type Gender = 'ALL' | 'MALE' | 'FEMALE'
export type Placement = 'stream' | 'story' | 'explore' | 'reels'
export type BudgetType = 'daily' | 'lifetime'
export type Cta =
  | 'LEARN_MORE'
  | 'SHOP_NOW'
  | 'SIGN_UP'
  | 'CONTACT_US'
  | 'BOOK_TRAVEL'
  | 'GET_OFFER'
  | 'SEND_MESSAGE'
  | 'APPLY_NOW'

export interface BoostFormState {
  budgetType: BudgetType
  dailyBudgetBRL: number
  totalBudgetBRL: number
  durationDays: number
  startDate: string // '' = default (now + 1 min)
  launchImmediately: boolean
  // Advanced
  objective: Objective
  destinationUrl: string
  urlTags: string
  cta: Cta
  ageMin: number
  ageMax: number
  gender: Gender
  countriesText: string
  placements: Placement[]
  cities: SearchOption[]
  regions: SearchOption[]
  interests: SearchOption[]
  excludeFollowers: boolean
  customAudienceIds: string[]
  excludedCustomAudienceIds: string[]
}

export const DEFAULT_BOOST_STATE: BoostFormState = {
  budgetType: 'daily',
  dailyBudgetBRL: 20,
  totalBudgetBRL: 140,
  durationDays: 7,
  startDate: '',
  launchImmediately: false,
  objective: 'AWARENESS',
  destinationUrl: '',
  urlTags: '',
  cta: 'LEARN_MORE',
  ageMin: 18,
  ageMax: 65,
  gender: 'ALL',
  countriesText: 'BR',
  placements: ['stream', 'story', 'explore', 'reels'],
  cities: [],
  regions: [],
  interests: [],
  excludeFollowers: false,
  customAudienceIds: [],
  excludedCustomAudienceIds: [],
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

export const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

interface BoostConfigFieldsProps {
  state: BoostFormState
  onChange: (patch: Partial<BoostFormState>) => void
  showAdvanced: boolean
  onToggleAdvanced: () => void
  idPrefix?: string
}

/**
 * Shared form UI for the boost configuration.
 * Used by BoostPostModal and PublishBoostModal — keeps the option set aligned.
 */
export default function BoostConfigFields({
  state,
  onChange,
  showAdvanced,
  onToggleAdvanced,
  idPrefix = 'bf',
}: BoostConfigFieldsProps) {
  const needsUrl = state.objective !== 'AWARENESS'
  const isLifetime = state.budgetType === 'lifetime'

  const [customAudiences, setCustomAudiences] = useState<CustomAudienceOption[] | null>(null)
  const [customAudiencesError, setCustomAudiencesError] = useState<string | null>(null)

  // Fetch custom audiences only when the advanced panel is actually opened,
  // to avoid a needless Meta call on every modal mount.
  useEffect(() => {
    if (!showAdvanced || customAudiences !== null) return
    let cancelled = false
    fetch('/api/instagram/ads/audiences')
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar publicos')
        return json as { data: CustomAudienceOption[] }
      })
      .then((body) => {
        if (!cancelled) setCustomAudiences(body.data ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCustomAudiences([])
          setCustomAudiencesError(err instanceof Error ? err.message : 'Erro inesperado')
        }
      })
    return () => {
      cancelled = true
    }
  }, [showAdvanced, customAudiences])

  const total =
    isLifetime ? state.totalBudgetBRL : state.dailyBudgetBRL * state.durationDays

  function togglePlacement(p: Placement) {
    onChange({
      placements: state.placements.includes(p)
        ? state.placements.filter((x) => x !== p)
        : [...state.placements, p],
    })
  }

  return (
    <div className="space-y-4">
      {/* Budget type toggle */}
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Tipo de orçamento</span>
        <div className="inline-flex rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => onChange({ budgetType: 'daily' })}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium',
              !isLifetime ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            Diário
          </button>
          <button
            type="button"
            onClick={() => onChange({ budgetType: 'lifetime' })}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium',
              isLifetime ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            Total (vitalício)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-budget`} className="text-sm font-medium">
            {isLifetime ? 'Orçamento total (R$)' : 'Orçamento diário (R$)'}
          </label>
          <input
            id={`${idPrefix}-budget`}
            type="number"
            min={6}
            step={1}
            value={isLifetime ? state.totalBudgetBRL : state.dailyBudgetBRL}
            onChange={(e) =>
              onChange(
                isLifetime
                  ? { totalBudgetBRL: Number(e.target.value) }
                  : { dailyBudgetBRL: Number(e.target.value) }
              )
            }
            className={inputClass}
          />
          <p className="text-[11px] text-muted-foreground">Mínimo R$ 6,00.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-days`} className="text-sm font-medium">
            Duração (dias)
          </label>
          <input
            id={`${idPrefix}-days`}
            type="number"
            min={1}
            max={30}
            step={1}
            value={state.durationDays}
            onChange={(e) => onChange({ durationDays: Number(e.target.value) })}
            className={inputClass}
          />
          <p className="text-[11px] text-muted-foreground">1 a 30 dias.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-start`} className="text-sm font-medium">
          Data de início (opcional)
        </label>
        <input
          id={`${idPrefix}-start`}
          type="datetime-local"
          value={state.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
          className={inputClass}
        />
        <p className="text-[11px] text-muted-foreground">
          Se deixar em branco, começa 1 minuto após a criação.
        </p>
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {isLifetime ? 'Gasto máximo' : 'Investimento total estimado'}
          </span>
          <span className="font-semibold">
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleAdvanced}
        className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {showAdvanced ? '▾' : '▸'} Opções avançadas
      </button>

      {showAdvanced && (
        <div className="space-y-4 rounded-md border border-border/80 bg-muted/20 p-3">
          {/* Objective */}
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Objetivo</span>
            <div className="grid grid-cols-1 gap-1.5">
              {OBJECTIVE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm transition-colors',
                    state.objective === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40'
                  )}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-objective`}
                    checked={state.objective === opt.value}
                    onChange={() => onChange({ objective: opt.value })}
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

          {/* URL + UTM + CTA (URL required if objective needs it) */}
          {needsUrl && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
                <div className="space-y-1.5">
                  <label htmlFor={`${idPrefix}-url`} className="text-sm font-medium">
                    URL de destino *
                  </label>
                  <input
                    id={`${idPrefix}-url`}
                    type="url"
                    placeholder="https://..."
                    value={state.destinationUrl}
                    onChange={(e) => onChange({ destinationUrl: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${idPrefix}-cta`} className="text-sm font-medium">
                    CTA
                  </label>
                  <select
                    id={`${idPrefix}-cta`}
                    value={state.cta}
                    onChange={(e) => onChange({ cta: e.target.value as Cta })}
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
              <div className="space-y-1.5">
                <label htmlFor={`${idPrefix}-utm`} className="text-sm font-medium">
                  UTM tags (opcional)
                </label>
                <input
                  id={`${idPrefix}-utm`}
                  type="text"
                  placeholder="utm_source=meta_ads&utm_campaign=mendoza_maio"
                  value={state.urlTags}
                  onChange={(e) => onChange({ urlTags: e.target.value })}
                  className={inputClass}
                />
                <p className="text-[11px] text-muted-foreground">
                  Meta anexa isso à URL automaticamente — útil pra rastrear no Google Analytics.
                </p>
              </div>
            </div>
          )}

          {/* Interests autocomplete */}
          <TargetingSearch
            kind="interests"
            label="Interesses"
            placeholder="ex: casamento, lua de mel, noivas..."
            selected={state.interests}
            onChange={(interests) => onChange({ interests })}
            inputId={`${idPrefix}-interests`}
            max={10}
          />

          {/* Regions + cities */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TargetingSearch
              kind="regions"
              label="Estados / regiões"
              placeholder="ex: São Paulo, Rio de Janeiro..."
              selected={state.regions}
              onChange={(regions) => onChange({ regions })}
              inputId={`${idPrefix}-regions`}
              max={20}
            />
            <TargetingSearch
              kind="cities"
              label="Cidades"
              placeholder="ex: São Paulo, Curitiba..."
              selected={state.cities}
              onChange={(cities) => onChange({ cities })}
              inputId={`${idPrefix}-cities`}
              max={20}
            />
          </div>
          {(state.cities.length > 0 || state.regions.length > 0) && (
            <p className="text-[11px] text-muted-foreground">
              Com cidades ou estados selecionados, o campo &quot;Países&quot; é ignorado.
            </p>
          )}

          {/* Countries fallback */}
          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-countries`} className="text-sm font-medium">
              Países (ISO-2, separados por vírgula)
            </label>
            <input
              id={`${idPrefix}-countries`}
              type="text"
              placeholder="BR, US, PT"
              value={state.countriesText}
              onChange={(e) => onChange({ countriesText: e.target.value })}
              className={inputClass}
              disabled={state.cities.length > 0 || state.regions.length > 0}
            />
            <p className="text-[11px] text-muted-foreground">Padrão: BR.</p>
          </div>

          {/* Age + gender */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`${idPrefix}-age-min`} className="text-sm font-medium">
                Idade mín
              </label>
              <input
                id={`${idPrefix}-age-min`}
                type="number"
                min={13}
                max={65}
                value={state.ageMin}
                onChange={(e) => onChange({ ageMin: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${idPrefix}-age-max`} className="text-sm font-medium">
                Idade máx
              </label>
              <input
                id={`${idPrefix}-age-max`}
                type="number"
                min={13}
                max={65}
                value={state.ageMax}
                onChange={(e) => onChange({ ageMax: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${idPrefix}-gender`} className="text-sm font-medium">
                Gênero
              </label>
              <select
                id={`${idPrefix}-gender`}
                value={state.gender}
                onChange={(e) => onChange({ gender: e.target.value as Gender })}
                className={inputClass}
              >
                <option value="ALL">Todos</option>
                <option value="FEMALE">Mulheres</option>
                <option value="MALE">Homens</option>
              </select>
            </div>
          </div>

          {/* Placements */}
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Posicionamentos</span>
            <div className="flex flex-wrap gap-2">
              {PLACEMENT_OPTIONS.map((p) => {
                const active = state.placements.includes(p.value)
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

          {/* Custom audiences (include + exclude) */}
          <CustomAudiencesBlock
            audiences={customAudiences}
            error={customAudiencesError}
            selectedIncludeIds={state.customAudienceIds}
            selectedExcludeIds={state.excludedCustomAudienceIds}
            onIncludeChange={(ids) => onChange({ customAudienceIds: ids })}
            onExcludeChange={(ids) => onChange({ excludedCustomAudienceIds: ids })}
            idPrefix={idPrefix}
          />

          {/* Exclude followers */}
          <label
            htmlFor={`${idPrefix}-exclude`}
            className="flex items-start gap-2.5 rounded-md border border-input bg-background p-2.5 text-sm cursor-pointer hover:bg-muted/30"
          >
            <input
              id={`${idPrefix}-exclude`}
              type="checkbox"
              checked={state.excludeFollowers}
              onChange={(e) => onChange({ excludeFollowers: e.target.checked })}
              className="mt-0.5 h-4 w-4 cursor-pointer"
            />
            <div className="flex-1">
              <div className="font-medium">Não mostrar pra quem já segue</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Exclui pessoas conectadas à página do Facebook ligada à conta (aproxima exclusão de seguidores do IG).
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Launch immediately */}
      <label
        htmlFor={`${idPrefix}-launch`}
        className="flex items-start gap-2.5 rounded-md border border-input bg-background p-3 text-sm cursor-pointer hover:bg-muted/30"
      >
        <input
          id={`${idPrefix}-launch`}
          type="checkbox"
          checked={state.launchImmediately}
          onChange={(e) => onChange({ launchImmediately: e.target.checked })}
          className="mt-0.5 h-4 w-4 cursor-pointer"
        />
        <div className="flex-1">
          <div className="font-medium">Ativar imediatamente</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {state.launchImmediately
              ? 'A campanha começa a gastar logo após a criação.'
              : 'Criar pausada — você revisa no Ads Manager antes de ativar (recomendado).'}
          </div>
        </div>
      </label>
    </div>
  )
}

function formatAudienceCount(count: number | null): string {
  if (count === null) return '—'
  if (count < 1000) return String(count)
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`
  return `${(count / 1_000_000).toFixed(1)}M`
}

function CustomAudiencesBlock({
  audiences,
  error,
  selectedIncludeIds,
  selectedExcludeIds,
  onIncludeChange,
  onExcludeChange,
  idPrefix,
}: {
  audiences: CustomAudienceOption[] | null
  error: string | null
  selectedIncludeIds: string[]
  selectedExcludeIds: string[]
  onIncludeChange: (ids: string[]) => void
  onExcludeChange: (ids: string[]) => void
  idPrefix: string
}) {
  if (audiences === null) {
    return (
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Públicos personalizados</span>
        <p className="text-[11px] text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Públicos personalizados</span>
        <p className="text-[11px] text-red-600">Falha ao carregar: {error}</p>
      </div>
    )
  }

  if (audiences.length === 0) {
    return (
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Públicos personalizados</span>
        <p className="text-[11px] text-muted-foreground">
          Nenhum público criado ainda. Crie no Meta Ads Manager (ex: visitantes do site, engajadores do IG) para aparecer aqui.
        </p>
      </div>
    )
  }

  function toggle(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="text-sm font-medium">Públicos personalizados</span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Meta exige público com ≥ {MIN_CUSTOM_AUDIENCE_COUNT} pessoas. Os menores aparecem desabilitados.
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Incluir</span>
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-input bg-background p-1.5">
          {audiences.map((aud) => {
            const tooSmall =
              aud.approximateCount !== null && aud.approximateCount < MIN_CUSTOM_AUDIENCE_COUNT
            const excluded = selectedExcludeIds.includes(aud.id)
            const disabled = tooSmall || excluded
            const checked = selectedIncludeIds.includes(aud.id)
            return (
              <label
                key={aud.id}
                htmlFor={`${idPrefix}-ca-inc-${aud.id}`}
                className={cn(
                  'flex items-center gap-2 rounded px-1.5 py-1 text-xs',
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50'
                )}
              >
                <input
                  id={`${idPrefix}-ca-inc-${aud.id}`}
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onIncludeChange(toggle(selectedIncludeIds, aud.id))}
                />
                <span className="flex-1 truncate">{aud.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatAudienceCount(aud.approximateCount)}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Excluir</span>
        <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-md border border-input bg-background p-1.5">
          {audiences.map((aud) => {
            const included = selectedIncludeIds.includes(aud.id)
            const disabled = included
            const checked = selectedExcludeIds.includes(aud.id)
            return (
              <label
                key={aud.id}
                htmlFor={`${idPrefix}-ca-exc-${aud.id}`}
                className={cn(
                  'flex items-center gap-2 rounded px-1.5 py-1 text-xs',
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50'
                )}
              >
                <input
                  id={`${idPrefix}-ca-exc-${aud.id}`}
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onExcludeChange(toggle(selectedExcludeIds, aud.id))}
                />
                <span className="flex-1 truncate">{aud.name}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Validates the form state. Returns an error message or null if valid.
 * Caller is responsible for showing the error (toast, inline, etc.).
 */
export function validateBoostForm(state: BoostFormState): string | null {
  if (state.budgetType === 'daily') {
    if (!(state.dailyBudgetBRL >= 6)) return 'Orçamento diário mínimo: R$ 6,00'
  } else {
    if (!(state.totalBudgetBRL >= 6)) return 'Orçamento total mínimo: R$ 6,00'
  }
  if (state.durationDays < 1 || state.durationDays > 30) {
    return 'Duração entre 1 e 30 dias'
  }
  if (state.ageMin < 13 || state.ageMax > 65 || state.ageMin > state.ageMax) {
    return 'Faixa etária inválida (13-65, mín ≤ máx)'
  }
  if (state.placements.length === 0) {
    return 'Selecione ao menos um posicionamento'
  }
  const needsUrl = state.objective !== 'AWARENESS'
  if (needsUrl && !state.destinationUrl.trim()) {
    return `Objetivo ${state.objective === 'TRAFFIC' ? 'Tráfego' : 'Engajamento'} exige URL de destino`
  }
  const useGeoSearch = state.cities.length > 0 || state.regions.length > 0
  if (!useGeoSearch) {
    const countries = state.countriesText
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)
    if (countries.length === 0) return 'Informe ao menos um país (ex: BR)'
    for (const c of countries) {
      if (!/^[A-Z]{2}$/.test(c)) return `País inválido: ${c}. Use ISO de 2 letras.`
    }
  }
  if (state.startDate) {
    const ts = Date.parse(state.startDate)
    if (!Number.isFinite(ts)) return 'Data de início inválida'
  }
  return null
}

/**
 * Build the `boost` payload to send to the API from the form state.
 */
export function boostFormToPayload(state: BoostFormState) {
  const needsUrl = state.objective !== 'AWARENESS'
  const useGeoSearch = state.cities.length > 0 || state.regions.length > 0
  const countries = state.countriesText
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

  return {
    budgetType: state.budgetType,
    dailyBudgetBRL: state.budgetType === 'daily' ? state.dailyBudgetBRL : 6,
    totalBudgetBRL: state.budgetType === 'lifetime' ? state.totalBudgetBRL : undefined,
    durationDays: state.durationDays,
    startDate: state.startDate ? new Date(state.startDate).toISOString() : undefined,
    launchImmediately: state.launchImmediately,
    objective: state.objective,
    destinationUrl: needsUrl ? state.destinationUrl.trim() : undefined,
    cta: needsUrl ? state.cta : undefined,
    urlTags: needsUrl && state.urlTags.trim() ? state.urlTags.trim() : undefined,
    audience: {
      countries: useGeoSearch ? undefined : countries,
      cities: state.cities.length
        ? state.cities.map((c) => ({ key: c.id, name: c.name }))
        : undefined,
      regions: state.regions.length
        ? state.regions.map((r) => ({ key: r.id, name: r.name }))
        : undefined,
      ageMin: state.ageMin,
      ageMax: state.ageMax,
      gender: state.gender,
      placements: state.placements,
      interests: state.interests.length
        ? state.interests.map((i) => ({ id: i.id, name: i.name }))
        : undefined,
      excludeFollowers: state.excludeFollowers,
      customAudienceIds: state.customAudienceIds.length ? state.customAudienceIds : undefined,
      excludedCustomAudienceIds: state.excludedCustomAudienceIds.length
        ? state.excludedCustomAudienceIds
        : undefined,
    },
  }
}
