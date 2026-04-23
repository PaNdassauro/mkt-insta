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

export interface BoostInput {
  mediaId: string
  dailyBudgetBRL: number
  durationDays: number
  caption?: string | null
  launchImmediately?: boolean
  accountId?: string
}

export interface BoostResult {
  campaignId: string
  adSetId: string
  creativeId: string
  adId: string
  adAccountId: string
  status: 'ACTIVE' | 'PAUSED'
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

export async function boostInstagramPost(input: BoostInput): Promise<BoostResult> {
  const { mediaId, dailyBudgetBRL, durationDays, caption, accountId } = input
  const launchImmediately = input.launchImmediately ?? false
  const status: 'ACTIVE' | 'PAUSED' = launchImmediately ? 'ACTIVE' : 'PAUSED'

  if (!mediaId) throw new Error('mediaId obrigatorio')
  if (!(dailyBudgetBRL > 0)) throw new Error('dailyBudgetBRL deve ser > 0')
  if (!(durationDays >= 1 && durationDays <= 30)) {
    throw new Error('durationDays deve estar entre 1 e 30')
  }

  const cfg = await getAdAccountConfig(accountId)
  const dailyBudgetCents = Math.round(dailyBudgetBRL * 100)
  const now = Date.now()
  const startTime = new Date(now + 60_000).toISOString() // 1 min from now
  const endTime = new Date(now + durationDays * 86_400_000).toISOString()
  const nameBase = buildCampaignName(caption, new Date(now))

  logger.info('Iniciando boost', 'Meta Ads', {
    mediaId,
    dailyBudgetBRL,
    durationDays,
    adAccountId: cfg.adAccountId,
  })

  // 1. Campaign — AWARENESS: no external URL required, optimizes for reach
  const campaign = await postToMeta<{ id: string }>(
    `/${cfg.adAccountId}/campaigns`,
    {
      name: nameBase,
      objective: 'OUTCOME_AWARENESS',
      status: status,
      special_ad_categories: '[]',
      is_adset_budget_sharing_enabled: false,
    },
    cfg.token
  )

  // 2. Ad Set — IG-only placements, BR, engagement optimization
  const targeting = {
    geo_locations: { countries: ['BR'] },
    age_min: 18,
    age_max: 65,
    publisher_platforms: ['instagram'],
    instagram_positions: ['stream', 'story', 'explore', 'reels'],
  }

  const adSet = await postToMeta<{ id: string }>(
    `/${cfg.adAccountId}/adsets`,
    {
      name: nameBase,
      campaign_id: campaign.id,
      daily_budget: dailyBudgetCents,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      start_time: startTime,
      end_time: endTime,
      targeting: JSON.stringify(targeting),
      status: status,
    },
    cfg.token
  )

  // 3. Ad Creative — reference existing IG post
  const creative = await postToMeta<{ id: string }>(
    `/${cfg.adAccountId}/adcreatives`,
    {
      name: nameBase,
      instagram_user_id: cfg.igUserId,
      source_instagram_media_id: mediaId,
    },
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
