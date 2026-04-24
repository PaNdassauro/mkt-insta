import { META_API_BASE_URL } from './constants'
import { getAccountCredentials } from './meta-client'
import { logger } from './logger'

// ==========================================
// Meta Marketing API client — boost/ads
// ==========================================
// Docs: https://developers.facebook.com/docs/marketing-api
// Requires token scopes: ads_management, ads_read, business_management

const REQUIRED_ADS_SCOPES = ['ads_management'] as const

export interface TokenDebugInfo {
  isValid: boolean
  scopes: string[]
  hasAdsPermission: boolean
  missingScopes: string[]
  expiresAt: number | null
  appId: string | null
}

export type BoostObjective = 'AWARENESS' | 'TRAFFIC' | 'ENGAGEMENT'
export type BoostGender = 'ALL' | 'MALE' | 'FEMALE'
export type BoostPlacement = 'stream' | 'story' | 'explore' | 'reels'
export type BoostCta =
  | 'LEARN_MORE'
  | 'SHOP_NOW'
  | 'SIGN_UP'
  | 'CONTACT_US'
  | 'BOOK_TRAVEL'
  | 'GET_OFFER'
  | 'SEND_MESSAGE'
  | 'APPLY_NOW'

export interface BoostInterest {
  id: string
  name: string
}

export interface BoostCity {
  key: string
  name: string
  radiusKm?: number // default 17 km (~10 mi, Meta default)
}

export interface BoostRegion {
  key: string
  name: string
}

export interface BoostAudience {
  countries?: string[] // ISO-2: ['BR', 'US'], default ['BR']
  cities?: BoostCity[] // optional — overrides country targeting at city level
  regions?: BoostRegion[] // optional — state/region
  ageMin?: number // default 18
  ageMax?: number // default 65
  gender?: BoostGender // default 'ALL'
  placements?: BoostPlacement[] // default all four
  interests?: BoostInterest[] // optional — narrow to people interested in these topics
  excludeFollowers?: boolean // excludes people who follow the FB Page (and usually the linked IG account)
  customAudienceIds?: string[] // Meta custom audience IDs to include (e.g. site visitors, engagers)
  excludedCustomAudienceIds?: string[] // custom audiences to exclude
}

export interface CustomAudienceSummary {
  id: string
  name: string
  subtype: string | null
  approximateCount: number | null
  deliveryStatus: string | null
  operationStatus: string | null
}

export type BoostBudgetType = 'daily' | 'lifetime'

export interface BoostInput {
  mediaId: string
  dailyBudgetBRL: number
  durationDays: number
  caption?: string | null
  launchImmediately?: boolean
  accountId?: string
  objective?: BoostObjective // default AWARENESS
  audience?: BoostAudience
  destinationUrl?: string // required for TRAFFIC / ENGAGEMENT
  cta?: BoostCta // default LEARN_MORE for TRAFFIC/ENGAGEMENT
  budgetType?: BoostBudgetType // default 'daily'
  totalBudgetBRL?: number // used when budgetType = 'lifetime'
  startDate?: string // ISO (YYYY-MM-DD or full ISO). Default: now + 1 min
  urlTags?: string // raw query string e.g. "utm_source=meta&utm_campaign=mendoza"
}

export interface BoostResult {
  campaignId: string
  adSetId: string
  creativeId: string
  adId: string
  adAccountId: string
  status: 'ACTIVE' | 'PAUSED'
}

export interface AdInsights {
  spend: number
  reach: number
  impressions: number
  clicks: number
  ctr: number
  cpm: number
  cpc: number
  frequency: number
}

export interface AdDailyPoint {
  date: string // YYYY-MM-DD (ad account timezone) — keep as string, don't new Date() it
  spend: number
  reach: number
  impressions: number
}

export interface AdBreakdownRow {
  key: string // e.g. "25-34" (age) or "facebook" (publisher_platform)
  subKey?: string // e.g. "female" when breakdowns=age,gender
  spend: number
  reach: number
  impressions: number
}

export interface AdRow {
  id: string
  name: string
  status: string
  effectiveStatus: string
  createdTime: string | null
  campaign: { id: string; name: string; objective: string | null; status: string | null } | null
  adset: {
    id: string
    name: string
    status: string | null
    dailyBudgetBRL: number | null
    lifetimeBudgetBRL: number | null
    startTime: string | null
    endTime: string | null
  } | null
  creative: {
    id: string
    name: string | null
    thumbnailUrl: string | null
    instagramMediaId: string | null
  } | null
  insights: AdInsights
}

// ==========================================
// Internals
// ==========================================

function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`
}

function buildCampaignName(caption: string | null | undefined, when: Date): string {
  const timestamp = when.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const snippet = (caption ?? '')
    .replace(/\s+/g, ' ')
    .replace(/#\w+/g, '')
    .trim()
    .slice(0, 40)
    .trim()
  return snippet
    ? `Impulsionamento — ${snippet}${snippet.length === 40 ? '…' : ''} — ${timestamp}`
    : `Impulsionamento — ${timestamp}`
}

async function postToMeta<T>(
  path: string,
  params: Record<string, string | number | boolean>,
  token: string
): Promise<T> {
  const url = `${META_API_BASE_URL}${path}`
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) body.set(k, String(v))
  body.set('access_token', token)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(parseMetaError(raw, res.status))
  }
  return JSON.parse(raw) as T
}

function parseMetaError(raw: string, status: number): string {
  try {
    const body = JSON.parse(raw) as {
      error?: { error_user_msg?: string; error_user_title?: string; message?: string }
    }
    const err = body.error
    if (err?.error_user_msg) {
      return err.error_user_title ? `${err.error_user_title}: ${err.error_user_msg}` : err.error_user_msg
    }
    if (err?.message) return err.message
  } catch {
    // fall through
  }
  return `Meta Ads API ${status}: ${raw.slice(0, 300)}`
}

async function getFromMeta<T>(
  path: string,
  params: Record<string, string>,
  token: string
): Promise<T> {
  const url = new URL(`${META_API_BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString())
  const raw = await res.text()
  if (!res.ok) throw new Error(`Meta Ads API ${res.status}: ${raw}`)
  return JSON.parse(raw) as T
}

// ==========================================
// Configuration
// ==========================================

export interface AdAccountConfig {
  adAccountId: string
  pageId: string
  igUserId: string
  token: string
}

export async function getAdAccountConfig(accountId?: string): Promise<AdAccountConfig> {
  const { igUserId, accessToken } = await getAccountCredentials(accountId)

  const adAccountEnv = process.env.META_AD_ACCOUNT_ID
  const pageIdEnv = process.env.META_PAGE_ID
  if (!adAccountEnv) throw new Error('META_AD_ACCOUNT_ID nao configurado')
  if (!pageIdEnv) throw new Error('META_PAGE_ID nao configurado')

  return {
    adAccountId: normalizeAdAccountId(adAccountEnv),
    pageId: pageIdEnv,
    igUserId,
    token: accessToken,
  }
}

// ==========================================
// Token debug
// ==========================================

export async function debugToken(token: string): Promise<TokenDebugInfo> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID ou META_APP_SECRET nao configurados')
  }

  const url = new URL(`${META_API_BASE_URL}/debug_token`)
  url.searchParams.set('input_token', token)
  url.searchParams.set('access_token', `${appId}|${appSecret}`)

  const res = await fetch(url.toString())
  const raw = await res.text()
  if (!res.ok) throw new Error(`debug_token ${res.status}: ${raw}`)

  const body = JSON.parse(raw) as {
    data?: {
      is_valid?: boolean
      scopes?: string[]
      expires_at?: number
      app_id?: string
    }
  }

  const data = body.data ?? {}
  const scopes = data.scopes ?? []
  const missingScopes = REQUIRED_ADS_SCOPES.filter((s) => !scopes.includes(s))

  return {
    isValid: Boolean(data.is_valid),
    scopes,
    hasAdsPermission: missingScopes.length === 0,
    missingScopes,
    expiresAt: data.expires_at ?? null,
    appId: data.app_id ?? null,
  }
}

// ==========================================
// Boost orchestrator (campaign → ad set → creative → ad)
// ==========================================

const OBJECTIVE_MAP: Record<
  BoostObjective,
  { campaignObjective: string; optimizationGoal: string }
> = {
  AWARENESS: { campaignObjective: 'OUTCOME_AWARENESS', optimizationGoal: 'REACH' },
  TRAFFIC: { campaignObjective: 'OUTCOME_TRAFFIC', optimizationGoal: 'LINK_CLICKS' },
  ENGAGEMENT: { campaignObjective: 'OUTCOME_ENGAGEMENT', optimizationGoal: 'POST_ENGAGEMENT' },
}

const GENDER_CODE: Record<BoostGender, number[] | undefined> = {
  ALL: undefined,
  MALE: [1],
  FEMALE: [2],
}

/**
 * Pre-flight: verifica se o media pode ser promovido como source_instagram_media_id.
 * Retorna null se elegivel, string com o motivo se nao. Usa o campo oficial
 * `is_eligible_for_promotion` exposto pela Graph API em instagram_user -> media.
 *
 * Vale para IMAGE, VIDEO, CAROUSEL_ALBUM e REELS — todos os tipos publicados
 * pelo usuario. Carrosseis nao tem tratamento especial; o Meta renderiza o
 * anuncio como carrossel automaticamente quando source_instagram_media_id
 * aponta para um CAROUSEL_ALBUM.
 */
async function checkMediaBoostEligibility(
  mediaId: string,
  token: string
): Promise<string | null> {
  try {
    const res = await getFromMeta<{
      is_eligible_for_promotion?: boolean
      ineligibility_reasons?: string[]
      media_type?: string
    }>(
      `/${mediaId}`,
      { fields: 'is_eligible_for_promotion,ineligibility_reasons,media_type' },
      token
    )
    if (res.is_eligible_for_promotion === false) {
      const reasons = res.ineligibility_reasons?.join(', ') ?? 'motivo nao informado'
      return `Post nao elegivel para impulsionamento (${res.media_type ?? 'desconhecido'}): ${reasons}`
    }
    return null
  } catch {
    // Se a Graph nao responde o campo de elegibilidade, seguimos em frente —
    // o erro real (se houver) aparecera na criacao do creative.
    return null
  }
}

export async function boostInstagramPost(input: BoostInput): Promise<BoostResult> {
  const { mediaId, dailyBudgetBRL, durationDays, caption, accountId } = input
  const launchImmediately = input.launchImmediately ?? false
  const status: 'ACTIVE' | 'PAUSED' = launchImmediately ? 'ACTIVE' : 'PAUSED'
  const objective: BoostObjective = input.objective ?? 'AWARENESS'
  const needsUrl = objective === 'TRAFFIC' || objective === 'ENGAGEMENT'
  const budgetType: BoostBudgetType = input.budgetType ?? 'daily'

  if (!mediaId) throw new Error('mediaId obrigatorio')
  if (budgetType === 'daily') {
    if (!(dailyBudgetBRL > 0)) throw new Error('dailyBudgetBRL deve ser > 0')
  } else {
    const total = Number(input.totalBudgetBRL)
    if (!(total > 0)) throw new Error('totalBudgetBRL deve ser > 0 quando budgetType=lifetime')
  }
  if (!(durationDays >= 1 && durationDays <= 30)) {
    throw new Error('durationDays deve estar entre 1 e 30')
  }
  if (needsUrl) {
    const url = input.destinationUrl?.trim()
    if (!url) throw new Error(`Objetivo ${objective} exige uma URL de destino`)
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('URL deve comecar com http:// ou https://')
      }
    } catch {
      throw new Error('URL de destino invalida')
    }
  }

  // Audience defaults
  const audience = input.audience ?? {}
  const countries = audience.countries?.length ? audience.countries : ['BR']
  const cities = audience.cities?.length ? audience.cities : undefined
  const regions = audience.regions?.length ? audience.regions : undefined
  const ageMin = audience.ageMin ?? 18
  const ageMax = audience.ageMax ?? 65
  const gender: BoostGender = audience.gender ?? 'ALL'
  const placements: BoostPlacement[] = audience.placements?.length
    ? audience.placements
    : ['stream', 'story', 'explore', 'reels']
  const interests = audience.interests?.length ? audience.interests : undefined
  const excludeFollowers = audience.excludeFollowers === true
  const customAudienceIds = audience.customAudienceIds?.filter((s) => typeof s === 'string' && s.length > 0)
  const excludedCustomAudienceIds = audience.excludedCustomAudienceIds?.filter((s) => typeof s === 'string' && s.length > 0)

  if (ageMin < 13 || ageMax > 65 || ageMin > ageMax) {
    throw new Error('Faixa etaria invalida (13-65, min <= max)')
  }

  const cfg = await getAdAccountConfig(accountId)

  // Pre-flight de elegibilidade — falha cedo em vez de criar campanha/adset
  // e so errar no passo do creative.
  const ineligibility = await checkMediaBoostEligibility(mediaId, cfg.token)
  if (ineligibility) throw new Error(ineligibility)

  const now = Date.now()

  // Start time: default "now + 1 min"; override with input.startDate if >= now
  let startTimeMs = now + 60_000
  if (input.startDate) {
    const requested = Date.parse(input.startDate)
    if (Number.isFinite(requested)) {
      startTimeMs = Math.max(requested, now + 60_000)
    }
  }
  const startTime = new Date(startTimeMs).toISOString()
  const endTime = new Date(startTimeMs + durationDays * 86_400_000).toISOString()
  const nameBase = buildCampaignName(caption, new Date(startTimeMs))
  const { campaignObjective, optimizationGoal } = OBJECTIVE_MAP[objective]

  logger.info('Iniciando boost', 'Meta Ads', {
    mediaId,
    dailyBudgetBRL,
    durationDays,
    objective,
    adAccountId: cfg.adAccountId,
  })

  // 1. Campaign
  const campaign = await postToMeta<{ id: string }>(
    `/${cfg.adAccountId}/campaigns`,
    {
      name: nameBase,
      objective: campaignObjective,
      status: status,
      special_ad_categories: '[]',
      is_adset_budget_sharing_enabled: false,
    },
    cfg.token
  )

  // 2. Ad Set
  // Build geo_locations: prefer cities+regions when provided, else fall back to country(ies)
  const geoLocations: Record<string, unknown> = {}
  if (cities) {
    geoLocations.cities = cities.map((c) => ({
      key: c.key,
      radius: Math.round((c.radiusKm ?? 17) / 1.609344), // Meta expects miles
      distance_unit: 'mile',
    }))
  }
  if (regions) {
    geoLocations.regions = regions.map((r) => ({ key: r.key }))
  }
  if (!cities && !regions) {
    geoLocations.countries = countries
  }

  const targeting: Record<string, unknown> = {
    geo_locations: geoLocations,
    age_min: ageMin,
    age_max: ageMax,
    publisher_platforms: ['instagram'],
    instagram_positions: placements,
  }
  const genderCodes = GENDER_CODE[gender]
  if (genderCodes) targeting.genders = genderCodes
  if (interests) {
    targeting.flexible_spec = [
      {
        interests: interests.map((i) => ({ id: i.id, name: i.name })),
      },
    ]
  }
  if (excludeFollowers) {
    // Excludes people connected to the FB Page linked to this ad account.
    // Best proxy for "don't show to current followers" that doesn't require a pre-built custom audience.
    targeting.excluded_connections = [{ id: cfg.pageId }]
  }
  if (customAudienceIds && customAudienceIds.length > 0) {
    targeting.custom_audiences = customAudienceIds.map((id) => ({ id }))
  }
  if (excludedCustomAudienceIds && excludedCustomAudienceIds.length > 0) {
    targeting.excluded_custom_audiences = excludedCustomAudienceIds.map((id) => ({ id }))
  }

  // Budget: daily vs lifetime (mutually exclusive)
  const budgetFields: Record<string, number> =
    budgetType === 'lifetime'
      ? { lifetime_budget: Math.round((input.totalBudgetBRL ?? 0) * 100) }
      : { daily_budget: Math.round(dailyBudgetBRL * 100) }

  const adSet = await postToMeta<{ id: string }>(
    `/${cfg.adAccountId}/adsets`,
    {
      name: nameBase,
      campaign_id: campaign.id,
      ...budgetFields,
      billing_event: 'IMPRESSIONS',
      optimization_goal: optimizationGoal,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      start_time: startTime,
      end_time: endTime,
      targeting: JSON.stringify(targeting),
      status: status,
    },
    cfg.token
  )

  // 3. Ad Creative — reference existing IG post, plus optional CTA/link for TRAFFIC/ENGAGEMENT
  const creativePayload: Record<string, string | number | boolean> = {
    name: nameBase,
    instagram_user_id: cfg.igUserId,
    source_instagram_media_id: mediaId,
  }
  if (needsUrl) {
    creativePayload.call_to_action = JSON.stringify({
      type: input.cta ?? 'LEARN_MORE',
      value: { link: input.destinationUrl!.trim() },
    })
  }
  // UTM / url tags: Meta appends this query string to every outbound link click
  const urlTags = input.urlTags?.trim()
  if (urlTags) {
    creativePayload.url_tags = urlTags.replace(/^\?/, '')
  }

  const creative = await postToMeta<{ id: string }>(
    `/${cfg.adAccountId}/adcreatives`,
    creativePayload,
    cfg.token
  )

  // 4. Ad
  const ad = await postToMeta<{ id: string }>(
    `/${cfg.adAccountId}/ads`,
    {
      name: nameBase,
      adset_id: adSet.id,
      creative: JSON.stringify({ creative_id: creative.id }),
      status: status,
    },
    cfg.token
  )

  logger.info('Boost criado com sucesso', 'Meta Ads', {
    mediaId,
    adId: ad.id,
    campaignId: campaign.id,
    status,
  })

  return {
    campaignId: campaign.id,
    adSetId: adSet.id,
    creativeId: creative.id,
    adId: ad.id,
    adAccountId: cfg.adAccountId,
    status,
  }
}

interface RawCustomAudience {
  id: string
  name: string
  subtype?: string
  approximate_count?: number
  approximate_count_lower_bound?: number
  approximate_count_upper_bound?: number
  delivery_status?: { code: number; description: string }
  operation_status?: { code: number; description: string }
}

export async function listCustomAudiences(
  accountId?: string
): Promise<CustomAudienceSummary[]> {
  const cfg = await getAdAccountConfig(accountId)
  const fields =
    'id,name,subtype,approximate_count,approximate_count_lower_bound,delivery_status,operation_status'

  const all: CustomAudienceSummary[] = []
  let nextUrl: string | null = `${META_API_BASE_URL}/${cfg.adAccountId}/customaudiences?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(cfg.token)}`

  while (nextUrl) {
    const res = await fetch(nextUrl)
    const raw = await res.text()
    if (!res.ok) throw new Error(`Meta Ads API ${res.status}: ${raw}`)
    const body = JSON.parse(raw) as {
      data?: RawCustomAudience[]
      paging?: { next?: string }
    }
    for (const a of body.data ?? []) {
      const count =
        a.approximate_count ?? a.approximate_count_lower_bound ?? null
      all.push({
        id: a.id,
        name: a.name,
        subtype: a.subtype ?? null,
        approximateCount: typeof count === 'number' ? count : null,
        deliveryStatus: a.delivery_status?.description ?? null,
        operationStatus: a.operation_status?.description ?? null,
      })
    }
    nextUrl = body.paging?.next ?? null
  }

  return all
}

export async function getAdStatus(
  adId: string,
  token: string
): Promise<{ id: string; status: string; effective_status: string }> {
  return getFromMeta(
    `/${adId}`,
    { fields: 'id,status,effective_status' },
    token
  )
}

export type AdStatusUpdate = 'ACTIVE' | 'PAUSED' | 'DELETED'

export async function updateAdStatus(
  adId: string,
  status: AdStatusUpdate,
  token: string
): Promise<{ id: string; status: string; effective_status: string }> {
  await postToMeta<{ success: boolean }>(`/${adId}`, { status }, token)
  return getAdStatus(adId, token)
}

// ==========================================
// List ads + nested insights for dashboard
// ==========================================

interface RawAdResponse {
  id: string
  name: string
  status: string
  effective_status: string
  created_time?: string
  campaign?: { id: string; name: string; objective?: string; status?: string }
  adset?: {
    id: string
    name: string
    status?: string
    daily_budget?: string
    lifetime_budget?: string
    start_time?: string
    end_time?: string
  }
  creative?: {
    id: string
    name?: string
    thumbnail_url?: string
    effective_instagram_media_id?: string
  }
  insights?: {
    data?: Array<{
      spend?: string
      reach?: string
      impressions?: string
      clicks?: string
      ctr?: string
      cpm?: string
      cpc?: string
      frequency?: string
    }>
  }
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toRow(raw: RawAdResponse): AdRow {
  const ins = raw.insights?.data?.[0] ?? {}
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    effectiveStatus: raw.effective_status,
    createdTime: raw.created_time ?? null,
    campaign: raw.campaign
      ? {
          id: raw.campaign.id,
          name: raw.campaign.name,
          objective: raw.campaign.objective ?? null,
          status: raw.campaign.status ?? null,
        }
      : null,
    adset: raw.adset
      ? {
          id: raw.adset.id,
          name: raw.adset.name,
          status: raw.adset.status ?? null,
          dailyBudgetBRL: raw.adset.daily_budget ? parseNumber(raw.adset.daily_budget) / 100 : null,
          lifetimeBudgetBRL: raw.adset.lifetime_budget ? parseNumber(raw.adset.lifetime_budget) / 100 : null,
          startTime: raw.adset.start_time ?? null,
          endTime: raw.adset.end_time ?? null,
        }
      : null,
    creative: raw.creative
      ? {
          id: raw.creative.id,
          name: raw.creative.name ?? null,
          thumbnailUrl: raw.creative.thumbnail_url ?? null,
          instagramMediaId: raw.creative.effective_instagram_media_id ?? null,
        }
      : null,
    insights: {
      spend: parseNumber(ins.spend),
      reach: parseNumber(ins.reach),
      impressions: parseNumber(ins.impressions),
      clicks: parseNumber(ins.clicks),
      ctr: parseNumber(ins.ctr),
      cpm: parseNumber(ins.cpm),
      cpc: parseNumber(ins.cpc),
      frequency: parseNumber(ins.frequency),
    },
  }
}

export async function listAdsWithInsights(
  opts: { since?: string; until?: string; accountId?: string } = {}
): Promise<AdRow[]> {
  const cfg = await getAdAccountConfig(opts.accountId)

  const insightsField =
    opts.since && opts.until
      ? `insights.time_range({"since":"${opts.since}","until":"${opts.until}"}){spend,reach,impressions,clicks,ctr,cpm,cpc,frequency}`
      : `insights{spend,reach,impressions,clicks,ctr,cpm,cpc,frequency}`

  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'created_time',
    'campaign{id,name,objective,status}',
    'adset{id,name,status,daily_budget,lifetime_budget,start_time,end_time}',
    'creative{id,name,thumbnail_url,effective_instagram_media_id}',
    insightsField,
  ].join(',')

  const rows: AdRow[] = []
  let nextUrl: string | null = `${META_API_BASE_URL}/${cfg.adAccountId}/ads?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(cfg.token)}`

  let guard = 0
  while (nextUrl && guard < 20) {
    const res = await fetch(nextUrl)
    const raw = await res.text()
    if (!res.ok) throw new Error(parseMetaError(raw, res.status))

    const body = JSON.parse(raw) as {
      data: RawAdResponse[]
      paging?: { next?: string }
    }
    for (const item of body.data ?? []) rows.push(toRow(item))
    nextUrl = body.paging?.next ?? null
    guard++
  }

  logger.info('Listed ads', 'Meta Ads', { count: rows.length, adAccountId: cfg.adAccountId })
  return rows
}

// ==========================================
// Drill-down: single ad meta + daily + breakdowns
// ==========================================

export async function getAdMeta(
  adId: string,
  opts: { since?: string; until?: string; accountId?: string } = {}
): Promise<AdRow> {
  const cfg = await getAdAccountConfig(opts.accountId)

  const insightsField =
    opts.since && opts.until
      ? `insights.time_range({"since":"${opts.since}","until":"${opts.until}"}){spend,reach,impressions,clicks,ctr,cpm,cpc,frequency}`
      : `insights{spend,reach,impressions,clicks,ctr,cpm,cpc,frequency}`

  const fields = [
    'id',
    'name',
    'status',
    'effective_status',
    'created_time',
    'campaign{id,name,objective,status}',
    'adset{id,name,status,daily_budget,lifetime_budget,start_time,end_time}',
    'creative{id,name,thumbnail_url,effective_instagram_media_id}',
    insightsField,
  ].join(',')

  const raw = await getFromMeta<RawAdResponse>(`/${adId}`, { fields }, cfg.token)
  return toRow(raw)
}

interface RawDailyInsight {
  spend?: string
  reach?: string
  impressions?: string
  date_start?: string
  date_stop?: string
}

export async function getAdDailyInsights(
  adId: string,
  since: string,
  until: string,
  opts: { accountId?: string } = {}
): Promise<AdDailyPoint[]> {
  const cfg = await getAdAccountConfig(opts.accountId)

  const body = await getFromMeta<{ data?: RawDailyInsight[] }>(
    `/${adId}/insights`,
    {
      fields: 'spend,reach,impressions',
      time_range: JSON.stringify({ since, until }),
      time_increment: '1',
    },
    cfg.token
  )

  const rows: AdDailyPoint[] = []
  for (const item of body.data ?? []) {
    // Meta returns date_start as YYYY-MM-DD for time_increment=1
    const date = item.date_start ?? ''
    if (!date) continue
    rows.push({
      date,
      spend: parseNumber(item.spend),
      reach: parseNumber(item.reach),
      impressions: parseNumber(item.impressions),
    })
  }
  return rows
}

interface RawBreakdownInsight {
  spend?: string
  reach?: string
  impressions?: string
  age?: string
  gender?: string
  publisher_platform?: string
  platform_position?: string
  [key: string]: string | undefined
}

export type AdBreakdownDimension =
  | 'age,gender'
  | 'publisher_platform'
  | 'age'
  | 'gender'

export async function getAdBreakdowns(
  adId: string,
  since: string,
  until: string,
  breakdowns: AdBreakdownDimension,
  opts: { accountId?: string } = {}
): Promise<AdBreakdownRow[]> {
  const cfg = await getAdAccountConfig(opts.accountId)

  const body = await getFromMeta<{ data?: RawBreakdownInsight[] }>(
    `/${adId}/insights`,
    {
      fields: 'spend,reach,impressions',
      time_range: JSON.stringify({ since, until }),
      breakdowns,
    },
    cfg.token
  )

  const rows: AdBreakdownRow[] = []
  for (const item of body.data ?? []) {
    let key = ''
    let subKey: string | undefined
    if (breakdowns === 'age,gender') {
      key = item.age ?? 'unknown'
      subKey = item.gender ?? undefined
    } else if (breakdowns === 'age') {
      key = item.age ?? 'unknown'
    } else if (breakdowns === 'gender') {
      key = item.gender ?? 'unknown'
    } else if (breakdowns === 'publisher_platform') {
      key = item.publisher_platform ?? 'unknown'
    }
    rows.push({
      key,
      subKey,
      spend: parseNumber(item.spend),
      reach: parseNumber(item.reach),
      impressions: parseNumber(item.impressions),
    })
  }
  return rows
}
