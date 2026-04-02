import { logger } from '@/lib/logger'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAccessToken } from '@/lib/meta-client'
import { META_API_BASE_URL } from '@/lib/constants'
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response'
import { resolveAccountId } from '@/lib/account-context'

export const dynamic = "force-dynamic"

interface CompetitorMedia {
  id: string
  caption?: string
  like_count?: number
  comments_count?: number
  media_type?: string
  timestamp?: string
  permalink?: string
}

interface TopPost {
  username: string
  caption: string
  likes: number
  comments: number
  format: string
  permalink: string
}

export async function GET(request: Request) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const accountId = await resolveAccountId(request)
    const supabase = createServerSupabaseClient()
    const token = await getAccessToken()
    const userId = process.env.META_IG_USER_ID ?? 'me'

    // 1. Query all competitors
    let competitorsQuery = supabase
      .from('instagram_competitors')
      .select('*')
      .order('added_at', { ascending: false })
    if (accountId) competitorsQuery = competitorsQuery.eq('account_id', accountId)

    const { data: competitors, error: compError } = await competitorsQuery
    if (compError) throw compError

    if (!competitors || competitors.length === 0) {
      return apiSuccess({
        top_posts: [],
        trending_hashtags: [],
        dominant_format: null,
        suggestion: 'Adicione concorrentes para ver inspiracoes de conteudo.',
      })
    }

    // 2. Fetch recent media for each competitor via Business Discovery
    const allMedia: (CompetitorMedia & { username: string })[] = []

    for (const comp of competitors) {
      try {
        const mediaFields = 'media.limit(9){id,caption,like_count,comments_count,media_type,timestamp,permalink}'
        const url = `${META_API_BASE_URL}/${userId}?fields=business_discovery.fields(${mediaFields})&business_discovery.username=${comp.username}&access_token=${token}`
        const res = await fetch(url)

        if (res.ok) {
          const data = await res.json()
          const media: CompetitorMedia[] = data?.business_discovery?.media?.data ?? []
          for (const m of media) {
            allMedia.push({ ...m, username: comp.username })
          }
        } else {
          logger.warn(`Business Discovery media failed for @${comp.username}`, 'CompetitorInsights')
        }
      } catch {
        logger.warn(`Failed to fetch media for @${comp.username}`, 'CompetitorInsights')
      }
    }

    if (allMedia.length === 0) {
      return apiSuccess({
        top_posts: [],
        trending_hashtags: [],
        dominant_format: null,
        suggestion: 'Nao foi possivel buscar posts dos concorrentes. Verifique se os perfis sao publicos/business.',
      })
    }

    // 3. Analyze: top 3 posts by engagement
    const sorted = [...allMedia].sort(
      (a, b) =>
        ((b.like_count ?? 0) + (b.comments_count ?? 0)) -
        ((a.like_count ?? 0) + (a.comments_count ?? 0))
    )

    const top_posts: TopPost[] = sorted.slice(0, 3).map((m) => ({
      username: m.username,
      caption: m.caption ?? '',
      likes: m.like_count ?? 0,
      comments: m.comments_count ?? 0,
      format: m.media_type ?? 'IMAGE',
      permalink: m.permalink ?? '',
    }))

    // 4. Extract common hashtags from top posts (top 10 by engagement)
    const topForHashtags = sorted.slice(0, 10)
    const hashtagCounts = new Map<string, number>()
    for (const m of topForHashtags) {
      const tags = m.caption?.match(/#[\w\u00C0-\u024F]+/g) ?? []
      for (const tag of tags) {
        const lower = tag.toLowerCase()
        hashtagCounts.set(lower, (hashtagCounts.get(lower) ?? 0) + 1)
      }
    }
    const trending_hashtags = Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag)

    // 5. Identify dominant format
    const formatCounts = new Map<string, number>()
    for (const m of allMedia) {
      const fmt = m.media_type ?? 'IMAGE'
      formatCounts.set(fmt, (formatCounts.get(fmt) ?? 0) + 1)
    }
    let dominant_format = 'IMAGE'
    let maxCount = 0
    for (const [fmt, count] of Array.from(formatCounts.entries())) {
      if (count > maxCount) {
        dominant_format = fmt
        maxCount = count
      }
    }

    // 6. Build suggestion
    const formatLabel: Record<string, string> = {
      VIDEO: 'Reels',
      REEL: 'Reels',
      IMAGE: 'Imagens',
      CAROUSEL_ALBUM: 'Carrosseis',
    }
    const fmtName = formatLabel[dominant_format] ?? dominant_format
    const hashtagSnippet = trending_hashtags.slice(0, 3).join(' ')
    const suggestion = `Seus concorrentes estao focando em ${fmtName}.${
      hashtagSnippet ? ` Os top posts usam ${hashtagSnippet}.` : ''
    }`

    return apiSuccess({
      top_posts,
      trending_hashtags,
      dominant_format,
      suggestion,
    })
  } catch (err) {
    logger.error('GET error', 'CompetitorInsights', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
