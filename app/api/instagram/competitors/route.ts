import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken } from '@/lib/meta-client'
import { META_API_BASE_URL } from '@/lib/constants'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()

    let competitorsQuery = supabase
      .from('instagram_competitors')
      .select('*')
      .order('added_at', { ascending: false })
    if (accountId) competitorsQuery = competitorsQuery.eq('account_id', accountId)

    const { data: competitors, error: compError } = await competitorsQuery

    if (compError) throw compError

    // Buscar todos os snapshots mais recentes em uma unica query
    const compIds = (competitors ?? []).map((c) => c.id)
    const { data: allSnapshots } = compIds.length > 0
      ? await supabase
          .from('instagram_competitor_snapshots')
          .select('*')
          .in('competitor_id', compIds)
          .order('date', { ascending: false })
      : { data: [] }

    // Agrupar por competitor_id (pegar apenas o mais recente)
    const snapList = allSnapshots ?? []
    const snapshotMap = new Map<string, (typeof snapList)[number]>()
    for (const snap of snapList) {
      if (!snapshotMap.has(snap.competitor_id)) {
        snapshotMap.set(snap.competitor_id, snap)
      }
    }

    const results = (competitors ?? []).map((comp) => ({
      ...comp,
      latest_snapshot: snapshotMap.get(comp.id) ?? null,
    }))

    return apiSuccess({ data: results })
  } catch (err) {
    logger.error('GET error', 'DashIG Competitors', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

export async function POST(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { username, display_name, ig_user_id } = body

    if (!username) {
      return apiError('username is required', 400)
    }

    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()
    const cleanUsername = username.toLowerCase().replace('@', '')

    const payload: Record<string, string | null | number> = {
      username: cleanUsername,
      display_name: display_name || cleanUsername,
      account_id: accountId,
    }
    if (ig_user_id) payload.ig_user_id = ig_user_id

    // Tentar buscar dados via Business Discovery API
    try {
      const token = await getAccessToken()
      const userId = process.env.META_IG_USER_ID ?? 'me'
      const fields = 'username,name,biography,followers_count,media_count,profile_picture_url,ig_id'
      const discoveryRes = await fetch(
        `${META_API_BASE_URL}/${userId}?fields=business_discovery.fields(${fields})&business_discovery.username=${cleanUsername}&access_token=${token}`
      )

      if (discoveryRes.ok) {
        const discoveryData = await discoveryRes.json()
        const biz = discoveryData.business_discovery
        if (biz) {
          payload.display_name = biz.name ?? cleanUsername
          payload.ig_user_id = biz.ig_id ? String(biz.ig_id) : (biz.id ?? null)
          // Criar snapshot inicial com dados de seguidores
          logger.info(`Competitor discovered: @${cleanUsername}`, 'Competitors', {
            followers: biz.followers_count,
            media: biz.media_count,
          })
        }
      } else {
        logger.warn(`Business Discovery failed for @${cleanUsername}`, 'Competitors')
      }
    } catch {
      logger.warn(`Could not fetch discovery for @${cleanUsername}`, 'Competitors')
    }

    const { data, error } = await supabase
      .from('instagram_competitors')
      .upsert(payload, { onConflict: 'username' })
      .select()
      .single()

    if (error) throw error

    // Se temos dados do Discovery, criar snapshot inicial
    if (payload.ig_user_id) {
      try {
        const token = await getAccessToken()
        const userId = process.env.META_IG_USER_ID ?? 'me'
        const fields = 'followers_count,media_count'
        const res = await fetch(
          `${META_API_BASE_URL}/${userId}?fields=business_discovery.fields(${fields})&business_discovery.username=${cleanUsername}&access_token=${token}`
        )
        if (res.ok) {
          const d = await res.json()
          const biz = d.business_discovery
          if (biz) {
            await supabase.from('instagram_competitor_snapshots').upsert(
              {
                competitor_id: data.id,
                date: new Date().toISOString().slice(0, 10),
                followers_count: biz.followers_count ?? null,
                media_count: biz.media_count ?? null,
              },
              { onConflict: 'competitor_id,date' }
            )
          }
        }
      } catch {
        // Non-critical
      }
    }

    return apiSuccess({ data })
  } catch (err) {
    logger.error('POST error', 'DashIG Competitors', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return apiError('id is required', 400)

    const supabase = createServerSupabaseClient()

    // Deletar snapshots primeiro
    await supabase.from('instagram_competitor_snapshots').delete().eq('competitor_id', id)
    const { error } = await supabase.from('instagram_competitors').delete().eq('id', id)

    if (error) throw error

    return apiSuccess({ success: true })
  } catch (err) {
    logger.error('DELETE error', 'DashIG Competitors', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
