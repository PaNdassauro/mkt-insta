import { createServerSupabaseClient } from './supabase'
import { calcEngagementRate, formatNumber, formatPercent } from './analytics'
import { escapeHtml } from './auth'

export interface ReportRecommendation {
  title: string
  description: string
}

export interface SentimentTotals {
  POSITIVE: number
  NEUTRAL: number
  NEGATIVE: number
  QUESTION: number
}

export interface ReportHashtag {
  hashtag: string
  avg_reach: number
  avg_engagement: number
  impact: number
}

export interface ReportCompetitor {
  username: string
  followers: number
  growthPct: number
  mediaCount: number
}

export interface MonthlyReport {
  month: string
  year: number
  account: {
    followers: number
    followersDelta: number
    reach7d: number
    profileViews: number
  }
  topPosts: Array<{
    caption: string
    type: string
    engagementRate: number
    reach: number
    likes: number
  }>
  topReels: Array<{
    caption: string
    views: number
    reach: number
    engagementRate: number
  }>
  totals: {
    postsCount: number
    reelsCount: number
    avgEngagement: number
    totalReach: number
    totalLikes: number
    totalComments: number
    totalSaves: number
    totalShares: number
  }
  recommendations: ReportRecommendation[]
  sentimentTotals: SentimentTotals
  topHashtags: ReportHashtag[]
  competitors: ReportCompetitor[]
}

export async function generateMonthlyReport(): Promise<MonthlyReport> {
  const supabase = createServerSupabaseClient()

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const monthStr = firstOfMonth.toLocaleDateString('pt-BR', { month: 'long' })
  const year = firstOfMonth.getFullYear()

  // Snapshots do mes
  const { data: snapshots } = await supabase
    .from('instagram_account_snapshots')
    .select('*')
    .gte('date', firstOfMonth.toISOString().split('T')[0])
    .lte('date', lastOfMonth.toISOString().split('T')[0])
    .order('date', { ascending: true })

  const firstSnap = snapshots?.[0]
  const lastSnap = snapshots?.[snapshots.length - 1]
  const followersDelta = (lastSnap?.followers_count ?? 0) - (firstSnap?.followers_count ?? 0)

  // Posts do mes
  const { data: posts } = await supabase
    .from('instagram_posts')
    .select('*')
    .gte('timestamp', firstOfMonth.toISOString())
    .lte('timestamp', lastOfMonth.toISOString())
    .order('engagement_rate', { ascending: false })

  // Reels do mes
  const { data: reels } = await supabase
    .from('instagram_reels')
    .select('*')
    .gte('timestamp', firstOfMonth.toISOString())
    .lte('timestamp', lastOfMonth.toISOString())
    .order('views', { ascending: false })

  const allPosts = posts ?? []
  const allReels = reels ?? []

  const totalReach = allPosts.reduce((s, p) => s + p.reach, 0) + allReels.reduce((s, r) => s + r.reach, 0)
  const totalLikes = allPosts.reduce((s, p) => s + p.likes, 0) + allReels.reduce((s, r) => s + r.likes, 0)
  const totalComments = allPosts.reduce((s, p) => s + p.comments, 0) + allReels.reduce((s, r) => s + r.comments, 0)
  const totalSaves = allPosts.reduce((s, p) => s + p.saves, 0) + allReels.reduce((s, r) => s + r.saves, 0)
  const totalShares = allPosts.reduce((s, p) => s + p.shares, 0) + allReels.reduce((s, r) => s + r.shares, 0)

  const allEngRates = [
    ...allPosts.map((p) => p.engagement_rate ?? 0),
    ...allReels.map((r) => calcEngagementRate(r.likes, r.comments, r.saves, r.shares, r.reach)),
  ]
  const avgEngagement = allEngRates.length > 0
    ? allEngRates.reduce((s, r) => s + r, 0) / allEngRates.length
    : 0

  // ---- Recomendacoes (top 3) ----
  let recommendations: ReportRecommendation[] = []
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const allContentForRec = [
      ...allPosts.map((p) => ({
        timestamp: p.timestamp as string | null,
        engagementRate: p.engagement_rate ?? 0,
        format: p.media_type as string,
        hashtags: p.hashtags as string[] | null,
      })),
      ...allReels.map((r) => ({
        timestamp: r.timestamp as string | null,
        engagementRate: calcEngagementRate(r.likes, r.comments, r.saves, r.shares, r.reach),
        format: 'REEL',
        hashtags: r.hashtags as string[] | null,
      })),
    ]
    if (allContentForRec.length > 0) {
      const globalAvg = allContentForRec.reduce((s, c) => s + c.engagementRate, 0) / allContentForRec.length
      const formatMap = new Map<string, { totalEng: number; count: number }>()
      for (const item of allContentForRec) {
        const label = item.format === 'CAROUSEL_ALBUM' ? 'CAROUSEL' : item.format
        const existing = formatMap.get(label) ?? { totalEng: 0, count: 0 }
        existing.totalEng += item.engagementRate
        existing.count++
        formatMap.set(label, existing)
      }
      const formats = Array.from(formatMap.entries())
        .filter(([, v]) => v.count >= 2)
        .map(([label, v]) => ({ label, avgEng: v.totalEng / v.count }))
        .sort((a, b) => b.avgEng - a.avgEng)
      if (formats.length >= 1) {
        const formatLabel = formats[0].label === 'CAROUSEL' ? 'Carrosseis' : formats[0].label === 'REEL' ? 'Reels' : 'Imagens'
        recommendations.push({
          title: `Melhor formato: ${formatLabel}`,
          description: `${formatLabel} tem a maior taxa de engagement medio (${formats[0].avgEng.toFixed(1)}%) no periodo.`,
        })
      }
      if (avgEngagement > globalAvg * 1.1) {
        recommendations.push({
          title: 'Engagement acima da media',
          description: `O engagement medio do mes (${avgEngagement.toFixed(1)}%) esta acima da media geral dos ultimos 30 dias (${globalAvg.toFixed(1)}%). Continue com a estrategia atual.`,
        })
      } else if (avgEngagement < globalAvg * 0.9) {
        recommendations.push({
          title: 'Engagement abaixo da media',
          description: `O engagement medio do mes (${avgEngagement.toFixed(1)}%) esta abaixo da media geral (${globalAvg.toFixed(1)}%). Considere diversificar formatos e horarios.`,
        })
      }
      // Hashtag-based recommendation
      const tagCounts = new Map<string, number>()
      const topItems = [...allContentForRec].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, Math.max(1, Math.ceil(allContentForRec.length * 0.2)))
      for (const item of topItems) {
        if (!item.hashtags) continue
        for (const tag of item.hashtags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
        }
      }
      const topTags = Array.from(tagCounts.entries()).filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3)
      if (topTags.length >= 1) {
        recommendations.push({
          title: `Temas que performam: ${topTags.map(([t]) => `#${t}`).join(', ')}`,
          description: `Esses hashtags aparecem repetidamente no conteudo com melhor performance. Considere criar mais conteudo com esses temas.`,
        })
      }
    }
    recommendations = recommendations.slice(0, 3)
  } catch {
    // silenciar erro de recomendacoes
  }

  // ---- Sentimento dos comentarios ----
  const sentimentTotals: SentimentTotals = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, QUESTION: 0 }
  try {
    const { data: commentData } = await supabase
      .from('instagram_comments')
      .select('sentiment')
      .gte('timestamp', firstOfMonth.toISOString())
      .lte('timestamp', lastOfMonth.toISOString())

    for (const row of commentData ?? []) {
      const s = (row.sentiment ?? 'NEUTRAL') as keyof SentimentTotals
      sentimentTotals[s] = (sentimentTotals[s] ?? 0) + 1
    }
  } catch {
    // silenciar erro de sentimento
  }

  // ---- Top hashtags por impacto ----
  let topHashtags: ReportHashtag[] = []
  try {
    const hashtagMap = new Map<string, { count: number; totalReach: number; totalEngagement: number }>()
    for (const post of allPosts) {
      if (!post.hashtags) continue
      for (const tag of post.hashtags as string[]) {
        const existing = hashtagMap.get(tag) ?? { count: 0, totalReach: 0, totalEngagement: 0 }
        existing.count++
        existing.totalReach += post.reach ?? 0
        existing.totalEngagement += post.engagement_rate ?? 0
        hashtagMap.set(tag, existing)
      }
    }
    for (const reel of allReels) {
      if (!reel.hashtags) continue
      const engRate = reel.reach > 0 ? calcEngagementRate(reel.likes, reel.comments, reel.saves, reel.shares, reel.reach) : 0
      for (const tag of reel.hashtags as string[]) {
        const existing = hashtagMap.get(tag) ?? { count: 0, totalReach: 0, totalEngagement: 0 }
        existing.count++
        existing.totalReach += reel.reach ?? 0
        existing.totalEngagement += engRate
        hashtagMap.set(tag, existing)
      }
    }
    topHashtags = Array.from(hashtagMap.entries())
      .map(([tag, data]) => {
        const avgReach = data.count > 0 ? Math.round(data.totalReach / data.count) : 0
        const avgEng = data.count > 0 ? data.totalEngagement / data.count : 0
        return {
          hashtag: tag,
          avg_reach: avgReach,
          avg_engagement: Number(avgEng.toFixed(2)),
          impact: Number((avgReach * (avgEng / 100)).toFixed(0)),
        }
      })
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)
  } catch {
    // silenciar erro de hashtags
  }

  // ---- Benchmarking competitivo ----
  const competitors: ReportCompetitor[] = []
  try {
    const { data: comps } = await supabase
      .from('instagram_competitors')
      .select('id, username')

    if (comps && comps.length > 0) {
      for (const comp of comps) {
        // Get snapshots within report month for this competitor
        const { data: compSnaps } = await supabase
          .from('instagram_competitor_snapshots')
          .select('followers_count, media_count, date')
          .eq('competitor_id', comp.id)
          .gte('date', firstOfMonth.toISOString().split('T')[0])
          .lte('date', lastOfMonth.toISOString().split('T')[0])
          .order('date', { ascending: true })

        if (compSnaps && compSnaps.length > 0) {
          const firstCompSnap = compSnaps[0]
          const lastCompSnap = compSnaps[compSnaps.length - 1]
          const growthPct = firstCompSnap.followers_count && firstCompSnap.followers_count > 0
            ? ((lastCompSnap.followers_count - firstCompSnap.followers_count) / firstCompSnap.followers_count) * 100
            : 0

          competitors.push({
            username: comp.username,
            followers: lastCompSnap.followers_count ?? 0,
            growthPct,
            mediaCount: lastCompSnap.media_count ?? 0,
          })
        }
      }
    }
  } catch {
    // silenciar erro de competidores
  }

  return {
    month: monthStr,
    year,
    account: {
      followers: lastSnap?.followers_count ?? 0,
      followersDelta,
      reach7d: lastSnap?.reach_7d ?? 0,
      profileViews: lastSnap?.profile_views ?? 0,
    },
    topPosts: allPosts.slice(0, 5).map((p) => ({
      caption: (p.caption ?? '').slice(0, 100),
      type: p.media_type,
      engagementRate: p.engagement_rate ?? 0,
      reach: p.reach,
      likes: p.likes,
    })),
    topReels: allReels.slice(0, 5).map((r) => ({
      caption: (r.caption ?? '').slice(0, 100),
      views: r.views,
      reach: r.reach,
      engagementRate: calcEngagementRate(r.likes, r.comments, r.saves, r.shares, r.reach),
    })),
    totals: {
      postsCount: allPosts.length,
      reelsCount: allReels.length,
      avgEngagement,
      totalReach,
      totalLikes,
      totalComments,
      totalSaves,
      totalShares,
    },
    recommendations,
    sentimentTotals,
    topHashtags,
    competitors,
  }
}

export function reportToHtml(report: MonthlyReport): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; padding: 32px; color: #1a1a2e; }
    h1 { color: #4F46E5; margin-bottom: 4px; }
    h2 { color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 6px; margin-top: 28px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }
    .kpi { background: #f8f9fc; border-radius: 10px; padding: 16px; }
    .kpi-value { font-size: 24px; font-weight: 700; color: #1a1a2e; }
    .kpi-label { font-size: 12px; color: #666; margin-top: 2px; }
    .kpi-delta { font-size: 12px; color: ${report.account.followersDelta >= 0 ? '#059669' : '#DC2626'}; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    th { background: #f1f3f9; text-align: left; padding: 8px 10px; font-weight: 600; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>Relatorio Mensal — DashIG</h1>
  <p class="subtitle">@welcomeweddings · ${report.month} ${report.year}</p>

  <h2>Metricas da Conta</h2>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${formatNumber(report.account.followers)}</div>
      <div class="kpi-label">Seguidores</div>
      <div class="kpi-delta">${report.account.followersDelta >= 0 ? '+' : ''}${formatNumber(report.account.followersDelta)} no mes</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatNumber(report.account.reach7d)}</div>
      <div class="kpi-label">Alcance (ultima semana)</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatPercent(report.totals.avgEngagement)}</div>
      <div class="kpi-label">Engagement Medio</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatNumber(report.totals.totalReach)}</div>
      <div class="kpi-label">Alcance Total no Mes</div>
    </div>
  </div>

  <h2>Resumo de Conteudo</h2>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-value">${report.totals.postsCount}</div>
      <div class="kpi-label">Posts publicados</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${report.totals.reelsCount}</div>
      <div class="kpi-label">Reels publicados</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatNumber(report.totals.totalLikes)}</div>
      <div class="kpi-label">Total de Likes</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatNumber(report.totals.totalSaves)}</div>
      <div class="kpi-label">Total de Salvos</div>
    </div>
  </div>

  ${report.topPosts.length > 0 ? `
  <h2>Top 5 Posts</h2>
  <table>
    <tr><th>Conteudo</th><th>Tipo</th><th>Engage</th><th>Alcance</th></tr>
    ${report.topPosts.map((p) => `
    <tr>
      <td>${escapeHtml(p.caption || 'Sem legenda')}</td>
      <td>${p.type}</td>
      <td><strong>${formatPercent(p.engagementRate)}</strong></td>
      <td>${formatNumber(p.reach)}</td>
    </tr>`).join('')}
  </table>` : ''}

  ${report.topReels.length > 0 ? `
  <h2>Top 5 Reels</h2>
  <table>
    <tr><th>Conteudo</th><th>Views</th><th>Engage</th><th>Alcance</th></tr>
    ${report.topReels.map((r) => `
    <tr>
      <td>${escapeHtml(r.caption || 'Sem legenda')}</td>
      <td>${formatNumber(r.views)}</td>
      <td><strong>${formatPercent(r.engagementRate)}</strong></td>
      <td>${formatNumber(r.reach)}</td>
    </tr>`).join('')}
  </table>` : ''}

  ${(() => {
    const total = report.sentimentTotals.POSITIVE + report.sentimentTotals.NEUTRAL + report.sentimentTotals.NEGATIVE + report.sentimentTotals.QUESTION
    if (total === 0) return ''
    const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(1) : '0'
    const bar = (v: number, color: string) => {
      const width = total > 0 ? Math.max(2, (v / total) * 100) : 0
      return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
        <div style="width:100px;font-size:12px;">${v} (${pct(v)}%)</div>
        <div style="flex:1;background:#f1f3f9;border-radius:4px;height:18px;overflow:hidden;">
          <div style="width:${width}%;background:${color};height:100%;border-radius:4px;"></div>
        </div>
      </div>`
    }
    return `
  <h2>Sentimento dos Comentarios</h2>
  <div style="margin:12px 0;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><span style="font-size:13px;font-weight:600;">Positivo</span></div>
    ${bar(report.sentimentTotals.POSITIVE, '#059669')}
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><span style="font-size:13px;font-weight:600;">Neutro</span></div>
    ${bar(report.sentimentTotals.NEUTRAL, '#6B7280')}
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><span style="font-size:13px;font-weight:600;">Negativo</span></div>
    ${bar(report.sentimentTotals.NEGATIVE, '#DC2626')}
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><span style="font-size:13px;font-weight:600;">Perguntas</span></div>
    ${bar(report.sentimentTotals.QUESTION, '#2563EB')}
    <p style="font-size:11px;color:#999;margin-top:8px;">Total de comentarios analisados: ${formatNumber(total)}</p>
  </div>`
  })()}

  ${report.topHashtags.length > 0 ? `
  <h2>Top 5 Hashtags por Impacto</h2>
  <table>
    <tr><th>Hashtag</th><th>Alcance Medio</th><th>Engage Medio</th><th>Impacto</th></tr>
    ${report.topHashtags.map((h) => `
    <tr>
      <td><strong>#${escapeHtml(h.hashtag)}</strong></td>
      <td>${formatNumber(h.avg_reach)}</td>
      <td>${formatPercent(h.avg_engagement)}</td>
      <td>${formatNumber(h.impact)}</td>
    </tr>`).join('')}
  </table>` : ''}

  ${report.competitors.length > 0 ? `
  <h2>Benchmarking Competitivo</h2>
  <table>
    <tr><th>Perfil</th><th>Seguidores</th><th>Crescimento</th><th>Posts no mes</th></tr>
    <tr>
      <td><strong>@welcomeweddings</strong></td>
      <td>${formatNumber(report.account.followers)}</td>
      <td>${report.account.followers > 0 ? formatPercent((report.account.followersDelta / (report.account.followers - report.account.followersDelta)) * 100) : '—'}</td>
      <td>${report.totals.postsCount + report.totals.reelsCount}</td>
    </tr>
    ${report.competitors.map((c) => `
    <tr>
      <td>@${escapeHtml(c.username)}</td>
      <td>${formatNumber(c.followers)}</td>
      <td>${formatPercent(c.growthPct)}</td>
      <td>${formatNumber(c.mediaCount)}</td>
    </tr>`).join('')}
  </table>
  <p style="font-size:11px;color:#999;margin-top:4px;">Engagement medio proprio: <strong>${formatPercent(report.totals.avgEngagement)}</strong></p>
  ` : ''}

  ${report.recommendations.length > 0 ? `
  <h2>Recomendacoes</h2>
  ${report.recommendations.map((rec, i) => `
  <div style="background:#f8f9fc;border-radius:10px;padding:14px 16px;margin-bottom:10px;border-left:4px solid #4F46E5;">
    <p style="font-size:14px;font-weight:700;margin:0 0 4px 0;color:#1a1a2e;">${i + 1}. ${escapeHtml(rec.title)}</p>
    <p style="font-size:13px;margin:0;color:#444;">${escapeHtml(rec.description)}</p>
  </div>`).join('')}` : ''}

  <div class="footer">
    Gerado automaticamente por DashIG · ${new Date().toLocaleDateString('pt-BR')}
  </div>
</body>
</html>`
}
