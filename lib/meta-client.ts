import { META_API_BASE_URL, TOKEN_EXPIRY_ALERT_DAYS } from './constants'
import { createServerSupabaseClient } from './supabase'
import type {
  AccountInfo,
  AccountInsights,
  MediaItem,
  MediaInsights,
  MediaType,
  StoryItem,
  StoryInsights,
  AudienceInsights,
} from '@/types/instagram'

// ==========================================
// Helpers internos
// ==========================================

async function fetchWithRetry(
  url: string,
  maxRetries = 3
): Promise<unknown> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url)

    if (res.ok) {
      return res.json()
    }

    // Rate limit ou erro temporario — retry com backoff
    if (res.status === 429 || res.status === 400) {
      const waitMs = Math.pow(2, attempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      lastError = new Error(`Meta API error ${res.status}: ${await res.text()}`)
      continue
    }

    // Erro definitivo
    const body = await res.text()
    throw new Error(`Meta API error ${res.status}: ${body}`)
  }

  throw lastError ?? new Error('Max retries exceeded')
}

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${META_API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

// ==========================================
// Multi-Account Support
// ==========================================

/**
 * Busca credenciais de uma conta Instagram pelo accountId (UUID da tabela instagram_accounts).
 * Quando accountId nao e fornecido, faz fallback para env vars (comportamento legado).
 */
export async function getAccountCredentials(
  accountId?: string
): Promise<{ igUserId: string; accessToken: string }> {
  if (!accountId) {
    // Fallback legado: env vars + app_config
    const accessToken = await getAccessToken()
    const igUserId = process.env.META_IG_USER_ID ?? 'me'
    return { igUserId, accessToken }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('ig_user_id, access_token, is_active')
    .eq('id', accountId)
    .single()

  if (error || !data) {
    throw new Error(`Instagram account not found: ${accountId}`)
  }

  const account = data as { ig_user_id: string; access_token: string; is_active: boolean }

  if (!account.is_active) {
    throw new Error(`Instagram account is deactivated: ${accountId}`)
  }

  return {
    igUserId: account.ig_user_id,
    accessToken: account.access_token,
  }
}

// ==========================================
// Token Management
// ==========================================

export async function getAccessToken(accountId?: string): Promise<string> {
  // Se accountId fornecido, buscar token direto da tabela instagram_accounts
  if (accountId) {
    const { accessToken } = await getAccountCredentials(accountId)
    return accessToken
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'ig_access_token')
    .single()

  if (error || !data) {
    // Fallback para variavel de ambiente (setup inicial)
    const envToken = process.env.META_ACCESS_TOKEN
    if (envToken) return envToken
    throw new Error('Access token not found in app_config or environment')
  }

  return data.value
}

export async function checkTokenExpiration(accountId?: string): Promise<{
  isExpiring: boolean
  daysLeft: number
}> {
  // Se accountId fornecido, verificar token_expires_at da tabela instagram_accounts
  if (accountId) {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('instagram_accounts')
      .select('token_expires_at')
      .eq('id', accountId)
      .single()

    const account = data as { token_expires_at: string | null } | null

    if (error || !account || !account.token_expires_at) {
      return { isExpiring: true, daysLeft: 0 }
    }

    const expiresAt = new Date(account.token_expires_at)
    const now = new Date()
    const daysLeft = Math.floor(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      isExpiring: daysLeft < TOKEN_EXPIRY_ALERT_DAYS,
      daysLeft,
    }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'ig_token_expires_at')
    .single()

  if (error || !data) {
    return { isExpiring: true, daysLeft: 0 }
  }

  const expiresAt = new Date(data.value)
  const now = new Date()
  const daysLeft = Math.floor(
    (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    isExpiring: daysLeft < TOKEN_EXPIRY_ALERT_DAYS,
    daysLeft,
  }
}

export async function saveToken(
  token: string,
  expiresAt: Date
): Promise<void> {
  const supabase = createServerSupabaseClient()

  const { error: tokenError } = await supabase
    .from('app_config')
    .upsert(
      { key: 'ig_access_token', value: token, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (tokenError) throw new Error(tokenError.message)

  const { error: expiryError } = await supabase
    .from('app_config')
    .upsert(
      { key: 'ig_token_expires_at', value: expiresAt.toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (expiryError) throw new Error(expiryError.message)
}

// ==========================================
// Meta Graph API Functions
// ==========================================

export async function getAccountInfo(token: string, userId?: string): Promise<AccountInfo> {
  const id = userId ?? process.env.META_IG_USER_ID ?? 'me'
  const url = buildUrl(`/${id}`, {
    fields: 'followers_count,media_count',
    access_token: token,
  })

  const data = (await fetchWithRetry(url)) as {
    followers_count: number
    media_count: number
  }
  return {
    followers_count: data.followers_count,
    following_count: 0, // following_count nao disponivel na API atual
    media_count: data.media_count,
  }
}

export async function getMediaList(
  token: string,
  userId: string,
  maxItems?: number
): Promise<MediaItem[]> {
  const items: MediaItem[] = []
  const perPage = Math.min(maxItems ?? 50, 50)
  let nextUrl: string | null = buildUrl(`/${userId}/media`, {
    fields: 'id,media_type,media_product_type,caption,permalink,thumbnail_url,timestamp',
    limit: String(perPage),
    access_token: token,
  })

  while (nextUrl) {
    const response = (await fetchWithRetry(nextUrl)) as {
      data: MediaItem[]
      paging?: { next?: string }
    }

    items.push(...response.data)

    // Respeitar limite maximo de midias
    if (maxItems && items.length >= maxItems) {
      return items.slice(0, maxItems)
    }

    nextUrl = response.paging?.next ?? null
  }

  return items
}

export async function getMediaInsights(
  token: string,
  mediaId: string,
  mediaType: MediaType | 'REEL'
): Promise<MediaInsights> {
  // Metricas diferentes para Reels vs Posts
  // impressions descontinuado desde v22+ para midias
  const isReel = mediaType === 'REEL'
  const metrics = isReel
    ? 'reach,saved,shares,comments,likes,ig_reels_avg_watch_time,views'
    : 'reach,saved,shares'

  const url = buildUrl(`/${mediaId}/insights`, {
    metric: metrics,
    access_token: token,
  })

  try {
    const response = (await fetchWithRetry(url)) as {
      data: Array<{ name: string; values: Array<{ value: number }> }>
    }

    const metricsMap: Record<string, number> = {}
    for (const item of response.data) {
      metricsMap[item.name] = item.values[0]?.value ?? 0
    }

    // Buscar likes e comments separadamente para posts (nao vem no insights)
    if (!isReel) {
      const mediaUrl = buildUrl(`/${mediaId}`, {
        fields: 'like_count,comments_count',
        access_token: token,
      })
      const mediaData = (await fetchWithRetry(mediaUrl)) as {
        like_count?: number
        comments_count?: number
      }

      return {
        reach: metricsMap['reach'] ?? 0,
        impressions: metricsMap['impressions'] ?? 0,
        saved: metricsMap['saved'] ?? 0,
        shares: metricsMap['shares'] ?? 0,
        likes: mediaData.like_count ?? 0,
        comments: mediaData.comments_count ?? 0,
      }
    }

    return {
      reach: metricsMap['reach'] ?? 0,
      impressions: 0,
      saved: metricsMap['saved'] ?? 0,
      shares: metricsMap['shares'] ?? 0,
      likes: metricsMap['likes'] ?? 0,
      comments: metricsMap['comments'] ?? 0,
      views: metricsMap['views'] ?? 0,
      avg_watch_time: metricsMap['ig_reels_avg_watch_time'] ?? 0,
    }
  } catch {
    // Alguns posts antigos podem nao ter insights disponiveis
    return {
      reach: 0,
      impressions: 0,
      saved: 0,
      shares: 0,
      likes: 0,
      comments: 0,
    }
  }
}

export async function getAccountInsights(
  token: string,
  userId: string
): Promise<AccountInsights> {
  // API v21+ usa metric_type=total_value com period=day e range since/until
  const now = Math.floor(Date.now() / 1000)
  const sevenDaysAgo = now - 7 * 24 * 60 * 60

  const url = buildUrl(`/${userId}/insights`, {
    metric: 'reach,profile_views,website_clicks',
    metric_type: 'total_value',
    period: 'day',
    since: String(sevenDaysAgo),
    until: String(now),
    access_token: token,
  })

  const response = (await fetchWithRetry(url)) as {
    data: Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>
  }

  const metricsMap: Record<string, number> = {}
  for (const item of response.data) {
    // API nova usa total_value, API antiga usa values[]
    metricsMap[item.name] = item.total_value?.value ?? item.values?.[0]?.value ?? 0
  }

  return {
    reach: metricsMap['reach'] ?? 0,
    impressions: 0, // impressions removido da API de conta
    profile_views: metricsMap['profile_views'] ?? 0,
    website_clicks: metricsMap['website_clicks'] ?? 0,
  }
}

export async function getActiveStories(
  token: string,
  userId: string
): Promise<StoryItem[]> {
  const url = buildUrl(`/${userId}/stories`, {
    fields: 'id,media_type,media_url,thumbnail_url,permalink,timestamp',
    access_token: token,
  })

  const response = (await fetchWithRetry(url)) as {
    data: StoryItem[]
  }

  return response.data ?? []
}

export async function getStoryInsights(
  token: string,
  mediaId: string
): Promise<StoryInsights> {
  // v22+: exits, taps_forward, taps_back, impressions, likes removidos
  const url = buildUrl(`/${mediaId}/insights`, {
    metric: 'reach,replies,navigation,follows,profile_visits,shares,total_interactions',
    access_token: token,
  })

  const response = (await fetchWithRetry(url)) as {
    data: Array<{ name: string; values: Array<{ value: number }> }>
  }

  const metricsMap: Record<string, number> = {}
  for (const item of response.data) {
    metricsMap[item.name] = item.values[0]?.value ?? 0
  }

  return {
    reach: metricsMap['reach'] ?? 0,
    replies: metricsMap['replies'] ?? 0,
    navigation: metricsMap['navigation'] ?? 0,
    follows: metricsMap['follows'] ?? 0,
    profile_visits: metricsMap['profile_visits'] ?? 0,
    shares: metricsMap['shares'] ?? 0,
    total_interactions: metricsMap['total_interactions'] ?? 0,
  }
}

export async function getAudienceInsights(
  token: string,
  userId: string
): Promise<AudienceInsights> {
  // API v21+ usa follower_demographics com breakdowns
  type BreakdownResult = {
    data: Array<{
      name: string
      total_value?: {
        breakdowns: Array<{
          dimension_keys: string[]
          results: Array<{ dimension_values: string[]; value: number }>
        }>
      }
      values?: Array<{ value: Record<string, number> }>
    }>
  }

  const [ageGenderRes, cityRes, countryRes] = await Promise.all([
    fetchWithRetry(
      buildUrl(`/${userId}/insights`, {
        metric: 'follower_demographics',
        period: 'lifetime',
        metric_type: 'total_value',
        breakdown: 'age,gender',
        access_token: token,
      })
    ) as Promise<BreakdownResult>,
    fetchWithRetry(
      buildUrl(`/${userId}/insights`, {
        metric: 'follower_demographics',
        period: 'lifetime',
        metric_type: 'total_value',
        breakdown: 'city',
        access_token: token,
      })
    ) as Promise<BreakdownResult>,
    fetchWithRetry(
      buildUrl(`/${userId}/insights`, {
        metric: 'follower_demographics',
        period: 'lifetime',
        metric_type: 'total_value',
        breakdown: 'country',
        access_token: token,
      })
    ) as Promise<BreakdownResult>,
  ])

  // Parse age_gender: results have dimension_values ["25-34", "F"]
  const ageGender: Record<string, number> = {}
  const breakdowns = ageGenderRes.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []
  for (const r of breakdowns) {
    const [age, gender] = r.dimension_values
    ageGender[`${gender}.${age}`] = r.value
  }

  // Parse cities
  const cities: Record<string, number> = {}
  const cityResults = cityRes.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []
  for (const r of cityResults) {
    cities[r.dimension_values[0]] = r.value
  }

  // Parse countries
  const countries: Record<string, number> = {}
  const countryResults = countryRes.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []
  for (const r of countryResults) {
    countries[r.dimension_values[0]] = r.value
  }

  return {
    age_gender: ageGender,
    cities,
    countries,
    online_followers: {}, // online_followers retorna vazio na API atual
  }
}

// ==========================================
// Content Publishing
// ==========================================

async function postWithRetry(
  url: string,
  body: Record<string, string>,
  maxRetries = 3
): Promise<unknown> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams(body),
    })

    if (res.ok) {
      return res.json()
    }

    if (res.status === 429 || res.status >= 500) {
      const waitMs = Math.pow(2, attempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      lastError = new Error(`Meta API POST error ${res.status}: ${await res.text()}`)
      continue
    }

    const text = await res.text()
    throw new Error(`Meta API POST error ${res.status}: ${text}`)
  }

  throw lastError ?? new Error('Max retries exceeded')
}

/**
 * Cria um container de midia no Instagram.
 * Step 1 do fluxo de publicacao.
 */
export async function createMediaContainer(
  token: string,
  userId: string,
  params: {
    mediaType: 'IMAGE' | 'CAROUSEL' | 'REELS'
    imageUrl?: string
    videoUrl?: string
    caption?: string
    carouselItemIds?: string[]
    isCarouselItem?: boolean
    locationId?: string
    userTags?: Array<{ username: string; x: number; y: number }>
    altText?: string
    collaborators?: string[]
    coverUrl?: string
  }
): Promise<string> {
  const body: Record<string, string> = { access_token: token }

  if (params.isCarouselItem) {
    body.image_url = params.imageUrl!
    body.is_carousel_item = 'true'
    if (params.altText) body.alt_text = params.altText
    if (params.userTags?.length) {
      body.user_tags = JSON.stringify(params.userTags.map(t => ({
        username: t.username, x: t.x, y: t.y,
      })))
    }
  } else if (params.mediaType === 'CAROUSEL') {
    body.media_type = 'CAROUSEL'
    body.children = params.carouselItemIds!.join(',')
    if (params.caption) body.caption = params.caption
    if (params.locationId) body.location_id = params.locationId
    if (params.collaborators?.length) {
      body.collaborators = JSON.stringify(params.collaborators)
    }
  } else if (params.mediaType === 'REELS') {
    body.media_type = 'REELS'
    body.video_url = params.videoUrl!
    if (params.caption) body.caption = params.caption
    if (params.locationId) body.location_id = params.locationId
    if (params.coverUrl) body.cover_url = params.coverUrl
    if (params.collaborators?.length) {
      body.collaborators = JSON.stringify(params.collaborators)
    }
  } else {
    body.image_url = params.imageUrl!
    if (params.caption) body.caption = params.caption
    if (params.locationId) body.location_id = params.locationId
    if (params.altText) body.alt_text = params.altText
    if (params.userTags?.length) {
      body.user_tags = JSON.stringify(params.userTags.map(t => ({
        username: t.username, x: t.x, y: t.y,
      })))
    }
    if (params.collaborators?.length) {
      body.collaborators = JSON.stringify(params.collaborators)
    }
  }

  const url = `${META_API_BASE_URL}/${userId}/media`
  const response = (await postWithRetry(url, body)) as { id: string }
  return response.id
}

/**
 * Verifica status do container (necessario para videos/reels).
 * Step 2 do fluxo de publicacao.
 */
export async function pollContainerStatus(
  token: string,
  containerId: string,
  maxAttempts = 30,
  intervalMs = 10000
): Promise<'FINISHED' | 'ERROR'> {
  for (let i = 0; i < maxAttempts; i++) {
    const url = buildUrl(`/${containerId}`, {
      fields: 'status_code',
      access_token: token,
    })
    const data = (await fetchWithRetry(url)) as { status_code: string }

    if (data.status_code === 'FINISHED') return 'FINISHED'
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') return 'ERROR'

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return 'ERROR'
}

/**
 * Publica o container no Instagram.
 * Step 3 do fluxo de publicacao.
 */
export async function publishMedia(
  token: string,
  userId: string,
  containerId: string
): Promise<string> {
  const url = `${META_API_BASE_URL}/${userId}/media_publish`
  const response = (await postWithRetry(url, {
    creation_id: containerId,
    access_token: token,
  })) as { id: string }
  return response.id
}

/**
 * Verifica quota de publicacao restante.
 */
export async function getPublishingQuota(
  token: string,
  userId: string
): Promise<{ used: number; total: number }> {
  const url = buildUrl(`/${userId}/content_publishing_limit`, {
    fields: 'quota_usage,config',
    access_token: token,
  })
  const response = (await fetchWithRetry(url)) as {
    data: Array<{ quota_usage: number; config: { quota_total: number } }>
  }
  const item = response.data[0]
  return { used: item.quota_usage, total: item.config.quota_total }
}

// ==========================================
// Token Refresh
// ==========================================

export async function refreshLongLivedToken(
  currentToken: string
): Promise<{ token: string; expiresAt: Date }> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('META_APP_ID and META_APP_SECRET required for token refresh')
  }

  const url = buildUrl('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: currentToken,
  })

  const response = (await fetchWithRetry(url)) as {
    access_token: string
    expires_in: number
  }

  const expiresAt = new Date(Date.now() + response.expires_in * 1000)

  await saveToken(response.access_token, expiresAt)

  return {
    token: response.access_token,
    expiresAt,
  }
}
