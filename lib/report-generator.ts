import { createServerSupabaseClient } from './supabase'
import { calcEngagementRate, formatNumber, formatPercent } from './analytics'

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
      <td>${p.caption || 'Sem legenda'}</td>
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
      <td>${r.caption || 'Sem legenda'}</td>
      <td>${formatNumber(r.views)}</td>
      <td><strong>${formatPercent(r.engagementRate)}</strong></td>
      <td>${formatNumber(r.reach)}</td>
    </tr>`).join('')}
  </table>` : ''}

  <div class="footer">
    Gerado automaticamente por DashIG · ${new Date().toLocaleDateString('pt-BR')}
  </div>
</body>
</html>`
}
