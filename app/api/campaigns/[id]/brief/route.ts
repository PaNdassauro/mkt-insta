import { logger } from '@/lib/logger'
import { apiError, getErrorMessage } from '@/lib/api-response'
import { validateDashboardRequest } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { escapeHtml } from '@/lib/auth'

/**
 * GET /api/campaigns/[id]/brief
 * Gera um brief para designer em HTML (print-friendly / PDF).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateDashboardRequest(request)
  if (authError) return authError

  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()

    // Buscar campanha
    const { data: campaign, error: campErr } = await supabase
      .from('instagram_campaigns')
      .select('id, title, theme, created_at')
      .eq('id', id)
      .single()

    if (campErr || !campaign) {
      return apiError('Campanha nao encontrada', 404)
    }

    // Buscar posts aprovados
    const { data: posts, error: postsErr } = await supabase
      .from('campaign_posts')
      .select('post_order, format, visual_brief, visual_notes, caption')
      .eq('campaign_id', id)
      .eq('status', 'APPROVED')
      .order('post_order', { ascending: true })

    if (postsErr) throw postsErr

    const approvedPosts = posts ?? []

    if (approvedPosts.length === 0) {
      return apiError('Nenhum post aprovado encontrado nesta campanha', 400)
    }

    const dateStr = new Date(campaign.created_at).toLocaleDateString('pt-BR')
    const todayStr = new Date().toLocaleDateString('pt-BR')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Brief para Designer — ${escapeHtml(campaign.title)}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 32px;
      color: #1a1a2e;
      line-height: 1.5;
    }
    h1 {
      color: #4F46E5;
      margin-bottom: 4px;
      font-size: 22px;
    }
    .subtitle {
      color: #666;
      font-size: 13px;
      margin-bottom: 24px;
    }
    .meta {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #444;
    }
    .meta strong {
      color: #1a1a2e;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 13px;
    }
    th {
      background: #f1f3f9;
      text-align: left;
      padding: 10px 12px;
      font-weight: 600;
      border-bottom: 2px solid #ddd;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }
    tr:nth-child(even) {
      background: #fafbfd;
    }
    .post-number {
      font-weight: 700;
      color: #4F46E5;
      text-align: center;
    }
    .format-badge {
      display: inline-block;
      background: #EEF2FF;
      color: #4F46E5;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .caption-preview {
      color: #666;
      font-style: italic;
      font-size: 12px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      font-size: 11px;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>Brief para Designer</h1>
  <p class="subtitle">${escapeHtml(campaign.title)}${campaign.theme ? ` — ${escapeHtml(campaign.theme)}` : ''}</p>

  <div class="meta">
    <div><strong>Campanha criada em:</strong> ${dateStr}</div>
    <div><strong>Brief gerado em:</strong> ${todayStr}</div>
    <div><strong>Posts aprovados:</strong> ${approvedPosts.length}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th style="width:100px;">Formato</th>
        <th>Brief Visual</th>
        <th>Notas</th>
        <th style="width:180px;">Caption (preview)</th>
      </tr>
    </thead>
    <tbody>
      ${approvedPosts.map((post) => `
      <tr>
        <td class="post-number">${post.post_order}</td>
        <td><span class="format-badge">${escapeHtml(post.format ?? 'N/A')}</span></td>
        <td>${escapeHtml(post.visual_brief ?? 'Sem brief visual')}</td>
        <td>${escapeHtml(post.visual_notes ?? '—')}</td>
        <td class="caption-preview">${escapeHtml((post.caption ?? '').slice(0, 100))}${(post.caption ?? '').length > 100 ? '...' : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer">
    Gerado automaticamente por DashIG · ${todayStr}
  </div>
</body>
</html>`

    logger.info('Brief gerado', 'Campaign Brief', {
      campaignId: id,
      postsCount: approvedPosts.length,
    })

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    logger.error('GET error', 'Campaign Brief', { error: err as Error })
    return apiError(getErrorMessage(err))
  }
}
