import { createServerSupabaseClient } from '@/lib/supabase'
import { apiSuccess, withErrorHandler } from '@/lib/api-response'
import { logger } from '@/lib/logger'

// ============================================================
// Recommendation Engine — Analisa dados historicos e retorna
// 3-5 recomendacoes acionaveis para o time de marketing.
// ============================================================

interface Recommendation {
  type: 'timing' | 'format' | 'gap' | 'theme' | 'trend'
  title: string
  description: string
  confidence: 'high' | 'medium' | 'low'
  data: Record<string, unknown>
}

const DAY_LABELS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado']

export const GET = withErrorHandler(async () => {
  const supabase = createServerSupabaseClient()
  const recommendations: Recommendation[] = []

  // -------------------------------------------------------
  // Fetch all data in parallel
  // -------------------------------------------------------
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const [postsRes, reelsRes, calendarRes] = await Promise.all([
    supabase
      .from('instagram_posts')
      .select('id, media_type, caption, hashtags, likes, comments, saves, shares, reach, engagement_rate, timestamp')
      .gte('timestamp', thirtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false }),
    supabase
      .from('instagram_reels')
      .select('id, caption, hashtags, likes, comments, saves, shares, reach, views, timestamp')
      .gte('timestamp', thirtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false }),
    supabase
      .from('editorial_calendar')
      .select('id, scheduled_for, content_type, status')
      .gte('scheduled_for', now.toISOString().split('T')[0])
      .lte('scheduled_for', sevenDaysFromNow.toISOString().split('T')[0])
      .neq('status', 'CANCELLED'),
  ])

  if (postsRes.error) throw postsRes.error
  if (reelsRes.error) throw reelsRes.error
  if (calendarRes.error) {
    logger.warn('Editorial calendar query failed, skipping gap analysis', 'Recommendations', {
      error: calendarRes.error as unknown as Record<string, unknown>,
    })
  }

  const posts = postsRes.data ?? []
  const reels = reelsRes.data ?? []
  const calendarEntries = calendarRes.data ?? []

  logger.info('Data fetched for recommendations', 'Recommendations', {
    posts: posts.length,
    reels: reels.length,
    calendar: calendarEntries.length,
  })

  // Helper: compute engagement rate for a reel
  function reelEngRate(r: typeof reels[number]): number {
    if (!r.reach || r.reach === 0) return 0
    return ((r.likes + r.comments + r.saves + r.shares) / r.reach) * 100
  }

  // Unified content items for cross-analysis
  type ContentItem = {
    timestamp: string | null
    engagementRate: number
    format: 'IMAGE' | 'CAROUSEL_ALBUM' | 'REEL'
    hashtags: string[] | null
  }

  const allContent: ContentItem[] = [
    ...posts.map((p) => ({
      timestamp: p.timestamp,
      engagementRate: p.engagement_rate ?? 0,
      format: p.media_type as 'IMAGE' | 'CAROUSEL_ALBUM',
      hashtags: p.hashtags as string[] | null,
    })),
    ...reels.map((r) => ({
      timestamp: r.timestamp,
      engagementRate: reelEngRate(r),
      format: 'REEL' as const,
      hashtags: r.hashtags as string[] | null,
    })),
  ]

  if (allContent.length === 0) {
    logger.info('No content found for recommendations', 'Recommendations')
    return apiSuccess({ recommendations: [] }, 200, 3600)
  }

  // -------------------------------------------------------
  // 1. Best posting times
  // -------------------------------------------------------
  try {
    const slotMap = new Map<string, { totalEng: number; count: number }>()
    const recentSlotCounts = new Map<string, number>()

    for (const item of allContent) {
      if (!item.timestamp) continue
      const d = new Date(item.timestamp)
      const dayOfWeek = d.getUTCDay()
      const hour = d.getUTCHours()
      // Adjust to BRT (UTC-3)
      const brtHour = (hour - 3 + 24) % 24
      const brtDay = hour < 3 ? (dayOfWeek - 1 + 7) % 7 : dayOfWeek
      const key = `${brtDay}-${brtHour}`

      const existing = slotMap.get(key) ?? { totalEng: 0, count: 0 }
      existing.totalEng += item.engagementRate
      existing.count++
      slotMap.set(key, existing)

      if (new Date(item.timestamp) >= fourteenDaysAgo) {
        recentSlotCounts.set(key, (recentSlotCounts.get(key) ?? 0) + 1)
      }
    }

    const slots = Array.from(slotMap.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([key, v]) => {
        const [day, hour] = key.split('-').map(Number)
        return {
          key,
          day,
          hour,
          avgEng: v.totalEng / v.count,
          count: v.count,
          recentCount: recentSlotCounts.get(key) ?? 0,
        }
      })
      .sort((a, b) => b.avgEng - a.avgEng)

    const globalAvgEng = allContent.reduce((s, c) => s + c.engagementRate, 0) / allContent.length

    // Find top slots that are underused recently
    const topSlots = slots.filter((s) => s.avgEng > globalAvgEng).slice(0, 5)
    const underusedSlot = topSlots.find((s) => s.recentCount === 0) ?? topSlots.find((s) => s.recentCount <= 1)

    if (underusedSlot) {
      const pctAbove = ((underusedSlot.avgEng - globalAvgEng) / globalAvgEng * 100).toFixed(0)
      recommendations.push({
        type: 'timing',
        title: `Poste mais as ${DAY_LABELS[underusedSlot.day]}s as ${underusedSlot.hour}h`,
        description: `Posts nesse horario tem ${pctAbove}% mais engagement que a media geral, mas voce nao tem postado nesse slot recentemente.`,
        confidence: underusedSlot.count >= 5 ? 'high' : 'medium',
        data: {
          day: DAY_LABELS[underusedSlot.day],
          hour: underusedSlot.hour,
          avgEngagement: Number(underusedSlot.avgEng.toFixed(2)),
          globalAvg: Number(globalAvgEng.toFixed(2)),
          sampleSize: underusedSlot.count,
          recentPosts: underusedSlot.recentCount,
        },
      })
    } else if (topSlots.length > 0) {
      const best = topSlots[0]
      recommendations.push({
        type: 'timing',
        title: `Melhor horario: ${DAY_LABELS[best.day]} as ${best.hour}h`,
        description: `Seu melhor slot de engagement (${best.avgEng.toFixed(1)}% media) esta sendo bem utilizado. Continue assim!`,
        confidence: best.count >= 5 ? 'high' : 'medium',
        data: {
          day: DAY_LABELS[best.day],
          hour: best.hour,
          avgEngagement: Number(best.avgEng.toFixed(2)),
          sampleSize: best.count,
        },
      })
    }
  } catch (err) {
    logger.warn('Timing analysis failed', 'Recommendations', { error: err as Record<string, unknown> })
  }

  // -------------------------------------------------------
  // 2. Best formats
  // -------------------------------------------------------
  try {
    const formatMap = new Map<string, { totalEng: number; count: number; recentCount: number }>()

    for (const item of allContent) {
      const label = item.format === 'CAROUSEL_ALBUM' ? 'CAROUSEL' : item.format
      const existing = formatMap.get(label) ?? { totalEng: 0, count: 0, recentCount: 0 }
      existing.totalEng += item.engagementRate
      existing.count++
      if (item.timestamp && new Date(item.timestamp) >= fourteenDaysAgo) {
        existing.recentCount++
      }
      formatMap.set(label, existing)
    }

    const formats = Array.from(formatMap.entries())
      .filter(([, v]) => v.count >= 2)
      .map(([label, v]) => ({
        label,
        avgEng: v.totalEng / v.count,
        count: v.count,
        recentCount: v.recentCount,
        recentShare: v.recentCount / Math.max(1, Array.from(formatMap.values()).reduce((s, f) => s + f.recentCount, 0)),
      }))
      .sort((a, b) => b.avgEng - a.avgEng)

    if (formats.length >= 2) {
      const best = formats[0]
      const totalRecent = formats.reduce((s, f) => s + f.recentCount, 0)
      const bestRecentShare = totalRecent > 0 ? best.recentCount / totalRecent : 0

      // Recommend if the best format is underrepresented recently (<30% of recent content)
      if (bestRecentShare < 0.3 && best.avgEng > formats[1].avgEng * 1.1) {
        const formatLabel = best.label === 'CAROUSEL' ? 'Carrosseis' : best.label === 'REEL' ? 'Reels' : 'Imagens'
        recommendations.push({
          type: 'format',
          title: `Aumente a frequencia de ${formatLabel}`,
          description: `${formatLabel} tem a maior taxa de engagement (${best.avgEng.toFixed(1)}%), mas representam apenas ${(bestRecentShare * 100).toFixed(0)}% do conteudo recente.`,
          confidence: best.count >= 5 ? 'high' : 'medium',
          data: {
            formats: formats.map((f) => ({
              format: f.label,
              avgEngagement: Number(f.avgEng.toFixed(2)),
              total: f.count,
              recent: f.recentCount,
            })),
          },
        })
      }
    }
  } catch (err) {
    logger.warn('Format analysis failed', 'Recommendations', { error: err as Record<string, unknown> })
  }

  // -------------------------------------------------------
  // 3. Content gaps (editorial calendar)
  // -------------------------------------------------------
  try {
    if (calendarEntries.length >= 0 && !calendarRes.error) {
      const scheduledDates = new Set(
        calendarEntries
          .filter((e) => e.scheduled_for && e.status !== 'CANCELLED')
          .map((e) => e.scheduled_for as string)
      )

      const gapDays: string[] = []
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now)
        d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        if (!scheduledDates.has(dateStr)) {
          gapDays.push(dateStr)
        }
      }

      if (gapDays.length >= 2) {
        recommendations.push({
          type: 'gap',
          title: `${gapDays.length} dias sem conteudo planejado`,
          description: `Nos proximos 7 dias, ${gapDays.length} dias nao tem conteudo agendado no calendario editorial. Considere preencher para manter a constancia.`,
          confidence: 'high',
          data: {
            gapDates: gapDays,
            scheduledCount: calendarEntries.length,
          },
        })
      }
    }
  } catch (err) {
    logger.warn('Gap analysis failed', 'Recommendations', { error: err as Record<string, unknown> })
  }

  // -------------------------------------------------------
  // 4. Top performing themes (hashtag analysis)
  // -------------------------------------------------------
  try {
    const itemsWithEng = allContent
      .filter((c) => c.engagementRate > 0)
      .sort((a, b) => b.engagementRate - a.engagementRate)

    const top10pctCount = Math.max(1, Math.ceil(itemsWithEng.length * 0.1))
    const topItems = itemsWithEng.slice(0, top10pctCount)

    const tagCounts = new Map<string, number>()
    for (const item of topItems) {
      if (!item.hashtags) continue
      for (const tag of item.hashtags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }

    const recurringTags = Array.from(tagCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    if (recurringTags.length >= 2) {
      const tagList = recurringTags.map(([tag]) => `#${tag}`).join(', ')
      recommendations.push({
        type: 'theme',
        title: `Temas que performam: ${recurringTags[0][0]}`,
        description: `Os hashtags mais recorrentes no top 10% de conteudo sao: ${tagList}. Considere criar mais conteudo com esses temas.`,
        confidence: topItems.length >= 5 ? 'high' : 'medium',
        data: {
          topHashtags: recurringTags.map(([tag, count]) => ({ tag, count })),
          topContentCount: topItems.length,
        },
      })
    }
  } catch (err) {
    logger.warn('Theme analysis failed', 'Recommendations', { error: err as Record<string, unknown> })
  }

  // -------------------------------------------------------
  // 5. Engagement trend (last 7d vs previous 7d)
  // -------------------------------------------------------
  try {
    const last7d = allContent.filter(
      (c) => c.timestamp && new Date(c.timestamp) >= sevenDaysAgo
    )
    const prev7d = allContent.filter(
      (c) => c.timestamp && new Date(c.timestamp) >= fourteenDaysAgo && new Date(c.timestamp) < sevenDaysAgo
    )

    if (last7d.length >= 2 && prev7d.length >= 2) {
      const avgLast = last7d.reduce((s, c) => s + c.engagementRate, 0) / last7d.length
      const avgPrev = prev7d.reduce((s, c) => s + c.engagementRate, 0) / prev7d.length

      if (avgPrev > 0) {
        const changePercent = ((avgLast - avgPrev) / avgPrev) * 100

        if (changePercent < -15) {
          recommendations.push({
            type: 'trend',
            title: 'Engagement em queda',
            description: `A taxa de engagement caiu ${Math.abs(changePercent).toFixed(0)}% nos ultimos 7 dias comparado a semana anterior (${avgLast.toFixed(1)}% vs ${avgPrev.toFixed(1)}%).`,
            confidence: last7d.length >= 5 ? 'high' : 'medium',
            data: {
              last7dAvg: Number(avgLast.toFixed(2)),
              prev7dAvg: Number(avgPrev.toFixed(2)),
              changePercent: Number(changePercent.toFixed(1)),
              last7dCount: last7d.length,
              prev7dCount: prev7d.length,
            },
          })
        } else if (changePercent > 15) {
          recommendations.push({
            type: 'trend',
            title: 'Engagement em alta!',
            description: `A taxa de engagement subiu ${changePercent.toFixed(0)}% nos ultimos 7 dias comparado a semana anterior (${avgLast.toFixed(1)}% vs ${avgPrev.toFixed(1)}%). Continue com a estrategia atual!`,
            confidence: last7d.length >= 5 ? 'high' : 'medium',
            data: {
              last7dAvg: Number(avgLast.toFixed(2)),
              prev7dAvg: Number(avgPrev.toFixed(2)),
              changePercent: Number(changePercent.toFixed(1)),
              last7dCount: last7d.length,
              prev7dCount: prev7d.length,
            },
          })
        }
      }
    }
  } catch (err) {
    logger.warn('Trend analysis failed', 'Recommendations', { error: err as Record<string, unknown> })
  }

  logger.info(`Generated ${recommendations.length} recommendations`, 'Recommendations')

  return apiSuccess({ recommendations }, 200, 3600)
}, 'DashIG Recommendations')
