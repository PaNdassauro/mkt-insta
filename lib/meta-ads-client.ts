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

export interface BoostAudience {
  countries?: string[] // ISO-2: ['BR', 'US'], default ['BR']
  ageMin?: number // default 18
  ageMax?: number // default 65
  gender?: BoostGender // default 'ALL'
  placements?: BoostPlacement[] // default all four
}

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

export async function boostInstagramPost(input: BoostInput): Promise<BoostResult> {
  const { mediaId, dailyBudgetBRL, durationDays, caption, accountId } = input
  const launchImmediately = input.launchImmediately ?? false
  const status: 'ACTIVE' | 'PAUSED' = launchImmediately ? 'ACTIVE' : 'PAUSED'
  const objective: BoostObjective = input.objective ?? 'AWARENESS'
  const needsUrl = objective === 'TRAFFIC' || objective === 'ENGAGEMENT'

  if (!mediaId) throw new Error('mediaId obrigatorio')
  if (!(dailyBudgetBRL > 0)) throw new Error('dailyBudgetBRL deve ser > 0')
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
  const ageMin = audience.ageMin ?? 18
  const ageMax = audience.ageMax ?? 65
  const gender: BoostGender = audience.gender ?? 'ALL'
  const placements: BoostPlacement[] = audience.placements?.length
    ? audience.placements
    : ['stream', 'story', 'explore', 'reels']

  if (ageMin < 13 || ageMax > 65 || ageMin > ageMax) {
    throw new Error('Faixa etaria invalida (13-65, min <= max)')
  }

  const cfg = await getAdAccountConfig(accountId)
  const dailyBudgetCents = Math.round(dailyBudgetBRL * 100)
  const now = Date.now()
  const startTime = new Date(now + 60_000).toISOString() // 1 min from now
  const endTime = new Date(now + durationDays * 86_400_000).toISOString()
  const nameBase = buildCampaignName(caption, new Date(now))
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
  const targeting: Record<string, unknown> = {
    geo_locations: { countries },
    age_min: ageMin,
    age_max: ageMax,
    publisher_platforms: ['instagram'],
    instagram_positions: placements,
  }
  const genderCodes = GENDER_CODE[gender]
  if (genderCodes) targeting.genders = genderCodes

  const adSet = await postToMeta<{ id: string }>(
    `/${cfg.adAccountId}/adsets`,
    {
      name: nameBase,
      campaign_id: campaign.id,
      daily_budget: dailyBudgetCents,
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
