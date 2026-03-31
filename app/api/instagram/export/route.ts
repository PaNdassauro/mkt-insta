import { createServerSupabaseClient } from '@/lib/supabase'
import { calcEngagementRate } from '@/lib/analytics'
import { apiError, getErrorMessage } from '@/lib/api-response'

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(escape).join(','))
  }
  return lines.join('\n')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? 'posts'
    const supabase = createServerSupabaseClient()

    let csv = ''
    let filename = ''

    if (type === 'posts') {
      const { data, error } = await supabase
        .from('instagram_posts')
        .select('*')
        .order('timestamp', { ascending: false })
      if (error) throw error

      const headers = ['Data', 'Tipo', 'Caption', 'Likes', 'Comentarios', 'Salvos', 'Compartilhamentos', 'Alcance', 'Impressoes', 'Engagement Rate', 'Score', 'Hashtags', 'Link']
      const rows = (data ?? []).map((p) => [
        p.timestamp ? new Date(p.timestamp).toLocaleDateString('pt-BR') : '',
        p.media_type,
        (p.caption ?? '').slice(0, 200),
        String(p.likes),
        String(p.comments),
        String(p.saves),
        String(p.shares),
        String(p.reach),
        String(p.impressions),
        p.engagement_rate?.toFixed(2) ?? '',
        p.content_score ?? '',
        (p.hashtags ?? []).map((h: string) => `#${h}`).join(' '),
        p.permalink ?? '',
      ])
      csv = toCsv(headers, rows)
      filename = 'dashig-posts.csv'

    } else if (type === 'reels') {
      const { data, error } = await supabase
        .from('instagram_reels')
        .select('*')
        .order('timestamp', { ascending: false })
      if (error) throw error

      const headers = ['Data', 'Caption', 'Views', 'Likes', 'Comentarios', 'Salvos', 'Compartilhamentos', 'Alcance', 'Completion Rate', 'Engagement Rate', 'Score', 'Link']
      const rows = (data ?? []).map((r) => [
        r.timestamp ? new Date(r.timestamp).toLocaleDateString('pt-BR') : '',
        (r.caption ?? '').slice(0, 200),
        String(r.views),
        String(r.likes),
        String(r.comments),
        String(r.saves),
        String(r.shares),
        String(r.reach),
        r.completion_rate?.toFixed(2) ?? '',
        calcEngagementRate(r.likes, r.comments, r.saves, r.shares, r.reach).toFixed(2),
        r.content_score ?? '',
        r.permalink ?? '',
      ])
      csv = toCsv(headers, rows)
      filename = 'dashig-reels.csv'

    } else if (type === 'hashtags') {
      // Reutilizar logica do endpoint de hashtags
      const res = await fetch(new URL('/api/instagram/hashtags', request.url).toString())
      const json = await res.json()
      const hashtags = json.data ?? []

      const headers = ['Hashtag', 'Uso', 'Alcance Medio', 'Engagement Medio', 'Trend 4sem (%)', 'Impacto']
      const rows = hashtags.map((h: { hashtag: string; count: number; avg_reach: number; avg_engagement: number; trend: number; impact: number }) => [
        `#${h.hashtag}`,
        String(h.count),
        String(h.avg_reach),
        h.avg_engagement.toFixed(2),
        h.trend.toFixed(1),
        String(h.impact),
      ])
      csv = toCsv(headers, rows)
      filename = 'dashig-hashtags.csv'

    } else {
      return apiError('Invalid type. Use: posts, reels, hashtags', 400)
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[DashIG Export] Error:', err)
    return apiError(getErrorMessage(err))
  }
}
